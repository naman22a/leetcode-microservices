/* eslint-disable */
import { COMPANIES } from '@leetcode/constants';

jest.mock('@leetcode/types', () => ({}));

import { CompaniesController } from './companies.controller';

jest.mock('../../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

const mockClient = {
    send: jest.fn(),
};

describe('CompaniesController', () => {
    let controller: CompaniesController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new CompaniesController(mockClient as any);
    });

    describe('findAll', () => {
        it('should forward the find-all request', () => {
            mockClient.send.mockReturnValue('sent');

            const result = controller.findAll();

            expect(mockClient.send).toHaveBeenCalledWith(COMPANIES.FIND_ALL, {});
            expect(result).toEqual('sent');
        });
    });

    describe('findOne', () => {
        it('should forward the requested id', () => {
            mockClient.send.mockReturnValue('sent');

            const result = controller.findOne(5);

            expect(mockClient.send).toHaveBeenCalledWith(COMPANIES.FIND_ONE, { id: 5 });
            expect(result).toEqual('sent');
        });
    });

    describe('create', () => {
        it('should sign an internal token and forward the bulk-create payload', () => {
            mockClient.send.mockReturnValue('sent');
            const body = { companies: [{ name: 'Google' }] };

            const result = controller.create(body as any);

            expect(mockClient.send).toHaveBeenCalledWith(COMPANIES.CREATE, {
                internalToken: 'internal-token',
                payload: { dto: body },
            });
            expect(result).toEqual('sent');
        });
    });
});
