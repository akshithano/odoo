import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from monorepo root or local directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config(); // fallback

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5001),
  BACKEND_PORT: z.coerce.number().default(5001),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z
    .string()
    .default(
      'postgresql://odoo_user:odoo_secure_password@localhost:5432/odoo_subscription_db?schema=public'
    ),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  JWT_SECRET: z.string().default('development_jwt_secret_change_in_production'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(parsed.error.format(), null, 2)
  );
  throw new Error('Environment variable validation failed');
}

export const env = {
  ...parsed.data,
  PORT: process.env.PORT ? Number(process.env.PORT) : parsed.data.BACKEND_PORT,
};
