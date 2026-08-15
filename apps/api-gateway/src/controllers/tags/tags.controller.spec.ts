/* eslint-disable */
import { TAGS } from '@leetcode/constants';

jest.mock('@leetcode/types', () => ({}));

import { TagsController } from './tags.controller';

jest.mock('../../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

const mockClient = {
    send: jest.fn(),
};

describe('TagsController', () => {
    let controller: TagsController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TagsController(mockClient as any);
    });

    describe('findAllTags', () => {
        it('should forward the find-all request', () => {
            mockClient.send.mockReturnValue('sent');

            const result = controller.findAllTags();

            expect(mockClient.send).toHaveBeenCalledWith(TAGS.FIND_ALL, {});
            expect(result).toEqual('sent');
        });
    });

    describe('findOneTag', () => {
        it('should forward the requested id', () => {
            mockClient.send.mockReturnValue('sent');

            const result = controller.findOneTag(3);

            expect(mockClient.send).toHaveBeenCalledWith(TAGS.FIND_ONE, { id: 3 });
            expect(result).toEqual('sent');
        });
    });

    describe('createTag', () => {
        it('should sign an internal token and forward the bulk-create payload', () => {
            mockClient.send.mockReturnValue('sent');
            const body = { tags: [{ name: 'Array' }] };

            const result = controller.createTag(body as any);

            expect(mockClient.send).toHaveBeenCalledWith(TAGS.CREATE, {
                internalToken: 'internal-token',
                payload: body,
            });
            expect(result).toEqual('sent');
        });
    });
});
