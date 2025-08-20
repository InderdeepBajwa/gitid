import { z } from 'zod';

export const KeyTypeSchema = z.enum(['ed25519', 'rsa', 'ecdsa']);
export type KeyType = z.infer<typeof KeyTypeSchema>;

export const GitProviderSchema = z.enum([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'custom'
]);
export type GitProvider = z.infer<typeof GitProviderSchema>;

export const IdentityMetadataSchema = z.object({
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  team: z.string().optional(),
  project: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  lastRotated: z.string().datetime().optional(),
  usageCount: z.number().int().nonnegative().default(0),
  lastUsed: z.string().datetime().optional()
});
export type IdentityMetadata = z.infer<typeof IdentityMetadataSchema>;

export const IdentitySchema = z.object({
  id: z.string().uuid(),
  alias: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_]+$/),
  hostName: z.string().min(1),
  provider: GitProviderSchema.optional(),
  keyType: KeyTypeSchema,
  keyPath: z.string(),
  publicKeyFingerprint: z.string().optional(),
  gitUserName: z.string().optional(),
  gitUserEmail: z.string().email().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: IdentityMetadataSchema.optional(),
  isActive: z.boolean().default(true),
  isEncrypted: z.boolean().default(false)
});

export type Identity = z.infer<typeof IdentitySchema>;

export const CreateIdentitySchema = z.object({
  alias: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_]+$/),
  hostName: z.string().min(1),
  keyType: KeyTypeSchema.default('ed25519'),
  passphrase: z.string().optional(),
  gitUserName: z.string().optional(),
  gitUserEmail: z.string().email().optional(),
  metadata: IdentityMetadataSchema.optional()
});

export type CreateIdentityInput = z.infer<typeof CreateIdentitySchema>;

export const UpdateIdentitySchema = z.object({
  gitUserName: z.string().optional(),
  gitUserEmail: z.string().email().optional(),
  metadata: IdentityMetadataSchema.optional(),
  isActive: z.boolean().optional()
});

export type UpdateIdentityInput = z.infer<typeof UpdateIdentitySchema>;