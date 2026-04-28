-- Corrige URLs de banner que ainda apontam para o bucket antigo (moovepay-media)
-- após a renomeação para congregapay-media em 20260428000001.

UPDATE "Event"
SET "banner" = REPLACE("banner", '/moovepay-media/', '/congregapay-media/')
WHERE "banner" LIKE '%/moovepay-media/%';

-- Corrige avatares de usuários também, se houver
UPDATE "User"
SET "avatarUrl" = REPLACE("avatarUrl", '/moovepay-media/', '/congregapay-media/')
WHERE "avatarUrl" LIKE '%/moovepay-media/%';
