/* eslint-disable */
import { SUBMISSIONS } from '@leetcode/constants';
import { EventsGateway } from './events.gateway';

jest.mock('../redis', () => ({
    redis: { get: jest.fn(), set: jest.fn() },
}));

jest.mock('../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

jest.mock('../middleware/ws.middleware', () => ({
    SocketAuthMiddleware: jest.fn(() => 'middleware-fn'),
}));

import { redis } from '../redis';

const mockClient = {
    send: jest.fn(),
};

describe('EventsGateway', () => {
    let gateway: EventsGateway;

    beforeEach(() => {
        jest.clearAllMocks();
        gateway = new EventsGateway(mockClient as any);
    });

    describe('afterInit', () => {
        it('should wire up the socket auth middleware on the default namespace', () => {
            const use = jest.fn();
            const server = { of: jest.fn(() => ({ use })) } as any;

            gateway.afterInit(server);

            expect(server.of).toHaveBeenCalledWith('/');
            expect(use).toHaveBeenCalledWith('middleware-fn');
        });
    });

    describe('handleCreateSubmission', () => {
        function makeSocket(userId = 1) {
            return { request: { userId }, emit: jest.fn() } as any;
        }

        it('should emit cached results directly when a non-pending cache entry exists', async () => {
            (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(['result-a']));
            const socket = makeSocket();

            await gateway.handleCreateSubmission(socket, {
                code: 'print(1)',
                idempotencyKey: 'idem-1',
            } as any);

            expect(redis.get).toHaveBeenCalledWith('idempotency:idem-1');
            expect(socket.emit).toHaveBeenCalledWith('execution-done', { results: ['result-a'] });
            expect(mockClient.send).not.toHaveBeenCalled();
        });

        it('should proceed to submit when the cached entry is still pending', async () => {
            (redis.get as jest.Mock).mockResolvedValue('"pending"');
            const socket = makeSocket(5);
            mockClient.send.mockReturnValue('sent');

            const data = { code: 'print(1)', idempotencyKey: 'idem-2' } as any;
            const result = await gateway.handleCreateSubmission(socket, data);

            expect(redis.set).toHaveBeenCalledWith(
                'idempotency:idem-2',
                '"pending"',
                'EX',
                86400,
                'NX',
            );
            expect(socket.emit).not.toHaveBeenCalled();
            expect(mockClient.send).toHaveBeenCalledWith(SUBMISSIONS.CREATE, {
                internalToken: 'internal-token',
                payload: { ...data, userId: 5 },
            });
            expect(result).toEqual('sent');
        });

        it('should mark the key pending and submit when there is no cached entry', async () => {
            (redis.get as jest.Mock).mockResolvedValue(null);
            const socket = makeSocket(5);
            mockClient.send.mockReturnValue('sent');

            const data = { code: 'print(1)', idempotencyKey: 'idem-3' } as any;
            await gateway.handleCreateSubmission(socket, data);

            expect(redis.set).toHaveBeenCalledWith(
                'idempotency:idem-3',
                '"pending"',
                'EX',
                86400,
                'NX',
            );
            expect(mockClient.send).toHaveBeenCalledWith(SUBMISSIONS.CREATE, {
                internalToken: 'internal-token',
                payload: { ...data, userId: 5 },
            });
        });

        it('should submit directly without touching redis when there is no idempotency key', async () => {
            const socket = makeSocket(5);
            mockClient.send.mockReturnValue('sent');

            const data = { code: 'print(1)' } as any;
            await gateway.handleCreateSubmission(socket, data);

            expect(redis.get).not.toHaveBeenCalled();
            expect(redis.set).not.toHaveBeenCalled();
            expect(mockClient.send).toHaveBeenCalledWith(SUBMISSIONS.CREATE, {
                internalToken: 'internal-token',
                payload: { ...data, userId: 5 },
            });
        });
    });
});
