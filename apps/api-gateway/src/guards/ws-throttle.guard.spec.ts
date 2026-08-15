/* eslint-disable */
import { WsException } from '@nestjs/websockets';
import { WsThrottlerGuard } from './ws-throttle.guard';

function makeGuard(increment: jest.Mock) {
    const guard = Object.create(WsThrottlerGuard.prototype) as WsThrottlerGuard;
    (guard as any).storageService = { increment };
    return guard;
}

function makeRequestProps(overrides: Partial<Record<string, any>> = {}) {
    const client = { _socket: { remoteAddress: '127.0.0.1' } };
    return {
        context: {
            switchToWs: () => ({ getClient: () => client }),
        } as any,
        limit: 5,
        ttl: 60_000,
        throttler: { name: 'default' },
        blockDuration: 0,
        getTracker: jest.fn(),
        generateKey: jest.fn(() => 'throttle-key'),
        ...overrides,
    } as any;
}

describe('WsThrottlerGuard', () => {
    it('should allow the request when it is not blocked', async () => {
        const increment = jest.fn().mockResolvedValue({
            totalHits: 1,
            timeToExpire: 60,
            isBlocked: false,
            timeToBlockExpire: 0,
        });
        const guard = makeGuard(increment);
        const requestProps = makeRequestProps();

        const result = await guard.handleRequest(requestProps);

        expect(result).toBe(true);
        expect(increment).toHaveBeenCalledWith('throttle-key', 60_000, 5, 0, 'default');
    });

    it('should throw WsException with throttle details when the client is blocked', async () => {
        const increment = jest.fn().mockResolvedValue({
            totalHits: 6,
            timeToExpire: 30,
            isBlocked: true,
            timeToBlockExpire: 10,
        });
        const guard = makeGuard(increment);
        const requestProps = makeRequestProps();

        await expect(guard.handleRequest(requestProps)).rejects.toThrow(WsException);
    });
});
