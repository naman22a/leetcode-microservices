/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ResultsConsumer } from './submissions.worker';
import { PrismaService } from '@leetcode/database';

const mockPrisma = {
    submission: {
        update: jest.fn(),
    },
};

const mockNotificationsQueue = {
    add: jest.fn(),
};

describe('ResultsConsumer', () => {
    let consumer: ResultsConsumer;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResultsConsumer,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: getQueueToken('notifications-queue'), useValue: mockNotificationsQueue },
            ],
        }).compile();

        consumer = module.get<ResultsConsumer>(ResultsConsumer);
    });

    it('consumer should exist', () => {
        expect(consumer).toBeDefined();
    });

    describe('process', () => {
        it('should mark the submission accepted when all results succeed', async () => {
            mockPrisma.submission.update.mockResolvedValue({ id: 1 });

            const job = {
                name: 'result-job',
                data: {
                    results: [{ success: true, output: 'ok' }],
                    userId: 2,
                    idempotencyKey: 'idem-1',
                },
            } as any;

            await consumer.process(job);

            expect(mockPrisma.submission.update).toHaveBeenCalledWith({
                where: { userId_idempotencyKey: { userId: 2, idempotencyKey: 'idem-1' } },
                data: { status: 'Accepted' },
            });
            expect(mockNotificationsQueue.add).toHaveBeenCalledWith('execution-done', {
                results: [{ success: true, output: 'ok' }],
                idempotencyKey: 'idem-1',
            });
        });

        it('should mark the submission wrong-answer when a result fails', async () => {
            mockPrisma.submission.update.mockResolvedValue({ id: 1 });

            const job = {
                name: 'result-job',
                data: {
                    results: [{ success: true }, { success: false }],
                    userId: 2,
                    idempotencyKey: 'idem-2',
                },
            } as any;

            await consumer.process(job);

            expect(mockPrisma.submission.update).toHaveBeenCalledWith({
                where: { userId_idempotencyKey: { userId: 2, idempotencyKey: 'idem-2' } },
                data: { status: 'WrongAnswer' },
            });
        });

        it('should still queue the notification when the database update fails', async () => {
            mockPrisma.submission.update.mockRejectedValue(new Error('db down'));

            const job = {
                name: 'result-job',
                data: {
                    results: [{ success: true }],
                    userId: 2,
                    idempotencyKey: 'idem-3',
                },
            } as any;

            await consumer.process(job);

            expect(mockNotificationsQueue.add).toHaveBeenCalledWith('execution-done', {
                results: [{ success: true }],
                idempotencyKey: 'idem-3',
            });
        });

        it('should do nothing for unrecognized job names', async () => {
            const job = { name: 'unknown-job', data: {} } as any;

            await consumer.process(job);

            expect(mockPrisma.submission.update).not.toHaveBeenCalled();
            expect(mockNotificationsQueue.add).not.toHaveBeenCalled();
        });
    });
});
