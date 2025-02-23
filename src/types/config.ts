import { z } from 'zod';

// Zod schema for BigCommerce config
export const BigCommerceConfigSchema = z.object({
  storeHash: z.string(),
  apiToken: z.string(),
  apiVersion: z.string().default('v3')
});

// Zod schema for import config
export const ImportConfigSchema = z.object({
  parentCategoryId: z.number().optional(),
  categoryTreeId: z.number(),
  batchSize: z.number().default(50)
});

// Zod schema for URL transformations
export const UrlConfigSchema = z.object({
  path: z.string(),
  transformations: z.array(z.string())
});

// Zod schema for mapping config
export const MappingConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: UrlConfigSchema,
  is_visible: z.boolean().default(true)
});

// Main config schema
export const ConfigSchema = z.object({
  bigcommerce: BigCommerceConfigSchema,
  import: ImportConfigSchema,
  mapping: MappingConfigSchema,
  database: z.string()
});

// TypeScript types derived from schemas
export type BigCommerceConfig = z.infer<typeof BigCommerceConfigSchema>;
export type ImportConfig = z.infer<typeof ImportConfigSchema>;
export type UrlConfig = z.infer<typeof UrlConfigSchema>;
export type MappingConfig = z.infer<typeof MappingConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>; 