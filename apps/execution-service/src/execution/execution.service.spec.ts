/* eslint-disable */
import { ExecutionService } from './execution.service';

jest.mock('@kubernetes/client-node', () => {
    const mockBatchV1 = {
        createNamespacedJob: jest.fn(),
        readNamespacedJob: jest.fn(),
        deleteNamespacedJob: jest.fn(),
    };
    const mockCoreV1 = {
        listNamespacedPod: jest.fn(),
        readNamespacedPodLog: jest.fn(),
    };

    class BatchV1Api {}
    class CoreV1Api {}

    class KubeConfig {
        loadFromCluster = jest.fn();
        loadFromDefault = jest.fn();
        makeApiClient(ApiClass: any) {
            return ApiClass === BatchV1Api ? mockBatchV1 : mockCoreV1;
        }
    }

    return {
        KubeConfig,
        BatchV1Api,
        CoreV1Api,
        __mockBatchV1: mockBatchV1,
        __mockCoreV1: mockCoreV1,
    };
});

import * as k8s from '@kubernetes/client-node';

const mockBatchV1 = (k8s as any).__mockBatchV1;
const mockCoreV1 = (k8s as any).__mockCoreV1;

describe('ExecutionService', () => {
    let service: ExecutionService;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        service = new ExecutionService();
        service.onModuleInit();
    });

    it('should exist', () => {
        expect(service).toBeDefined();
    });

    describe('runTestCases', () => {
        it('should return an unsupported-language error without contacting kubernetes', async () => {
            const results = await service.runTestCases(
                'brainfuck' as any,
                'code',
                [{ input: '', output: 'x' }],
            );

            expect(results).toEqual([{ success: false, output: 'Unsupported language' }]);
            expect(mockBatchV1.createNamespacedJob).not.toHaveBeenCalled();
        });

        it('should return success when the job succeeds and logs match the expected output', async () => {
            mockBatchV1.createNamespacedJob.mockResolvedValue(undefined);
            mockBatchV1.readNamespacedJob.mockResolvedValue({ status: { succeeded: 1 } });
            mockCoreV1.listNamespacedPod.mockResolvedValue({
                items: [{ metadata: { name: 'pod-1' } }],
            });
            mockCoreV1.readNamespacedPodLog.mockResolvedValue('42');

            const results = await service.runTestCases('python' as any, 'print(42)', [
                { input: '', output: '42' },
            ]);

            expect(results).toEqual([{ success: true, output: '42' }]);

            const jobBody = mockBatchV1.createNamespacedJob.mock.calls[0][0].body;
            const command = jobBody.spec.template.spec.containers[0].command;
            expect(command[2]).toContain('solution.py');
        });

        it('should build a Solution.java file for java submissions', async () => {
            mockBatchV1.createNamespacedJob.mockResolvedValue(undefined);
            mockBatchV1.readNamespacedJob.mockResolvedValue({ status: { succeeded: 1 } });
            mockCoreV1.listNamespacedPod.mockResolvedValue({
                items: [{ metadata: { name: 'pod-1' } }],
            });
            mockCoreV1.readNamespacedPodLog.mockResolvedValue('ok');

            await service.runTestCases('java' as any, 'class Solution {}', [
                { input: '', output: 'ok' },
            ]);

            const jobBody = mockBatchV1.createNamespacedJob.mock.calls[0][0].body;
            const command = jobBody.spec.template.spec.containers[0].command;
            expect(command[2]).toContain('Solution.java');
        });

        it('should return success false when the produced output does not match expected output', async () => {
            mockBatchV1.createNamespacedJob.mockResolvedValue(undefined);
            mockBatchV1.readNamespacedJob.mockResolvedValue({ status: { succeeded: 1 } });
            mockCoreV1.listNamespacedPod.mockResolvedValue({
                items: [{ metadata: { name: 'pod-1' } }],
            });
            mockCoreV1.readNamespacedPodLog.mockResolvedValue('wrong');

            const results = await service.runTestCases('python' as any, 'print(42)', [
                { input: '', output: '42' },
            ]);

            expect(results).toEqual([{ success: false, output: 'wrong' }]);
        });

        it('should mark a failed job containing "error" in its logs as a compilation error', async () => {
            mockBatchV1.createNamespacedJob.mockResolvedValue(undefined);
            mockBatchV1.readNamespacedJob.mockResolvedValue({ status: { failed: 1 } });
            mockCoreV1.listNamespacedPod.mockResolvedValue({
                items: [{ metadata: { name: 'pod-1' } }],
            });
            mockCoreV1.readNamespacedPodLog.mockResolvedValue('SyntaxError: bad code');

            const results = await service.runTestCases('python' as any, 'bad(', [
                { input: '', output: '42' },
            ]);

            expect(results).toEqual([
                { success: false, output: 'Compilation Error: SyntaxError: bad code' },
            ]);
        });

        it('should fall back to a generic runtime error when a failed job has no logs', async () => {
            mockBatchV1.createNamespacedJob.mockResolvedValue(undefined);
            mockBatchV1.readNamespacedJob.mockResolvedValue({ status: { failed: 1 } });
            mockCoreV1.listNamespacedPod.mockResolvedValue({ items: [] });

            const results = await service.runTestCases('python' as any, 'exit(1)', [
                { input: '', output: '42' },
            ]);

            expect(results).toEqual([{ success: false, output: 'Runtime Error' }]);
        });

        it('should return an infrastructure error when job creation throws', async () => {
            mockBatchV1.createNamespacedJob.mockRejectedValue(new Error('cluster unreachable'));

            const results = await service.runTestCases('python' as any, 'print(1)', [
                { input: '', output: '1' },
            ]);

            expect(results).toEqual([
                { success: false, output: 'Execution infrastructure error' },
            ]);
        });

        it('should delete the job and report a time-limit-exceeded result when it never completes', async () => {
            jest.useFakeTimers();
            mockBatchV1.createNamespacedJob.mockResolvedValue(undefined);
            mockBatchV1.readNamespacedJob.mockResolvedValue({ status: {} });
            mockBatchV1.deleteNamespacedJob.mockResolvedValue(undefined);

            const resultsPromise = service.runTestCases('python' as any, 'while True: pass', [
                { input: '', output: '1' },
            ]);

            await jest.advanceTimersByTimeAsync(30000);
            const results = await resultsPromise;

            expect(mockBatchV1.deleteNamespacedJob).toHaveBeenCalledWith(
                expect.objectContaining({ body: { propagationPolicy: 'Foreground' } }),
            );
            expect(results).toEqual([{ success: false, output: 'Time Limit Exceeded' }]);

            jest.useRealTimers();
        }, 15000);
    });
});
