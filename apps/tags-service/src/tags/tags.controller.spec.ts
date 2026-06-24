/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { TagsController } from './tags.controller';
import { PrismaService } from '@leetcode/database';

jest.mock('@leetcode/common', () => ({
    InternalAuth: () => () => {},
}));

const mockPrisma = {
    tag: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
    },
};

describe('TagsController', () => {
    let controller: TagsController;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TagsController],
            providers: [{ provide: PrismaService, useValue: mockPrisma }],
        }).compile();

        controller = module.get<TagsController>(TagsController);
    });

    it('controller should exist', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return all tags', async () => {
            const mockTags = [
                { id: 1, name: 'Array' },
                { id: 2, name: 'Dynamic Programming' },
            ];
            mockPrisma.tag.findMany.mockResolvedValue(mockTags);

            const result = await controller.findAll();

            expect(mockPrisma.tag.findMany).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockTags);
        });

        it('should return an empty array when no tags exist', async () => {
            mockPrisma.tag.findMany.mockResolvedValue([]);

            const result = await controller.findAll();

            expect(result).toEqual([]);
        });
    });

    describe('findOne', () => {
        it('should return a tag when found', async () => {
            const mockTag = { id: 1, name: 'Array' };
            mockPrisma.tag.findUnique.mockResolvedValue(mockTag);

            const result = await controller.findOne({ id: 1 });

            expect(mockPrisma.tag.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result).toEqual(mockTag);
        });

        it('should return an error object when tag is not found', async () => {
            mockPrisma.tag.findUnique.mockResolvedValue(null);

            const result = await controller.findOne({ id: 999 });

            expect(result).toEqual({
                ok: false,
                errors: [{ field: 'id', message: 'tag not found' }],
            });
        });
    });

    describe('create', () => {
        it('should bulk create tags and skip duplicates', async () => {
            const payload = { tags: [{ name: 'Array' }, { name: 'Graph' }] };
            mockPrisma.tag.createMany.mockResolvedValue({ count: 2 });

            const result = await controller.create({ payload } as any);

            expect(mockPrisma.tag.createMany).toHaveBeenCalledWith({
                data: payload.tags,
                skipDuplicates: true,
            });
            expect(result).toEqual({ count: 2 });
        });

        it('should return count of 0 when all tags are duplicates', async () => {
            const payload = { tags: [{ name: 'Array' }] };
            mockPrisma.tag.createMany.mockResolvedValue({ count: 0 });

            const result = await controller.create({ payload } as any);

            expect(result).toEqual({ count: 0 });
        });
    });
});
