/* eslint-disable */
import { USERS } from '@leetcode/constants';
import { of } from 'rxjs';
import { UsersController } from './users.controller';

jest.mock('../../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

const mockClient = {
    send: jest.fn(),
};

describe('UsersController', () => {
    let controller: UsersController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new UsersController(mockClient as any);
    });

    describe('getUsers', () => {
        it('should sign an internal token and forward the current user id', () => {
            mockClient.send.mockReturnValue('sent');
            const req = { userId: 1 } as any;

            const result = controller.getUsers(req);

            expect(mockClient.send).toHaveBeenCalledWith(USERS.FIND_ALL, {
                internalToken: 'internal-token',
                payload: { userId: 1 },
            });
            expect(result).toEqual('sent');
        });
    });

    describe('getMe', () => {
        it('should sign an internal token and forward the current user id', () => {
            mockClient.send.mockReturnValue('sent');
            const req = { userId: 1 } as any;

            const result = controller.getMe(req);

            expect(mockClient.send).toHaveBeenCalledWith(USERS.CURRENT, {
                internalToken: 'internal-token',
                payload: { userId: 1 },
            });
            expect(result).toEqual('sent');
        });
    });

    describe('getOneUser', () => {
        it('should resolve the observable and forward the requested id and current user id', async () => {
            mockClient.send.mockReturnValue(of({ id: 2, username: 'other' }));
            const req = { userId: 1 } as any;

            const result = await controller.getOneUser(2, req);

            expect(mockClient.send).toHaveBeenCalledWith(USERS.FIND_ONE, {
                internalToken: 'internal-token',
                payload: { id: 2, userId: 1 },
            });
            expect(result).toEqual({ id: 2, username: 'other' });
        });
    });

    describe('updateUser', () => {
        it('should sign an internal token and forward the current user id and update body', () => {
            mockClient.send.mockReturnValue('sent');
            const req = { userId: 1 } as any;
            const body = { bio: 'new bio' } as any;

            const result = controller.updateUser(req, body);

            expect(mockClient.send).toHaveBeenCalledWith(USERS.UPDATE, {
                internalToken: 'internal-token',
                payload: { userId: 1, body },
            });
            expect(result).toEqual('sent');
        });
    });
});
