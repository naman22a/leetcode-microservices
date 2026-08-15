/* eslint-disable */
import { ForbiddenException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { sign } from 'jsonwebtoken';
import { USERS } from '@leetcode/constants';
import { AdminGuard } from './admin.guard';

jest.mock('../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

const ACCESS_TOKEN_SECRET = 'access-secret';

const mockClient = {
    send: jest.fn(),
};

function makeContext(req: any): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => req }),
    } as any;
}

describe('AdminGuard', () => {
    const OLD_ENV = process.env;
    let guard: AdminGuard;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...OLD_ENV, ACCESS_TOKEN_SECRET };
        guard = new AdminGuard(mockClient as any);
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });

    it('should throw UnauthorizedException when no authorization header is present', async () => {
        const req = { headers: {} };

        await expect(guard.canActivate(makeContext(req))).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when the token is invalid', async () => {
        const req = { headers: { authorization: 'Bearer bad-token' } };

        await expect(guard.canActivate(makeContext(req))).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when the user is not an admin', async () => {
        const token = sign({ userId: 1 }, ACCESS_TOKEN_SECRET);
        const req: any = { headers: { authorization: `Bearer ${token}` } };
        mockClient.send.mockReturnValue(of({ id: 1, is_admin: false }));

        await expect(guard.canActivate(makeContext(req))).rejects.toThrow(ForbiddenException);
    });

    it('should allow the request and attach userId when the user is an admin', async () => {
        const token = sign({ userId: 1 }, ACCESS_TOKEN_SECRET);
        const req: any = { headers: { authorization: `Bearer ${token}` } };
        mockClient.send.mockReturnValue(of({ id: 1, is_admin: true }));

        const result = await guard.canActivate(makeContext(req));

        expect(result).toBe(true);
        expect(req.userId).toEqual(1);
        expect(mockClient.send).toHaveBeenCalledWith(USERS.CURRENT, {
            internalToken: 'internal-token',
            payload: { userId: 1 },
        });
    });
});
