/* eslint-disable */
import { AUTH, COOKIE_NAME } from '@leetcode/constants';
import { of } from 'rxjs';
import { AuthController } from './auth.controller';

jest.mock('../../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

const mockClient = {
    send: jest.fn(),
};

function makeRes() {
    return { cookie: jest.fn(), clearCookie: jest.fn() } as any;
}

describe('AuthController', () => {
    let controller: AuthController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new AuthController(mockClient as any);
    });

    describe('register', () => {
        it('should forward the registration payload', async () => {
            mockClient.send.mockReturnValue('sent');
            const body = { username: 'a', email: 'a@a.com', password: 'password123' };

            const result = await controller.register(body as any);

            expect(mockClient.send).toHaveBeenCalledWith(AUTH.REGISTER, body);
            expect(result).toEqual('sent');
        });
    });

    describe('confirmEmail', () => {
        it('should forward the confirmation token', async () => {
            mockClient.send.mockReturnValue('sent');

            const result = await controller.confirmEmail('a-token');

            expect(mockClient.send).toHaveBeenCalledWith(AUTH.CONFIRM_EMAIL, 'a-token');
            expect(result).toEqual('sent');
        });
    });

    describe('login', () => {
        it('should set the refresh-token cookie and return the access token on success', async () => {
            mockClient.send.mockReturnValue(
                of({ accessToken: 'access', refreshToken: 'refresh', errors: undefined }),
            );
            const res = makeRes();

            const result = await controller.login(
                { email: 'a@a.com', password: 'pw' } as any,
                res,
            );

            expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, 'refresh', {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
            });
            expect(result).toEqual({ accessToken: 'access' });
        });

        it('should return errors without setting a cookie on failed login', async () => {
            mockClient.send.mockReturnValue(
                of({ accessToken: null, refreshToken: null, errors: [{ field: 'email' }] }),
            );
            const res = makeRes();

            const result = await controller.login(
                { email: 'a@a.com', password: 'wrong' } as any,
                res,
            );

            expect(res.cookie).not.toHaveBeenCalled();
            expect(result).toEqual({ accessToken: null, errors: [{ field: 'email' }] });
        });
    });

    describe('logout', () => {
        it('should clear the refresh-token cookie and forward the internal token', async () => {
            mockClient.send.mockReturnValue(of({ ok: true }));
            const res = makeRes();

            const result = await controller.logout(res);

            expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_NAME);
            expect(mockClient.send).toHaveBeenCalledWith(AUTH.LOGOUT, {
                internalToken: 'internal-token',
            });
            expect(result).toEqual({ ok: true });
        });
    });

    describe('refreshToken', () => {
        it('should set a new refresh-token cookie and return the access token on success', async () => {
            mockClient.send.mockReturnValue(
                of({ accessToken: 'access2', refreshToken: 'refresh2', errors: undefined }),
            );
            const req = { cookies: { [COOKIE_NAME]: 'old-refresh' } } as any;
            const res = makeRes();

            const result = await controller.refreshToken(req, res);

            expect(mockClient.send).toHaveBeenCalledWith(AUTH.REFRESH_TOKEN, {
                token: 'old-refresh',
            });
            expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, 'refresh2', {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
            });
            expect(result).toEqual({ accessToken: 'access2' });
        });

        it('should return errors without setting a cookie when the refresh token is invalid', async () => {
            mockClient.send.mockReturnValue(
                of({ accessToken: null, refreshToken: null, errors: [{ field: 'token' }] }),
            );
            const req = { cookies: {} } as any;
            const res = makeRes();

            const result = await controller.refreshToken(req, res);

            expect(res.cookie).not.toHaveBeenCalled();
            expect(result).toEqual({ accessToken: null, errors: [{ field: 'token' }] });
        });
    });

    describe('forgotPassword', () => {
        it('should forward the email', async () => {
            mockClient.send.mockReturnValue('sent');

            const result = await controller.forgotPassword({ email: 'a@a.com' } as any);

            expect(mockClient.send).toHaveBeenCalledWith(AUTH.FORGOT_PASSWORD, {
                email: 'a@a.com',
            });
            expect(result).toEqual('sent');
        });
    });

    describe('resetPassword', () => {
        it('should forward the token and new password', async () => {
            mockClient.send.mockReturnValue('sent');

            const result = await controller.resetPassword('a-token', {
                password: 'newpassword',
            } as any);

            expect(mockClient.send).toHaveBeenCalledWith(AUTH.RESET_PASSWORD, {
                token: 'a-token',
                password: 'newpassword',
            });
            expect(result).toEqual('sent');
        });
    });
});
