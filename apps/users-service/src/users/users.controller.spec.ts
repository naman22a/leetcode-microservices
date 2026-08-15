/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { PrismaService } from '@leetcode/database';

jest.mock('@leetcode/common', () => ({
    InternalAuth: () => () => {},
}));

const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    },
};

describe('UsersController', () => {
    let controller: UsersController;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [{ provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        controller = module.get<UsersController>(UsersController);
    });

    it('controller should exist', () => {
        expect(controller).toBeDefined();
    });

    describe('find', () => {
        it('should return the current user followed by other users', async () => {
            const currentUser = { id: 1, username: 'me' };
            const otherUsers = [
                { id: 2, username: 'other1' },
                { id: 3, username: 'other2' },
            ];
            mockPrisma.user.findUnique.mockResolvedValue(currentUser);
            mockPrisma.user.findMany.mockResolvedValue(otherUsers);

            const result = await controller.find({ payload: { userId: 1 } } as any);

            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                omit: { password: true, emailVerfied: true, tokenVersion: true },
            });
            expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
                where: { id: { not: 1 } },
                omit: {
                    password: true,
                    emailVerfied: true,
                    tokenVersion: true,
                    email: true,
                },
            });
            expect(result).toEqual([currentUser, ...otherUsers]);
        });

        it('should return only the current user when no other users exist', async () => {
            const currentUser = { id: 1, username: 'me' };
            mockPrisma.user.findUnique.mockResolvedValue(currentUser);
            mockPrisma.user.findMany.mockResolvedValue([]);

            const result = await controller.find({ payload: { userId: 1 } } as any);

            expect(result).toEqual([currentUser]);
        });
    });

    describe('me', () => {
        it('should return the current user', async () => {
            const currentUser = { id: 1, username: 'me' };
            mockPrisma.user.findUnique.mockResolvedValue(currentUser);

            const result = await controller.me({ payload: { userId: 1 } } as any);

            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                omit: { password: true, emailVerfied: true, tokenVersion: true },
            });
            expect(result).toEqual(currentUser);
        });

        it('should return null when the current user is not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const result = await controller.me({ payload: { userId: 999 } } as any);

            expect(result).toBeNull();
        });
    });

    describe('findOne', () => {
        it('should include email when the requested id matches the current user', async () => {
            const user = { id: 1, username: 'me', email: 'me@example.com' };
            mockPrisma.user.findUnique.mockResolvedValue(user);

            const result = await controller.findOne({ payload: { id: 1, userId: 1 } } as any);

            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                omit: { password: true, emailVerfied: true, tokenVersion: true },
            });
            expect(result).toEqual(user);
        });

        it('should omit email when the requested id differs from the current user', async () => {
            const user = { id: 2, username: 'other' };
            mockPrisma.user.findUnique.mockResolvedValue(user);

            const result = await controller.findOne({ payload: { id: 2, userId: 1 } } as any);

            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 2 },
                omit: { email: true, password: true, emailVerfied: true, tokenVersion: true },
            });
            expect(result).toEqual(user);
        });

        it('should return an error object when the other user is not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const result = await controller.findOne({ payload: { id: 999, userId: 1 } } as any);

            expect(result).toEqual({
                ok: false,
                errors: [{ field: 'id', message: 'user not found' }],
            });
        });
    });

    describe('updateOne', () => {
        it('should return an error when no body is provided', async () => {
            const result = await controller.updateOne({ payload: { userId: 1, body: undefined } } as any);

            expect(result).toEqual({
                ok: false,
                errors: [{ field: 'all', message: 'atleast provide one field' }],
            });
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
        });

        it('should return an error when the requested username is already taken', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 2, username: 'taken' });

            const result = await controller.updateOne({
                payload: { userId: 1, body: { username: 'taken' } },
            } as any);

            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { username: 'taken' },
            });
            expect(result).toEqual({
                ok: false,
                errors: [{ field: 'username', message: 'username already taken' }],
            });
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
        });

        it('should update the user when the username is available', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            mockPrisma.user.update.mockResolvedValue({ id: 1, username: 'newname' });

            const body = { username: 'newname' };
            const result = await controller.updateOne({ payload: { userId: 1, body } } as any);

            expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 1 }, data: body });
            expect(result).toEqual({ ok: true });
        });

        it('should update the user without checking username when username is not being changed', async () => {
            mockPrisma.user.update.mockResolvedValue({ id: 1, bio: 'new bio' });

            const body = { bio: 'new bio' };
            const result = await controller.updateOne({ payload: { userId: 1, body } } as any);

            expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
            expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 1 }, data: body });
            expect(result).toEqual({ ok: true });
        });
    });
});
