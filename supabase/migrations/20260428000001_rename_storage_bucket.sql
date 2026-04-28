-- Renomear bucket de storage: moovepay-media -> congregapay-media
-- Esta migration é idempotente: só age se o bucket antigo existir.
-- Etapa 1/2: cria o bucket congregapay-media e migra os objetos via SQL.
-- Etapa 2/2: deleção do bucket moovepay-media vazio é feita via Storage REST API
--            (DELETE direto em storage.buckets é bloqueado por trigger do Supabase).
DO $$
BEGIN
  -- Cria o novo bucket copiando as configurações do antigo (se existir)
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'congregapay-media') THEN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'moovepay-media') THEN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
      SELECT 'congregapay-media', 'congregapay-media', public, file_size_limit, allowed_mime_types, now(), now()
      FROM storage.buckets WHERE id = 'moovepay-media';
    ELSE
      INSERT INTO storage.buckets (id, name, public, file_size_limit, created_at, updated_at)
      VALUES ('congregapay-media', 'congregapay-media', true, 2097152, now(), now());
    END IF;
    RAISE NOTICE 'Bucket congregapay-media criado.';
  END IF;

  -- Move todos os objetos do bucket antigo para o novo
  UPDATE storage.objects
    SET bucket_id = 'congregapay-media'
  WHERE bucket_id = 'moovepay-media';

  RAISE NOTICE 'Objetos migrados para congregapay-media. Bucket moovepay-media agora vazio — remova via Storage API.';
END $$;
