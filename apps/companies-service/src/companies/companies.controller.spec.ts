/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from './companies.controller';
import { PrismaService } from '@leetcode/database';

const mockPrisma = {
    company: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
    },
};

// Mock the InternalAuth guard so it doesn't block tests
jest.mock('@leetcode/common', () => ({
    InternalAuth: () => () => {},
}));

describe('CompaniesController', () => {
    let controller: CompaniesController;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [CompaniesController],
            providers: [{ provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        controller = module.get<CompaniesController>(CompaniesController);
    });

    it('controller should exist', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return all companies', async () => {
            const mockCompanies = [
                { id: 1, name: 'Google' },
                { id: 2, name: 'Meta' },
            ];
            mockPrisma.company.findMany.mockResolvedValue(mockCompanies);

            const result = await controller.findAll();

            expect(mockPrisma.company.findMany).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockCompanies);
        });

        it('should return an empty array when no companies exist', async () => {
            mockPrisma.company.findMany.mockResolvedValue([]);

            const result = await controller.findAll();

            expect(result).toEqual([]);
        });
    });

    describe('findOne', () => {
        it('should return a company when found', async () => {
            const mockCompany = { id: 1, name: 'Google' };
            mockPrisma.company.findUnique.mockResolvedValue(mockCompany);

            const result = await controller.findOne({ id: 1 });

            expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result).toEqual(mockCompany);
        });

        it('should return an error object when company is not found', async () => {
            mockPrisma.company.findUnique.mockResolvedValue(null);

            const result = await controller.findOne({ id: 999 });

            expect(result).toEqual({
                ok: false,
                errors: [{ field: 'id', message: 'company not found' }],
            });
        });
    });

    describe('create', () => {
        it('should bulk create companies and skip duplicates', async () => {
            const dto = { companies: [{ name: 'Google' }, { name: 'Meta' }] };
            const mockResult = { count: 2 };
            mockPrisma.company.createMany.mockResolvedValue(mockResult);

            const result = await controller.create({
                payload: { dto },
                metadata: { role: 'companies:create' },
            } as any);

            expect(mockPrisma.company.createMany).toHaveBeenCalledWith({
                data: dto.companies,
                skipDuplicates: true,
            });
            expect(result).toEqual(mockResult);
        });

        it('should return count of 0 when all companies are duplicates', async () => {
            const dto = { companies: [{ name: 'Google' }] };
            mockPrisma.company.createMany.mockResolvedValue({ count: 0 });

            const result = await controller.create({
                payload: { dto },
                metadata: { role: 'companies:create' },
            } as any);

            expect(result).toEqual({ count: 0 });
        });
    });
});
