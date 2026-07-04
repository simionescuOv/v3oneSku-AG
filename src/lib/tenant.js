// UUID fix de tenant pentru development (SPEC_CatalogRPC.md §7) — soluție
// temporară până la autentificare reală (auth.uid() → lookup tenant).
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
