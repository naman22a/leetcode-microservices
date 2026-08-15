/* eslint-disable */
import { PROBLEMS } from '@leetcode/constants';

jest.mock('@leetcode/types', () => ({}));

import { ProblemsController } from './problems.controller';

jest.mock('../../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

const mockClient = {
    send: jest.fn(),
};

describe('ProblemsController', () => {
    let controller: ProblemsController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProblemsController(mockClient as any);
    });

    describe('getProblems', () => {
        it('should forward the query as-is', () => {
            mockClient.send.mockReturnValue('sent');
            const query = { limit: '10', offset: '0' };

            const result = controller.getProblems(query as any);

            expect(mockClient.send).toHaveBeenCalledWith(PROBLEMS.FIND_ALL, { query });
            expect(result).toEqual('sent');
        });
    });

    describe('getOneProblem', () => {
        it('should forward the requested slug', () => {
            mockClient.send.mockReturnValue('sent');

            const result = controller.getOneProblem('two-sum');

            expect(mockClient.send).toHaveBeenCalledWith(PROBLEMS.FIND_ONE, { slug: 'two-sum' });
            expect(result).toEqual('sent');
        });
    });

    describe('createProblem', () => {
        it('should sign an internal token and forward the creator id and dto', async () => {
            mockClient.send.mockReturnValue('sent');
            const req = { userId: 7 } as any;
            const body = { title: 'Two Sum' } as any;

            const result = await controller.createProblem(req, body);

            expect(mockClient.send).toHaveBeenCalledWith(PROBLEMS.CREATE, {
                internalToken: 'internal-token',
                payload: { userId: 7, dto: body },
            });
            expect(result).toEqual('sent');
        });
    });

    describe('deleteOneProblem', () => {
        it('should sign an internal token and forward the id to delete', () => {
            mockClient.send.mockReturnValue('sent');

            const result = controller.deleteOneProblem(4);

            expect(mockClient.send).toHaveBeenCalledWith(PROBLEMS.DELETE, {
                internalToken: 'internal-token',
                payload: { id: 4 },
            });
            expect(result).toEqual('sent');
        });
    });

    describe('updateProblem', () => {
        it('should sign an internal token and forward the id and update dto', () => {
            mockClient.send.mockReturnValue('sent');
            const dto = { title: 'New title' } as any;

            const result = controller.updateProblem(4, dto);

            expect(mockClient.send).toHaveBeenCalledWith(PROBLEMS.UPDATE, {
                internalToken: 'internal-token',
                payload: { id: 4, dto },
            });
            expect(result).toEqual('sent');
        });
    });
});
