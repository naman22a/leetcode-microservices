/* eslint-disable */
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { AuthGuard } from './auth.guard';

const ACCESS_TOKEN_SECRET = 'access-secret';

function makeContext(req: any): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => req }),
    } as any;
}

describe('AuthGuard', () => {
    const OLD_ENV = process.env;
    let guard: AuthGuard;

    beforeEach(() => {
        process.env = { ...OLD_ENV, ACCESS_TOKEN_SECRET };
        guard = new AuthGuard();
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });

    it('should throw UnauthorizedException when no authorization header is present', () => {
        const req = { headers: {} };

        expect(() => guard.canActivate(makeContext(req))).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when the token is invalid', () => {
        const req = { headers: { authorization: 'Bearer not-a-real-token' } };

        expect(() => guard.canActivate(makeContext(req))).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when the token was signed with a different secret', () => {
        const token = sign({ userId: 1 }, 'wrong-secret');
        const req = { headers: { authorization: `Bearer ${token}` } };

        expect(() => guard.canActivate(makeContext(req))).toThrow(UnauthorizedException);
    });

    it('should allow the request and attach userId when the token is valid', () => {
        const token = sign({ userId: 42 }, ACCESS_TOKEN_SECRET);
        const req: any = { headers: { authorization: `Bearer ${token}` } };

        const result = guard.canActivate(makeContext(req));

        expect(result).toBe(true);
        expect(req.userId).toEqual(42);
    });
});
