-- Verificar e corrigir a função faturas_sync_fp que está causando o erro
-- Ela provavelmente está tentando acessar NEW.forma_pagamento

-- Vamos ver o que essa função faz e depois removê-la ou corrigi-la
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'faturas_sync_fp';

-- Se não for necessária, vamos removê-la
DROP TRIGGER IF EXISTS faturas_sync_fp_biud ON public.faturas;
DROP FUNCTION IF EXISTS public.faturas_sync_fp() CASCADE;