/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ExecutionDLQConsumer } from './execution-dlq.worker';

const mockExecutionQueue = { add: jest.fn() };

describe('ExecutionDLQConsumer', () => {
    let consumer: ExecutionDLQConsumer;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExecutionDLQConsumer,
                { provide: getQueueToken('execution-queue'), useValue: mockExecutionQueue },
            ],
        }).compile();

        consumer = module.get<ExecutionDLQConsumer>(ExecutionDLQConsumer);
    });

    it('consumer should exist', () => {
        expect(consumer).toBeDefined();
    });

    describe('process', () => {
        it('should retry the job once when retries is below 1', async () => {
            const job = { id: 'job-1', data: { payload: { foo: 'bar' }, retries: 0 } } as any;

            await consumer.process(job);

            expect(mockExecutionQueue.add).toHaveBeenCalledWith(
                'execute-job',
                { foo: 'bar' },
                { attempts: 1 },
            );
        });

        it('should default retries to 0 and retry when the field is missing', async () => {
            const job = { id: 'job-2', data: { payload: { foo: 'bar' } } } as any;

            await consumer.process(job);

            expect(mockExecutionQueue.add).toHaveBeenCalledWith(
                'execute-job',
                { foo: 'bar' },
                { attempts: 1 },
            );
        });

        it('should not retry and treat the job as a final failure once retries reach 1', async () => {
            const job = { id: 'job-3', data: { payload: { foo: 'bar' }, retries: 1 } } as any;

            await consumer.process(job);

            expect(mockExecutionQueue.add).not.toHaveBeenCalled();
        });
    });
});
