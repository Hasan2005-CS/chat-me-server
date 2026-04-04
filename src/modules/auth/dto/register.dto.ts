import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterSchema = z.object({
  displayName: z
    .string()
    .min(2, 'the name must be at least 2 characters')
    .max(50, 'the name must not exceed 50 characters'),

  email: z.string().email('the email is invalid'),

  password: z
    .string()
    .min(8, 'the password must be at least 8 characters')
    .regex(/[A-Z]/, 'must contain a uppercase letter')
    .regex(/[0-9]/, 'must contain a number'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
