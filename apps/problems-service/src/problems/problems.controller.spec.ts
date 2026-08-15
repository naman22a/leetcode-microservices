/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { PrismaService } from '@leetcode/database';

jest.mock('@leetcode/common', () => ({
    InternalAuth: () => () => {},
}));

const mockPrisma = {
    problem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
    },
};

const mockProblemsService = {
    create: jest.fn(),
    update: jest.fn(),
};

describe('ProblemsController', () => {
    let controller: ProblemsController;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ProblemsController],
            providers: [
                { provide: PrismaService, useValue: mockPrisma },
                { provide: ProblemsService, useValue: mockProblemsService },
            ],
        }).compile();

        controller = module.get<ProblemsController>(ProblemsController);
    });

    it('controller should exist', () => {
        expect(controller).toBeDefined();
    });

    describe('getAllProblems', () => {
        it('should apply defaults for limit, offset and sort when no query params are given', async () => {
            mockPrisma.problem.findMany.mockResolvedValue([]);
            mockPrisma.problem.count.mockResolvedValue(0);

            const result = await controller.getAllProblems({ query: {} });

            expect(mockPrisma.problem.findMany).toHaveBeenCalledWith({
                where: {},
                orderBy: { id: 'asc' },
                skip: 0,
                take: 10,
                include: {
                    problemTags: { select: { tag: true } },
                    testCases: {
                        where: { isActive: true, isSample: true },
                        select: {
                            id: true,
                            input: true,
                            expectedOutput: true,
                            explanation: true,
                            isSample: true,
                            isActive: true,
                        },
                    },
                },
            });
            expect(mockPrisma.problem.count).toHaveBeenCalledWith({ where: {} });
            expect(result).toEqual({ total: 0, limit: 10, offset: 0, data: [] });
        });

        it('should build a name/difficulty filter and custom sort from query params', async () => {
            const mockProblems = [{ id: 1, title: 'Two Sum' }];
            mockPrisma.problem.findMany.mockResolvedValue(mockProblems);
            mockPrisma.problem.count.mockResolvedValue(1);

            const result = await controller.getAllProblems({
                query: {
                    name: 'two',
                    difficulty: 'EASY',
                    sortBy: 'title',
                    sortOrder: 'desc',
                    limit: 5,
                    offset: 10,
                },
            });

            expect(mockPrisma.problem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { title: { contains: 'two', mode: 'insensitive' }, difficulty: 'EASY' },
                    orderBy: { title: 'desc' },
                    skip: 10,
                    take: 5,
                }),
            );
            expect(result).toEqual({ total: 1, limit: 5, offset: 10, data: mockProblems });
        });
    });

    describe('findOneProblem', () => {
        it('should return a problem when found by slug', async () => {
            const mockProblem = { id: 1, slug: 'two-sum' };
            mockPrisma.problem.findUnique.mockResolvedValue(mockProblem);

            const result = await controller.findOneProblem({ slug: 'two-sum' });

            expect(mockPrisma.problem.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { slug: 'two-sum' } }),
            );
            expect(result).toEqual(mockProblem);
        });

        it('should return an error object when the slug is not found', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue(null);

            const result = await controller.findOneProblem({ slug: 'missing' });

            expect(result).toEqual({
                ok: false,
                errors: [{ field: 'slug', message: 'problem not found' }],
            });
        });
    });

    describe('findOneProblemById', () => {
        it('should return a problem when found by id', async () => {
            const mockProblem = { id: 1, slug: 'two-sum' };
            mockPrisma.problem.findUnique.mockResolvedValue(mockProblem);

            const result = await controller.findOneProblemById({ id: 1 });

            expect(mockPrisma.problem.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 1 } }),
            );
            expect(result).toEqual(mockProblem);
        });

        it('should return an error object when the id is not found', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue(null);

            const result = await controller.findOneProblemById({ id: 999 });

            expect(result).toEqual({
                ok: false,
                errors: [{ field: 'id', message: 'problem not found' }],
            });
        });
    });

    describe('createProblem', () => {
        it('should delegate to the problems service', async () => {
            const dto = { title: 'Two Sum' } as any;
            const mockProblem = { id: 1, ...dto };
            mockProblemsService.create.mockResolvedValue(mockProblem);

            const result = await controller.createProblem({
                payload: { userId: 5, dto },
            } as any);

            expect(mockProblemsService.create).toHaveBeenCalledWith({ userId: 5, dto });
            expect(result).toEqual(mockProblem);
        });
    });

    describe('deleteProblem', () => {
        it('should delete a problem and return ok', async () => {
            mockPrisma.problem.delete.mockResolvedValue({ id: 1 });

            const result = await controller.deleteProblem({ payload: { id: 1 } } as any);

            expect(mockPrisma.problem.delete).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result).toEqual({ ok: true });
        });

        it('should return a not-found error when prisma throws P2025', async () => {
            mockPrisma.problem.delete.mockRejectedValue({ code: 'P2025' });

            const result = await controller.deleteProblem({ payload: { id: 999 } } as any);

            expect(result).toEqual({
                ok: false,
                errors: [{ field: 'id', message: 'problem not found' }],
            });
        });

        it('should return ok: false for unexpected errors', async () => {
            mockPrisma.problem.delete.mockRejectedValue(new Error('db down'));

            const result = await controller.deleteProblem({ payload: { id: 1 } } as any);

            expect(result).toEqual({ ok: false });
        });
    });

    describe('updateProblem', () => {
        it('should delegate to the problems service', async () => {
            const dto = { title: 'New title' } as any;
            const mockProblem = { id: 1, ...dto };
            mockProblemsService.update.mockResolvedValue(mockProblem);

            const result = await controller.updateProblem({
                payload: { id: 1, dto },
            } as any);

            expect(mockProblemsService.update).toHaveBeenCalledWith(1, dto);
            expect(result).toEqual(mockProblem);
        });
    });
});
