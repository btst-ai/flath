# Supabase Data API Grants

## Important: October 30, 2026 Deadline

Supabase is changing default behavior for table access via the Data API. **New tables created after October 30, 2026 will require explicit GRANT statements to be accessible via supabase-js.**

Existing tables are unaffected through October 30. This project currently has no explicit grants — relying on Supabase defaults — so existing tables will continue to work.

## When Creating New Tables

Add explicit grants alongside RLS policies. Template:

```sql
-- Create table
CREATE TABLE public.my_table (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- ... other columns
);

-- Grant access to roles that need Data API access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_table TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_table TO service_role;

-- Enable RLS (keep existing pattern)
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "users can access their own rows"
  ON public.my_table FOR SELECT
  USING (auth.uid() = user_id);
```

**Note:** Only grant `anon` role if the table should be accessible by unauthenticated users (rare in this app — most tables are user-scoped).

## Current Tables

Tables currently accessed via Data API (all in public schema):
- words_dim
- user_word_settings
- word_packs
- word_pack_items
- attempts_history
- duels

These are unaffected until October 30, 2026.

## References

- [Supabase Changelog: Data API Grants](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Migration file: `sql/duels.sql` (reference for RLS pattern, add grants for future tables)
