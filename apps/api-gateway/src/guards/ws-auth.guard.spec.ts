/* eslint-disable */
import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { sign } from 'jsonwebtoken';
import { WsAuthGuard } from './ws-auth.guard';

const ACCESS_TOKEN_SECRET = 'access-secret';

function makeWsContext(socket: any): ExecutionContext {
    return {
        getType: () => 'ws',
        switchToWs: () => ({ getClient: () => socket }),
    } as any;
}

describe('WsAuthGuard', () => {
    const OLD_ENV = process.env;
    let guard: WsAuthGuard;

    beforeEach(() => {
        process.env = { ...OLD_ENV, ACCESS_TOKEN_SECRET };
        guard = new WsAuthGuard();
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });

    describe('canActivate', () => {
        it('should allow non-websocket contexts through without checking the socket', () => {
            const context = {
                getType: () => 'http',
                switchToWs: () => {
                    throw new Error('should not be called');
                },
            } as any;

            expect(guard.canActivate(context)).toBe(true);
        });

        it('should throw WsException when the socket has no authorization header', () => {
            const socket = { request: { headers: {} } };

            expect(() => guard.canActivate(makeWsContext(socket))).toThrow(WsException);
        });

        it('should throw WsException when the token is invalid', () => {
            const socket = { request: { headers: { authorization: 'Bearer bad-token' } } };

            expect(() => guard.canActivate(makeWsContext(socket))).toThrow(WsException);
        });

        it('should allow the connection and attach userId when the token is valid', () => {
            const token = sign({ userId: 7 }, ACCESS_TOKEN_SECRET);
            const socket: any = { request: { headers: { authorization: `Bearer ${token}` } } };

            const result = guard.canActivate(makeWsContext(socket));

            expect(result).toBe(true);
            expect(socket.request.userId).toEqual(7);
        });
    });

    describe('validateRequest', () => {
        it('should throw WsException for a socket with no request', () => {
            const socket = { request: { headers: {} } } as any;

            expect(() => WsAuthGuard.validateRequest(socket)).toThrow(WsException);
        });

        it('should return true and attach userId for a valid token', () => {
            const token = sign({ userId: 9 }, ACCESS_TOKEN_SECRET);
            const socket: any = { request: { headers: { authorization: `Bearer ${token}` } } };

            expect(WsAuthGuard.validateRequest(socket)).toBe(true);
            expect(socket.request.userId).toEqual(9);
        });
    });
});
