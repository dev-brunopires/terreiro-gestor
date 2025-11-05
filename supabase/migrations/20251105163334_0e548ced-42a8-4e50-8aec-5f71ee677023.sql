-- Remover referências ao campo forma_pagamento antigo
-- Verificar se há algum trigger ou função usando o campo antigo

-- Se houver um trigger que tenta acessar NEW.forma_pagamento, ele precisa ser atualizado
-- Vamos listar os triggers da tabela faturas para verificar

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tgname, pg_get_triggerdef(oid) as definition
    FROM pg_trigger
    WHERE tgrelid = 'public.faturas'::regclass
      AND tgisinternal = false
  LOOP
    RAISE NOTICE 'Trigger: %, Definition: %', r.tgname, r.definition;
  END LOOP;
END $$;