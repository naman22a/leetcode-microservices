/* eslint-disable */
import { SUBMISSIONS } from '@leetcode/constants';
import { SubmissionsController } from './submissions.controller';

jest.mock('../../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

const mockClient = {
    send: jest.fn(),
};

describe('SubmissionsController', () => {
    let controller: SubmissionsController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new SubmissionsController(mockClient as any);
    });

    describe('findAll', () => {
        it('should sign an internal token and forward the current user and problem id', () => {
            mockClient.send.mockReturnValue('sent');
            const req = { userId: 9 } as any;

            const result = controller.findAll(req, 3);

            expect(mockClient.send).toHaveBeenCalledWith(SUBMISSIONS.FIND_ALL, {
                internalToken: 'internal-token',
                payload: { userId: 9, problemId: 3 },
            });
            expect(result).toEqual('sent');
        });
    });
});
