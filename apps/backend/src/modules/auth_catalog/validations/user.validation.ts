import { z } from 'zod';
import { passwordSchema } from './auth.validation.js';

export const createStaffSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: passwordSchema,
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});
