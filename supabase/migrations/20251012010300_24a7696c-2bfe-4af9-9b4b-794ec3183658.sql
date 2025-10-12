-- ============================================================================
-- FASE 4: CLEANUP - Normalização de Métodos de Pagamento
-- ============================================================================
-- Remove colunas antigas de texto e triggers de compatibilidade
-- ATENÇÃO: Esta migração é IRREVERSÍVEL. Backup recomendado antes de executar.
-- ============================================================================

-- 0. Remove views que dependem das colunas antigas
DROP VIEW IF EXISTS v_faturas CASCADE;
DROP VIEW IF EXISTS v_pagamentos CASCADE;

-- 1. Remove trigger de sincronização em pagamentos_diversos
DROP TRIGGER IF EXISTS trg_sync_pagdiv_forma_pagamento ON public.pagamentos_diversos;

-- 2. Remove a função do trigger (agora sem dependências)
DROP FUNCTION IF EXISTS public.sync_pagdiv_forma_pagamento();

-- 3. Atualiza registros com forma_pagamento_id NULL para um valor default antes de tornar NOT NULL
-- (usa o ID do método 'outro' como fallback)
DO $$
DECLARE
  v_outro_id uuid;
BEGIN
  -- Busca o ID do método 'outro'
  SELECT id INTO v_outro_id FROM public.formas_pagamento WHERE codigo = 'outro' LIMIT 1;
  
  -- Se não existir, cria
  IF v_outro_id IS NULL THEN
    INSERT INTO public.formas_pagamento (id, codigo, nome, ativo)
    VALUES (gen_random_uuid(), 'outro', 'Outro', true)
    RETURNING id INTO v_outro_id;
  END IF;

  -- Atualiza faturas com forma_pagamento_id NULL
  UPDATE public.faturas
  SET forma_pagamento_id = v_outro_id
  WHERE forma_pagamento_id IS NULL AND status = 'paga';

  -- Atualiza pagamentos_diversos com forma_pagamento_id NULL
  UPDATE public.pagamentos_diversos
  SET forma_pagamento_id = v_outro_id
  WHERE forma_pagamento_id IS NULL;
END $$;

-- 4. Remove colunas antigas de texto
ALTER TABLE public.faturas 
  DROP COLUMN IF EXISTS forma_pagamento CASCADE;

ALTER TABLE public.pagamentos 
  DROP COLUMN IF EXISTS metodo CASCADE;

ALTER TABLE public.pagamentos_diversos 
  DROP COLUMN IF EXISTS forma_pagamento CASCADE,
  DROP COLUMN IF EXISTS metodo CASCADE;

-- 5. Torna forma_pagamento_id NOT NULL nas tabelas relevantes
-- Para pagamentos_diversos, torna obrigatório
ALTER TABLE public.pagamentos_diversos 
  ALTER COLUMN forma_pagamento_id SET NOT NULL;

-- 6. Adiciona índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_faturas_forma_pagamento_id 
  ON public.faturas(forma_pagamento_id) 
  WHERE forma_pagamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_diversos_forma_pagamento_id 
  ON public.pagamentos_diversos(forma_pagamento_id);

-- 7. Comentários para documentação
COMMENT ON COLUMN public.faturas.forma_pagamento_id IS 
  'FK para formas_pagamento. NULL apenas para faturas pendentes.';

COMMENT ON COLUMN public.pagamentos_diversos.forma_pagamento_id IS 
  'FK obrigatória para formas_pagamento (normalizado).';

-- ============================================================================
-- FIM DA FASE 4 - Normalização Completa ✅
-- Os types do Supabase serão regenerados automaticamente
-- ============================================================================