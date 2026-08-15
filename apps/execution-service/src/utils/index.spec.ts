/* eslint-disable */
import { generateCacheKey } from './index';

describe('generateCacheKey', () => {
    it('should produce a deterministic 64-character sha256 hex digest', () => {
        const key = generateCacheKey('python', 'print(1)', 1);

        expect(key).toMatch(/^[a-f0-9]{64}$/);
        expect(key).toEqual(generateCacheKey('python', 'print(1)', 1));
    });

    it('should normalize CRLF line endings and surrounding whitespace before hashing', () => {
        const key = generateCacheKey('python', '  print(1)\r\nprint(2)  ', 1);
        const normalizedKey = generateCacheKey('python', 'print(1)\nprint(2)', 1);

        expect(key).toEqual(normalizedKey);
    });

    it('should produce different keys for different languages, code, or problem ids', () => {
        const base = generateCacheKey('python', 'print(1)', 1);

        expect(generateCacheKey('javascript', 'print(1)', 1)).not.toEqual(base);
        expect(generateCacheKey('python', 'print(2)', 1)).not.toEqual(base);
        expect(generateCacheKey('python', 'print(1)', 2)).not.toEqual(base);
    });
});
