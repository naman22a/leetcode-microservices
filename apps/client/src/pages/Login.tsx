import z from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { setAccessToken } from '@/global';
import { Spinner } from '@/components/ui/spinner';

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
});

function Login() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { mutateAsync: login } = useMutation({
        mutationKey: ['auth', 'login'],
        mutationFn: api.auth.login,
    });

    const guestForm = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: 'test@gmail.com',
            password: 'test123',
        },
    });

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    async function onSubmit(data: z.infer<typeof loginSchema>) {
        try {
            const res = await login(data);
            if (res.accessToken && !res.errors) {
                await queryClient.invalidateQueries({ queryKey: ['users', 'me'], exact: true });
                setAccessToken(res.accessToken);
                toast.success('Logged in');
                navigate('/');
            } else if (res.errors) {
                for (const error of res.errors) {
                    // eslint-disable-next-line
                    form.setError(error.field as any, {
                        message: error.message,
                    });
                }
            } else {
                throw new Error('Network Error');
            }
        } catch (error) {
            console.error(error);
            toast.error('Something went wrong');
        }
    }

    return (
        <div className="min-h-screen w-full flex flex-col justify-center items-center">
            <Card className="w-full sm:max-w-md">
                <CardHeader>
                    <CardTitle className="text-center text-4xl">Login</CardTitle>
                </CardHeader>
                <CardContent>
                    <form id="login-form" onSubmit={form.handleSubmit(onSubmit)}>
                        <FieldGroup>
                            <Controller
                                name="email"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="email">Email</FieldLabel>
                                        <Input
                                            {...field}
                                            type="email"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Email"
                                            autoComplete="off"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="password"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="password">Password</FieldLabel>
                                        <Input
                                            {...field}
                                            type="password"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Password"
                                            autoComplete="off"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                    </form>
                </CardContent>
                <CardFooter>
                    <Button type="submit" form="login-form">
                        {form.formState.isSubmitting && <Spinner />} Login
                    </Button>
                </CardFooter>
            </Card>

            <div className="mt-5">
                <form id="guest-login-form" onSubmit={guestForm.handleSubmit(onSubmit)}></form>
                <Button type="submit" form="guest-login-form">
                    Guest Login
                </Button>
            </div>
        </div>
    );
}

export default Login;
