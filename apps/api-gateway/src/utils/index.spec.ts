/* eslint-disable */
import { verify } from 'jsonwebtoken';
import { signInternalToken } from './index';

describe('signInternalToken', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = {
            ...OLD_ENV,
            INTERNAL_JWT_SECRET: 'internal-secret',
            INTERNAL_JWT_ISSUER: 'api-gateway-issuer',
        };
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });

    it('should sign a service token with the given service name and scope', () => {
        const token = signInternalToken('api-gateway', ['problems:create']);

        const payload = verify(token, 'internal-secret', { issuer: 'api-gateway-issuer' }) as any;

        expect(payload.sub).toEqual('api-gateway');
        expect(payload.type).toEqual('service');
        expect(payload.scope).toEqual(['problems:create']);
    });

    it('should default scope to an empty array when omitted', () => {
        const token = signInternalToken('api-gateway');

        const payload = verify(token, 'internal-secret', { issuer: 'api-gateway-issuer' }) as any;

        expect(payload.scope).toEqual([]);
    });

    it('should fail verification against the wrong secret', () => {
        const token = signInternalToken('api-gateway', ['users:me']);

        expect(() => verify(token, 'wrong-secret')).toThrow();
    });
});
