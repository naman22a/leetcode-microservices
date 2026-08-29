import { Injectable, OnModuleInit } from '@nestjs/common';
import { Language } from '@leetcode/database';
import { ExecutionResult } from '@leetcode/types';
import { LANG_CONFIGS } from '@leetcode/constants';
import * as k8s from '@kubernetes/client-node';
import { k8sJobCreationDuration, k8sJobsRunning } from '../metrics/metrics';

@Injectable()
export class ExecutionService implements OnModuleInit {
    private batchV1!: k8s.BatchV1Api;
    private coreV1!: k8s.CoreV1Api;

    onModuleInit() {
        const kc = new k8s.KubeConfig();

        try {
            if (process.env.KUBERNETES_SERVICE_HOST) {
                kc.loadFromCluster();
            } else {
                kc.loadFromDefault();
            }

            this.batchV1 = kc.makeApiClient(k8s.BatchV1Api);
            this.coreV1 = kc.makeApiClient(k8s.CoreV1Api);
            console.log('K8s client initialized successfully');
        } catch (error) {
            console.error('Failed to initialize K8s client:', error);
        }
    }

    async runTestCases(
        language: Language,
        code: string,
        testCases: { input: string; output: string }[],
    ) {
        k8sJobsRunning.inc();

        const timer = k8sJobCreationDuration.startTimer();
        const results = await Promise.all(
            testCases.map((testCase) =>
                this.executeCode(language, code, testCase.input, testCase.output),
            ),
        );
        timer();

        k8sJobsRunning.dec();

        return results;
    }

    private async executeCode(
        language: string,
        code: string,
        input: string,
        expectedOutput: string,
        timeout: number = 30000,
    ): Promise<ExecutionResult> {
        if (!LANG_CONFIGS[language]) {
            return { success: false, output: 'Unsupported language' };
        }

        const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const namespace = 'oj';

        const langConfig = LANG_CONFIGS[language];
        const fileExtension = this.getFileExtension(language);
        const fileName = language === 'java' ? 'Solution' : 'solution';
        const fullFileName = `${fileName}.${fileExtension}`;

        // Build the shell script that compile (if needed) + runs the code
        const compileStep = langConfig.compile ? `${langConfig.compile.join(' ')} && ` : '';

        const runStep = input
            ? `echo "${input}" | ${langConfig.run.join(' ')}`
            : langConfig.run.join(' ');

        const script = `
            cd /workspace
            cat > ${fullFileName} << 'LEETCODE_EOF'
${code}
LEETCODE_EOF
            ${compileStep}${runStep}
        `.trim();

        try {
            // 1. Create the Job
            await this.batchV1.createNamespacedJob({
                namespace,
                body: {
                    metadata: {
                        name: executionId,
                        labels: { app: 'leetcode-runner', executionId },
                    },
                    spec: {
                        ttlSecondsAfterFinished: 60, // auto-cleanup after 1 min
                        backoffLimit: 0, // never retry user code
                        activeDeadlineSeconds: Math.ceil(timeout / 1000),
                        template: {
                            spec: {
                                restartPolicy: 'Never',
                                automountServiceAccountToken: false, // user code gets no cluster access
                                containers: [
                                    {
                                        name: 'runner',
                                        image: langConfig.image,
                                        imagePullPolicy: 'IfNotPresent',
                                        command: ['sh', '-c', script],
                                        workingDir: '/workspace',
                                        resources: {
                                            limits: { cpu: '500m', memory: '128Mi' },
                                            requests: { cpu: '100m', memory: '64Mi' },
                                        },
                                        securityContext: {
                                            runAsNonRoot: false,
                                            readOnlyRootFilesystem: false, // needs to write solution file
                                            allowPrivilegeEscalation: false,
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            });

            // 2. Poll for completion
            const result = await this.waitForJob(executionId, namespace, timeout, expectedOutput);
            return result;
        } catch (error) {
            console.error('K8s job error:', error);
            return { success: false, output: 'Execution infrastructure error' };
        }
        // const tempDir = path.join('/tmp/leetcode-sandbox', executionId);
        // if (!fsSync.existsSync(tempDir)) {
        //     fsSync.mkdirSync(tempDir, { recursive: true });
        // }

        // const fileExtension = this.getFileExtension(language);
        // const fileName = language === 'java' ? 'Solution' : 'solution';
        // const filePath = path.join(tempDir, `${fileName}.${fileExtension}`);

        // try {
        //     fsSync.writeFileSync(filePath, code);

        //     // Verify file was created
        //     if (!fsSync.existsSync(filePath)) {
        //         return { success: false, output: 'Failed to create code file' };
        //     }
        // } catch (error) {
        //     console.error('File write error:', error);
        //     return { success: false, output: 'Failed to write code file' };
        // }

        // // Cleanup function
        // const cleanup = () => {
        //     try {
        //         fsSync.rmSync(tempDir, { recursive: true, force: true });
        //     } catch (error) {
        //         console.error('Cleanup error:', error);
        //     }
        // };

        // const dockerArgs = [
        //     'run',
        //     '--rm',
        //     '--network=none',
        //     '--memory=128m',
        //     '--cpus=0.5',
        //     '--pids-limit=50',
        //     '-v',
        //     `${tempDir}:/workspace`,
        //     '-w',
        //     '/workspace',
        //     LANG_CONFIGS[language].image,
        // ];

        // return new Promise((resolve) => {
        //     const compileCommand = LANG_CONFIGS[language].compile;
        //     const runCommand = LANG_CONFIGS[language].run;

        //     const executeProcess = (
        //         command: string[],
        //         callback: (result: ExecutionResult) => void,
        //     ) => {
        //         try {
        //             const fullCommand = input
        //                 ? ['sh', '-c', `echo "${input}" | ${command.join(' ')}`]
        //                 : command;

        //             const process = spawn('docker', [...dockerArgs, ...fullCommand]);

        //             let output = '';
        //             let errorOutput = '';
        //             let isTimedOut = false;

        //             const timer = setTimeout(() => {
        //                 isTimedOut = true;
        //                 process.kill('SIGKILL');
        //             }, timeout);

        //             // Write input to stdin
        //             if (input) {
        //                 process.stdin.write(input + '\n');
        //             }
        //             process.stdin.end();

        //             process.stdout.on('data', (data) => {
        //                 // eslint-disable-next-line
        //                 output += data.toString();
        //             });

        //             process.stderr.on('data', (data) => {
        //                 // eslint-disable-next-line
        //                 errorOutput += data.toString();
        //             });

        //             process.on('error', (error) => {
        //                 clearTimeout(timer);
        //                 callback({
        //                     success: false,
        //                     output: `Process error: ${error.message}`,
        //                 });
        //             });

        //             process.on('close', (code) => {
        //                 clearTimeout(timer);

        //                 if (isTimedOut) {
        //                     callback({
        //                         success: false,
        //                         output: 'Time Limit Exceeded',
        //                     });
        //                     return;
        //                 }

        //                 callback({
        //                     success: code === 0 && expectedOutput.trim() === output.trim(),
        //                     output: output || errorOutput,
        //                 });
        //             });
        //         } catch (error) {
        //             console.error(error);
        //             callback({
        //                 success: false,
        //                 output: 'Something went wrong',
        //             });
        //         }
        //     };

        //     if (compileCommand) {
        //         executeProcess(compileCommand, (compileResult) => {
        //             if (!compileResult.success && compileResult.output) {
        //                 cleanup();
        //                 resolve({
        //                     success: false,
        //                     output: 'Compilation Error: ' + compileResult.output,
        //                 });
        //             } else {
        //                 executeProcess(runCommand, (runResult) => {
        //                     cleanup();
        //                     resolve(runResult);
        //                 });
        //             }
        //         });
        //     } else {
        //         executeProcess(runCommand, (runResult) => {
        //             cleanup();
        //             resolve(runResult);
        //         });
        //     }
        // });
    }

    private async waitForJob(
        jobName: string,
        namespace: string,
        timeout: number,
        expectedOutput: string,
    ): Promise<ExecutionResult> {
        const pollInterval = 500;
        const maxAttempts = Math.ceil(timeout / pollInterval);

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, pollInterval));

            const job = await this.batchV1.readNamespacedJob({
                name: jobName,
                namespace,
            });

            const { succeeded, failed } = job.status ?? {};

            if (succeeded || failed) {
                // Fetch logs from the completed/failed pod
                const output = await this.getJobLogs(jobName, namespace);
                console.log('Output: \n', output);
                if (failed) {
                    const isCompileError = output.toLowerCase().includes('error');
                    return {
                        success: false,
                        output: isCompileError
                            ? `Compilation Error: ${output}`
                            : output || 'Runtime Error',
                    };
                }

                // succeeded
                return {
                    success: expectedOutput.trim() === output.trim(),
                    output,
                };
            }
        }

        // Timed out — delete the job
        await this.batchV1.deleteNamespacedJob({
            name: jobName,
            namespace,
            body: { propagationPolicy: 'Foreground' },
        });
        return { success: false, output: 'Time Limit Exceeded' };
    }

    private async getJobLogs(jobName: string, namespace: string): Promise<string> {
        try {
            // Find the pod belonging to this job
            const podList = await this.coreV1.listNamespacedPod({
                namespace,
                labelSelector: `job-name=${jobName}`,
            });

            const pod = podList.items[0];
            if (!pod?.metadata?.name) return '';

            const logs = await this.coreV1.readNamespacedPodLog({
                name: pod.metadata.name,
                namespace,
            });
            return logs;
        } catch {
            return '';
        }
    }

    private getFileExtension(language: string): string {
        const extensions: Record<string, string> = {
            cpp: 'cpp',
            python: 'py',
            java: 'java',
            javascript: 'js',
            go: 'go',
            rust: 'rs',
            csharp: 'cs',
            ruby: 'rb',
            swift: 'swift',
            php: 'php',
            kotlin: 'kt',
            dart: 'dart',
            r: 'R',
            perl: 'pl',
            typescript: 'ts',
            haskell: 'hs',
        };
        return extensions[language] || 'txt';
    }
}
