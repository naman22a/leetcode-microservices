/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ExecutionConsumer } from './execution.worker';
import { PrismaService } from '@leetcode/database';

jest.mock('./execution.service', () => ({
    ExecutionService: jest.fn(),
}));

import { ExecutionService } from './execution.service';

jest.mock('../redis', () => ({
    redis: { set: jest.fn(), setex: jest.fn(), del: jest.fn() },
}));

jest.mock('../utils', () => ({
    generateCacheKey: jest.fn(() => 'cache-key'),
}));

const mockWorkersActiveLabel = { inc: jest.fn(), dec: jest.fn() };
const mockQueueCompletedLabel = { inc: jest.fn() };
const mockQueueFailedLabel = { inc: jest.fn() };

jest.mock('../metrics/metrics', () => ({
    dlqJobs: { inc: jest.fn() },
    executionDuration: { startTimer: jest.fn(() => jest.fn()) },
    queueCompleted: { labels: jest.fn(() => mockQueueCompletedLabel) },
    queueFailed: { labels: jest.fn(() => mockQueueFailedLabel) },
    redisLockFailures: { inc: jest.fn() },
    verdicts: { labels: jest.fn(() => ({ inc: jest.fn() })) },
    workersActive: { labels: jest.fn(() => mockWorkersActiveLabel) },
}));

import { redis } from '../redis';
import { redisLockFailures, dlqJobs } from '../metrics/metrics';

const mockPrisma = {
    problem: { findUnique: jest.fn() },
};

const mockExecutionService = {
    runTestCases: jest.fn(),
};

const mockResultsQueue = { add: jest.fn() };
const mockDlqQueue = { add: jest.fn() };

const jobData = {
    problemId: 1,
    code: 'print(1)',
    language: 'python',
    userId: 2,
    idempotencyKey: 'idem-1',
};

describe('ExecutionConsumer', () => {
    let consumer: ExecutionConsumer;

    beforeEach(async () => {
        jest.clearAllMocks();
        (redis.set as jest.Mock).mockResolvedValue('OK');

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExecutionConsumer,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ExecutionService, useValue: mockExecutionService },
                { provide: getQueueToken('results-queue'), useValue: mockResultsQueue },
                { provide: getQueueToken('execution-dlq'), useValue: mockDlqQueue },
            ],
        }).compile();

        consumer = module.get<ExecutionConsumer>(ExecutionConsumer);
    });

    it('consumer should exist', () => {
        expect(consumer).toBeDefined();
    });

    describe('process', () => {
        it('should skip the job when the distributed lock is already held', async () => {
            (redis.set as jest.Mock).mockResolvedValue(null);

            const job = { id: 'job-1', name: 'execute-job', data: jobData } as any;
            await consumer.process(job);

            expect(redisLockFailures.inc).toHaveBeenCalled();
            expect(mockPrisma.problem.findUnique).not.toHaveBeenCalled();
        });

        it('should release the lock and return early when the problem is not found', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue(null);

            const job = { id: 'job-2', name: 'execute-job', data: jobData } as any;
            await consumer.process(job);

            expect(mockExecutionService.runTestCases).not.toHaveBeenCalled();
            expect(redis.del).toHaveBeenCalledWith('lock:idem-1');
            expect(mockWorkersActiveLabel.dec).toHaveBeenCalled();
        });

        it('should run test cases, cache results, and queue the result job on success', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue({
                testCases: [{ input: 'in', expectedOutput: 'out' }],
            });
            const results = [{ success: true, output: 'out' }];
            mockExecutionService.runTestCases.mockResolvedValue(results);

            const job = { id: 'job-3', name: 'execute-job', data: jobData } as any;
            await consumer.process(job);

            expect(mockPrisma.problem.findUnique).toHaveBeenCalledWith({
                where: { id: jobData.problemId },
                select: { testCases: true },
            });
            expect(mockExecutionService.runTestCases).toHaveBeenCalledWith(
                jobData.language,
                jobData.code,
                [{ input: 'in', output: 'out' }],
            );
            expect(redis.setex).toHaveBeenCalledWith('cache-key', 60, JSON.stringify(results));
            expect(mockResultsQueue.add).toHaveBeenCalledWith('result-job', {
                code: jobData.code,
                language: jobData.language,
                problemId: jobData.problemId,
                results,
                userId: jobData.userId,
                idempotencyKey: jobData.idempotencyKey,
            });
            expect(mockQueueCompletedLabel.inc).toHaveBeenCalled();
            expect(redis.del).toHaveBeenCalledWith('lock:idem-1');
            expect(mockWorkersActiveLabel.dec).toHaveBeenCalled();
        });

        it('should still queue the result job when caching the results fails', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue({ testCases: [] });
            mockExecutionService.runTestCases.mockResolvedValue([]);
            (redis.setex as jest.Mock).mockRejectedValue(new Error('redis down'));

            const job = { id: 'job-4', name: 'execute-job', data: jobData } as any;
            await consumer.process(job);

            expect(mockResultsQueue.add).toHaveBeenCalled();
        });

        it('should send the job to the DLQ and rethrow when execution throws', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue({ testCases: [] });
            mockExecutionService.runTestCases.mockRejectedValue(new Error('boom'));

            const job = { id: 'job-5', name: 'execute-job', data: jobData } as any;
            await expect(consumer.process(job)).rejects.toThrow('boom');

            expect(dlqJobs.inc).toHaveBeenCalled();
            expect(mockDlqQueue.add).toHaveBeenCalledWith('execution-failed', {
                payload: jobData,
                retries: 0,
            });
        });

        it('should do nothing for unrecognized job names', async () => {
            const job = { id: 'job-6', name: 'unknown-job', data: {} } as any;
            await consumer.process(job);

            expect(mockPrisma.problem.findUnique).not.toHaveBeenCalled();
            expect(mockExecutionService.runTestCases).not.toHaveBeenCalled();
        });
    });
});
