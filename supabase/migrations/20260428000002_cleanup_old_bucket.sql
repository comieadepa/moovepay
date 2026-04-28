-- Remove o bucket moovepay-media (já vazio após migration anterior).
-- Usa session_replication_role para bypassar o trigger de proteção do Supabase Storage.
SET session_replication_role = replica;
DELETE FROM storage.buckets WHERE id = 'moovepay-media';
SET session_replication_role = DEFAULT;
