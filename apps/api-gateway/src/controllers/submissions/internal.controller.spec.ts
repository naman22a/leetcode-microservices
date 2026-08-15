/* eslint-disable */
jest.mock('@leetcode/types', () => ({}));

import { InternalController } from './internal.controller';

describe('InternalController', () => {
    let controller: InternalController;
    let mockSubmissionFacade: { submit: jest.Mock };

    beforeEach(() => {
        mockSubmissionFacade = { submit: jest.fn() };
        controller = new InternalController(mockSubmissionFacade as any);
    });

    describe('submit', () => {
        it('should delegate to the submission facade', async () => {
            const dto = { code: 'print(1)' } as any;
            mockSubmissionFacade.submit.mockResolvedValue({ jobId: '1' });

            const result = await controller.submit(dto);

            expect(mockSubmissionFacade.submit).toHaveBeenCalledWith(dto);
            expect(result).toEqual({ jobId: '1' });
        });
    });
});
