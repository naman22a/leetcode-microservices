/* eslint-disable */
import { SUBMISSIONS } from '@leetcode/constants';
import { SubmissionFacade } from './submissionFacade.service';

jest.mock('../redis', () => ({
    redis: { get: jest.fn(), set: jest.fn() },
}));

jest.mock('../utils', () => ({
    signInternalToken: jest.fn(() => 'internal-token'),
}));

import { redis } from '../redis';

const mockClient = {
    send: jest.fn(),
};

describe('SubmissionFacade', () => {
    let facade: SubmissionFacade;

    beforeEach(() => {
        jest.clearAllMocks();
        facade = new SubmissionFacade(mockClient as any);
    });

    it('should return the cached result without contacting the submissions service', async () => {
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify({ results: ['ok'] }));

        const result = await facade.submit({ idempotencyKey: 'idem-1' } as any);

        expect(redis.get).toHaveBeenCalledWith('idempotency:idem-1');
        expect(mockClient.send).not.toHaveBeenCalled();
        expect(result).toEqual({ results: ['ok'] });
    });

    it('should proceed to the submissions service when the cached value is still pending', async () => {
        (redis.get as jest.Mock).mockResolvedValue('"pending"');
        mockClient.send.mockReturnValue('sent');

        const dto = { idempotencyKey: 'idem-2', code: 'print(1)' } as any;
        const result = await facade.submit(dto);

        expect(redis.set).toHaveBeenCalledWith(
            'idempotency:idem-2',
            '"pending"',
            'EX',
            86400,
            'NX',
        );
        expect(mockClient.send).toHaveBeenCalledWith(SUBMISSIONS.CREATE, {
            internalToken: 'internal-token',
            payload: dto,
        });
        expect(result).toEqual('sent');
    });

    it('should mark the key pending and submit when there is no cached value', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        mockClient.send.mockReturnValue('sent');

        const dto = { idempotencyKey: 'idem-3', code: 'print(1)' } as any;
        await facade.submit(dto);

        expect(redis.set).toHaveBeenCalledWith(
            'idempotency:idem-3',
            '"pending"',
            'EX',
            86400,
            'NX',
        );
        expect(mockClient.send).toHaveBeenCalledWith(SUBMISSIONS.CREATE, {
            internalToken: 'internal-token',
            payload: dto,
        });
    });

    it('should submit directly without touching redis when there is no idempotency key', async () => {
        mockClient.send.mockReturnValue('sent');

        const dto = { code: 'print(1)' } as any;
        await facade.submit(dto);

        expect(redis.get).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
        expect(mockClient.send).toHaveBeenCalledWith(SUBMISSIONS.CREATE, {
            internalToken: 'internal-token',
            payload: dto,
        });
    });
});
