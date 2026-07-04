-- Extensii necesare (SPEC_DatabaseSchema_v3 §1).
-- pgcrypto e adăugat defensiv pentru gen_random_uuid() — Supabase îl are deja
-- activat în majoritatea proiectelor noi, dar `if not exists` face operația idempotentă.
create extension if not exists moddatetime schema extensions;
create extension if not exists unaccent schema extensions;
create extension if not exists pgcrypto schema extensions;
