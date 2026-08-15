/* eslint-disable */
import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { exceptionFactory } from './index';

describe('exceptionFactory', () => {
    it('should map validation errors to a field/message error list', () => {
        const errors: ValidationError[] = [
            {
                property: 'email',
                constraints: { isEmail: 'email must be an email' },
            } as ValidationError,
            {
                property: 'password',
                constraints: { minLength: 'password must be longer than 6 characters' },
            } as ValidationError,
        ];

        const exception = exceptionFactory(errors);

        expect(exception).toBeInstanceOf(BadRequestException);
        expect(exception.getResponse()).toEqual({
            ok: false,
            errors: [
                { field: 'email', message: 'email must be an email' },
                { field: 'password', message: 'password must be longer than 6 characters' },
            ],
        });
    });

    it('should take the first constraint message when multiple constraints fail for a field', () => {
        const errors: ValidationError[] = [
            {
                property: 'username',
                constraints: {
                    isNotEmpty: 'username should not be empty',
                    minLength: 'username must be longer than 3 characters',
                },
            } as ValidationError,
        ];

        const exception = exceptionFactory(errors);

        expect((exception.getResponse() as any).errors).toEqual([
            { field: 'username', message: 'username should not be empty' },
        ]);
    });

    it('should return an empty errors array when called with no errors', () => {
        const exception = exceptionFactory();

        expect(exception.getResponse()).toEqual({ ok: false, errors: [] });
    });
});
