/* eslint-disable */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProblemsService } from './problems.service';
import { PrismaService } from '@leetcode/database';

const mockTx = {
    problem: {
        update: jest.fn(),
        findUnique: jest.fn(),
    },
    problemTag: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
    },
    problemCompany: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
    },
    testCase: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
    },
};

const mockPrisma = {
    problem: {
        create: jest.fn(),
        findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: typeof mockTx) => any) => cb(mockTx)),
};

describe('ProblemsService', () => {
    let service: ProblemsService;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockTx) => any) => cb(mockTx));

        const module: TestingModule = await Test.createTestingModule({
            providers: [ProblemsService, { provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        service = module.get<ProblemsService>(ProblemsService);
    });

    it('service should exist', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a problem with no tags, companies, or test cases', async () => {
            const dto = {
                title: 'Two Sum',
                slug: 'two-sum',
                description: 'desc',
                difficulty: 'EASY',
            } as any;
            const mockProblem = { id: 1, ...dto };
            mockPrisma.problem.create.mockResolvedValue(mockProblem);

            const result = await service.create({ userId: 5, dto });

            expect(mockPrisma.problem.create).toHaveBeenCalledWith({
                data: {
                    createdById: 5,
                    title: 'Two Sum',
                    slug: 'two-sum',
                    description: 'desc',
                    difficulty: 'EASY',
                    problemTags: undefined,
                    problemCompanies: undefined,
                    testCases: undefined,
                },
                include: {
                    problemTags: { include: { tag: true } },
                    problemCompanies: { include: { company: true } },
                    testCases: true,
                },
            });
            expect(result).toEqual(mockProblem);
        });

        it('should build nested create payloads for tags, companies, and test cases', async () => {
            const dto = {
                title: 'Two Sum',
                slug: 'two-sum',
                description: 'desc',
                difficulty: 'EASY',
                problemTags: [{ tagId: 1 }, { tagId: 2 }],
                problemCompanies: [{ companyId: 3, frequency: 2, lastAskedDate: '2024-01-01' }],
                testCases: [{ input: 'in', expectedOutput: 'out', isSample: true, isActive: false }],
            } as any;
            mockPrisma.problem.create.mockResolvedValue({ id: 1 });

            await service.create({ userId: 5, dto });

            expect(mockPrisma.problem.create).toHaveBeenCalledWith({
                data: {
                    createdById: 5,
                    title: 'Two Sum',
                    slug: 'two-sum',
                    description: 'desc',
                    difficulty: 'EASY',
                    problemTags: {
                        create: [{ tag: { connect: { id: 1 } } }, { tag: { connect: { id: 2 } } }],
                    },
                    problemCompanies: {
                        create: [
                            {
                                company: { connect: { id: 3 } },
                                frequency: 2,
                                lastAskedDate: new Date('2024-01-01'),
                            },
                        ],
                    },
                    testCases: {
                        create: [
                            {
                                input: 'in',
                                expectedOutput: 'out',
                                isSample: true,
                                isActive: false,
                                explanation: undefined,
                            },
                        ],
                    },
                },
                include: {
                    problemTags: { include: { tag: true } },
                    problemCompanies: { include: { company: true } },
                    testCases: true,
                },
            });
        });

        it('should default company frequency and test case flags when omitted', async () => {
            const dto = {
                title: 'Two Sum',
                slug: 'two-sum',
                description: 'desc',
                difficulty: 'EASY',
                problemCompanies: [{ companyId: 3 }],
                testCases: [{ input: 'in', expectedOutput: 'out' }],
            } as any;
            mockPrisma.problem.create.mockResolvedValue({ id: 1 });

            await service.create({ userId: 5, dto });

            const callArgs = mockPrisma.problem.create.mock.calls[0][0];
            expect(callArgs.data.problemCompanies).toEqual({
                create: [
                    {
                        company: { connect: { id: 3 } },
                        frequency: 1,
                        lastAskedDate: undefined,
                    },
                ],
            });
            expect(callArgs.data.testCases).toEqual({
                create: [
                    {
                        input: 'in',
                        expectedOutput: 'out',
                        isSample: false,
                        isActive: true,
                        explanation: undefined,
                    },
                ],
            });
        });
    });

    describe('update', () => {
        it('should throw NotFoundException when the problem does not exist', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue(null);

            await expect(service.update(1, { title: 'New' } as any)).rejects.toThrow(
                NotFoundException,
            );
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });

        it('should update problem fields without touching relations when none are provided', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue({ id: 1 });
            const updatedProblem = { id: 1, title: 'New' };
            mockTx.problem.findUnique.mockResolvedValue(updatedProblem);

            const result = await service.update(1, { title: 'New' } as any);

            expect(mockTx.problem.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { title: 'New' },
            });
            expect(mockTx.problemTag.deleteMany).not.toHaveBeenCalled();
            expect(mockTx.problemCompany.deleteMany).not.toHaveBeenCalled();
            expect(mockTx.testCase.deleteMany).not.toHaveBeenCalled();
            expect(result).toEqual(updatedProblem);
        });

        it('should replace tags, companies, and test cases when provided', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue({ id: 1 });
            mockTx.problem.findUnique.mockResolvedValue({ id: 1 });

            const dto = {
                problemTags: [{ tagId: 1 }],
                problemCompanies: [{ companyId: 2, frequency: 3, lastAskedDate: '2024-01-01' }],
                testCases: [{ input: 'in', expectedOutput: 'out', isSample: true, isActive: true }],
            } as any;

            await service.update(1, dto);

            expect(mockTx.problemTag.deleteMany).toHaveBeenCalledWith({ where: { problemId: 1 } });
            expect(mockTx.problemTag.createMany).toHaveBeenCalledWith({
                data: [{ problemId: 1, tagId: 1 }],
            });

            expect(mockTx.problemCompany.deleteMany).toHaveBeenCalledWith({
                where: { problemId: 1 },
            });
            expect(mockTx.problemCompany.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        problemId: 1,
                        companyId: 2,
                        frequency: 3,
                        lastAskedDate: new Date('2024-01-01'),
                    },
                ],
            });

            expect(mockTx.testCase.deleteMany).toHaveBeenCalledWith({ where: { problemId: 1 } });
            expect(mockTx.testCase.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        problemId: 1,
                        input: 'in',
                        expectedOutput: 'out',
                        isSample: true,
                        isActive: true,
                        explanation: undefined,
                    },
                ],
            });
        });

        it('should clear relations without recreating them when empty arrays are provided', async () => {
            mockPrisma.problem.findUnique.mockResolvedValue({ id: 1 });
            mockTx.problem.findUnique.mockResolvedValue({ id: 1 });

            await service.update(1, { problemTags: [], problemCompanies: [], testCases: [] } as any);

            expect(mockTx.problemTag.deleteMany).toHaveBeenCalledWith({ where: { problemId: 1 } });
            expect(mockTx.problemTag.createMany).not.toHaveBeenCalled();

            expect(mockTx.problemCompany.deleteMany).toHaveBeenCalledWith({ where: { problemId: 1 } });
            expect(mockTx.problemCompany.createMany).not.toHaveBeenCalled();

            expect(mockTx.testCase.deleteMany).toHaveBeenCalledWith({ where: { problemId: 1 } });
            expect(mockTx.testCase.createMany).not.toHaveBeenCalled();
        });
    });
});
