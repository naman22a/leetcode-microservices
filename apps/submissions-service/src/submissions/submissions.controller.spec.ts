/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { of } from 'rxjs';
import { SubmissionsController } from './submissions.controller';
import { PrismaService } from '@leetcode/database';
import { MICROSERVICES } from '@leetcode/constants';

jest.mock('@leetcode/common', () => ({
    InternalAuth: () => () => {},
}));

jest.mock('../redis', () => ({
    redis: { get: jest.fn() },
}));

jest.mock('../metrics/metrics', () => ({
    cacheHits: { inc: jest.fn() },
    dbWriteDuration: { startTimer: jest.fn(() => jest.fn()) },
    duplicateSubmissions: { inc: jest.fn() },
    submissionQueueWaiting: { set: jest.fn() },
    submissionsQueued: { inc: jest.fn() },
    submissionsReceived: { inc: jest.fn() },
}));

import { redis } from '../redis';

const mockPrisma = {
    submission: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
    },
};

const mockExecutionQueue = {
    add: jest.fn(),
    getWaitingCount: jest.fn(),
};

const mockNotificationsQueue = {
    add: jest.fn(),
};

const mockClient = {
    send: jest.fn(),
};

const validPayload = {
    code: 'print(1)',
    language: 'PYTHON',
    socketId: 'socket-1',
    problemId: 1,
    userId: 2,
    idempotencyKey: 'idem-1',
};

describe('SubmissionsController', () => {
    let controller: SubmissionsController;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockExecutionQueue.getWaitingCount.mockResolvedValue(0);
        mockClient.send.mockReturnValue(of({ id: 1 }));

        const module: TestingModule = await Test.createTestingModule({
            controllers: [SubmissionsController],
            providers: [
                { provide: PrismaService, useValue: mockPrisma },
                { provide: getQueueToken('execution-queue'), useValue: mockExecutionQueue },
                { provide: getQueueToken('notifications-queue'), useValue: mockNotificationsQueue },
                { provide: MICROSERVICES.PROBLEMS_SERVICE, useValue: mockClient },
            ],
        }).compile();

        controller = module.get<SubmissionsController>(SubmissionsController);
    });

    it('controller should exist', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return submissions for the given user and problem', async () => {
            const mockSubmissions = [{ id: 1 }, { id: 2 }];
            mockPrisma.submission.findMany.mockResolvedValue(mockSubmissions);

            const result = await controller.findAll({
                payload: { userId: 2, problemId: 1 },
            } as any);

            expect(mockPrisma.submission.findMany).toHaveBeenCalledWith({
                where: { problemId: 1, userId: 2 },
            });
            expect(result).toEqual(mockSubmissions);
        });
    });

    describe('create', () => {
        it('should return a validation error when code is missing', async () => {
            const result = await controller.create({
                payload: { ...validPayload, code: '' },
            } as any);

            expect(result).toEqual({
                jobId: null,
                errors: [{ field: 'code', message: 'code is required' }],
            });
        });

        it('should return a validation error when language is missing', async () => {
            const result = await controller.create({
                payload: { ...validPayload, language: '' },
            } as any);

            expect(result).toEqual({
                jobId: null,
                errors: [{ field: 'language', message: 'language is required' }],
            });
        });

        it('should return a validation error when socketId is missing', async () => {
            const result = await controller.create({
                payload: { ...validPayload, socketId: '' },
            } as any);

            expect(result).toEqual({
                jobId: null,
                errors: [{ field: 'socketId', message: 'socketId is required' }],
            });
        });

        it('should return a validation error when problemId is missing', async () => {
            const result = await controller.create({
                payload: { ...validPayload, problemId: 0 },
            } as any);

            expect(result).toEqual({
                jobId: null,
                errors: [{ field: 'problemId', message: 'problemId is required' }],
            });
        });

        it('should return an error when the problem does not exist', async () => {
            mockClient.send.mockReturnValue(of(null));

            const result = await controller.create({ payload: validPayload } as any);

            expect(result).toEqual({
                jobId: null,
                errors: [{ field: 'problemId', message: 'problem not found' }],
            });
        });

        it('should return a cached accepted submission when all cached results succeed', async () => {
            (redis.get as jest.Mock).mockResolvedValue(
                JSON.stringify([{ success: true, output: 'ok' }]),
            );
            mockPrisma.submission.create.mockResolvedValue({ id: 10 });

            const result = await controller.create({ payload: validPayload } as any);

            expect(mockPrisma.submission.create).toHaveBeenCalledWith({
                data: {
                    code: validPayload.code,
                    language: validPayload.language,
                    problemId: validPayload.problemId,
                    userId: validPayload.userId,
                    status: 'Accepted',
                    idempotencyKey: validPayload.idempotencyKey,
                },
            });
            expect(mockNotificationsQueue.add).toHaveBeenCalledWith('execution-done', {
                results: [{ success: true, output: 'ok' }],
                idempotencyKey: validPayload.idempotencyKey,
            });
            expect(mockExecutionQueue.add).not.toHaveBeenCalled();
            expect(result).toEqual({ jobId: null, cached: true, submissionId: 10 });
        });

        it('should return a cached wrong-answer submission when a cached result fails', async () => {
            (redis.get as jest.Mock).mockResolvedValue(
                JSON.stringify([{ success: true }, { success: false }]),
            );
            mockPrisma.submission.create.mockResolvedValue({ id: 11 });

            const result = await controller.create({ payload: validPayload } as any);

            expect(mockPrisma.submission.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'WrongAnswer' }) }),
            );
            expect(result).toEqual({ jobId: null, cached: true, submissionId: 11 });
        });

        it('should return the existing submission when a cached-path create hits a duplicate idempotency key', async () => {
            (redis.get as jest.Mock).mockResolvedValue(JSON.stringify([{ success: true }]));
            mockPrisma.submission.create.mockRejectedValue({ code: 'P2002' });
            mockPrisma.submission.findFirst.mockResolvedValue({ id: 12 });

            const result = await controller.create({ payload: validPayload } as any);

            expect(mockPrisma.submission.findFirst).toHaveBeenCalledWith({
                where: { userId: validPayload.userId, idempotencyKey: validPayload.idempotencyKey },
            });
            expect(mockNotificationsQueue.add).not.toHaveBeenCalled();
            expect(result).toEqual({ jobId: null, cached: true, submissionId: 12 });
        });

        it('should queue an execution job when there is no cached result', async () => {
            (redis.get as jest.Mock).mockResolvedValue(null);
            mockPrisma.submission.create.mockResolvedValue({ id: 20 });
            mockExecutionQueue.add.mockResolvedValue({ id: 'job-1' });
            mockExecutionQueue.getWaitingCount.mockResolvedValue(3);

            const result = await controller.create({ payload: validPayload } as any);

            expect(mockPrisma.submission.create).toHaveBeenCalledWith({
                data: {
                    code: validPayload.code,
                    language: validPayload.language,
                    problemId: validPayload.problemId,
                    userId: validPayload.userId,
                    status: 'Pending',
                    idempotencyKey: validPayload.idempotencyKey,
                },
            });
            expect(mockExecutionQueue.add).toHaveBeenCalledWith(
                'execute-job',
                {
                    code: validPayload.code,
                    language: validPayload.language,
                    problemId: validPayload.problemId,
                    socketId: validPayload.socketId,
                    userId: validPayload.userId,
                    idempotencyKey: validPayload.idempotencyKey,
                },
                {
                    jobId: validPayload.idempotencyKey,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5000 },
                },
            );
            expect(result).toEqual({ jobId: 'job-1', cached: false, submissionId: 20 });
        });

        it('should return the existing submission when a non-cached create hits a duplicate idempotency key', async () => {
            (redis.get as jest.Mock).mockResolvedValue(null);
            mockPrisma.submission.create.mockRejectedValue({ code: 'P2002' });
            mockPrisma.submission.findFirst.mockResolvedValue({ id: 21 });

            const result = await controller.create({ payload: validPayload } as any);

            expect(mockExecutionQueue.add).not.toHaveBeenCalled();
            expect(result).toEqual({ jobId: null, submissionId: 21 });
        });

        it('should fall through to the non-cached path when redis throws', async () => {
            (redis.get as jest.Mock).mockRejectedValue(new Error('redis down'));
            mockPrisma.submission.create.mockResolvedValue({ id: 30 });
            mockExecutionQueue.add.mockResolvedValue({ id: 'job-2' });

            const result = await controller.create({ payload: validPayload } as any);

            expect(mockPrisma.submission.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'Pending' }) }),
            );
            expect(result).toEqual({ jobId: 'job-2', cached: false, submissionId: 30 });
        });
    });
});
