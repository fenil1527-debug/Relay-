import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z.string().min(1).max(200).default('New Session'),
  fallbackChain: z.array(z.string()).min(1).max(10).optional(),
  tokenCap: z.number().int().min(1000).max(500000).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(50000),
});

export const updateProviderSchema = z.object({
  provider: z.string().min(1),
});

export const writeFileSchema = z.object({
  content: z.string().max(100000),
  expectedVersion: z.number().int().optional(),
});

// Path validation — no traversal, relative only
const pathRegex = /^[a-zA-Z0-9_\-./]+$/;
export const filePathSchema = z.string()
  .min(1)
  .max(500)
  .regex(pathRegex, 'Invalid characters in path')
  .refine(p => !p.includes('..'), 'Path traversal not allowed')
  .refine(p => !p.startsWith('/'), 'Absolute paths not allowed')
  .refine(p => p.split('/').length <= 10, 'Path too deep');
