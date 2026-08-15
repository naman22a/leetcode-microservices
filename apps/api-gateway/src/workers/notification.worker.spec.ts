/* eslint-disable */
import { NotificationConsumer } from './notification.worker';

jest.mock('../redis', () => ({
    redis: { set: jest.fn() },
}));

import { redis } from '../redis';

describe('NotificationConsumer', () => {
    let consumer: NotificationConsumer;
    let mockEventsGateway: { server: { emit: jest.Mock } };

    beforeEach(() => {
        jest.clearAllMocks();
        mockEventsGateway = { server: { emit: jest.fn() } };
        consumer = new NotificationConsumer(mockEventsGateway as any);
    });

    describe('process', () => {
        it('should cache the results and emit them when an idempotencyKey is present', async () => {
            const data = { results: [{ success: true, output: 'ok' }], idempotencyKey: 'idem-1' };
            const job = { name: 'execution-done', data } as any;

            await consumer.process(job);

            expect(redis.set).toHaveBeenCalledWith(
                'idempotency:idem-1',
                JSON.stringify(data),
                'EX',
                86400,
            );
            expect(mockEventsGateway.server.emit).toHaveBeenCalledWith(
                'execution-done',
                data.results,
            );
        });

        it('should emit results without touching redis when there is no idempotencyKey', async () => {
            const data = { results: [{ success: false, output: 'nope' }] };
            const job = { name: 'execution-done', data } as any;

            await consumer.process(job);

            expect(redis.set).not.toHaveBeenCalled();
            expect(mockEventsGateway.server.emit).toHaveBeenCalledWith(
                'execution-done',
                data.results,
            );
        });

        it('should do nothing for unrecognized job names', async () => {
            const job = { name: 'unknown-job', data: {} } as any;

            await consumer.process(job);

            expect(redis.set).not.toHaveBeenCalled();
            expect(mockEventsGateway.server.emit).not.toHaveBeenCalled();
        });
    });
});
