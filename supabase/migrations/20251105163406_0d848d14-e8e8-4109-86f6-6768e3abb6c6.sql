-- Verificar se a função faturas_coalesce_before_ins_upd existe e corrigir se necessário
-- O erro "record 'new' has no field 'forma_pagamento'" sugere que um trigger está tentando acessar um campo que não existe

-- Vamos recriar a função trigger para garantir que ela não tenta acessar campos inexistentes
CREATE OR REPLACE FUNCTION public.faturas_coalesce_before_ins_upd()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  -- sincroniza datas de vencimento (mantém ambas preenchidas)
  IF NEW.data_vencimento IS NULL AND NEW.dt_vencimento IS NOT NULL THEN
    NEW.data_vencimento := NEW.dt_vencimento;
  END IF;
  IF NEW.dt_vencimento IS NULL AND NEW.data_vencimento IS NOT NULL THEN
    NEW.dt_vencimento := NEW.data_vencimento;
  END IF;

  -- garante valor numérico a partir de centavos
  IF NEW.valor IS NULL AND NEW.valor_centavos IS NOT NULL THEN
    NEW.valor := (NEW.valor_centavos::numeric / 100.0);
  END IF;

  -- se ainda faltar algo, joga erro claro
  IF NEW.data_vencimento IS NULL THEN
    RAISE EXCEPTION 'Fatura sem data_vencimento/dt_vencimento';
  END IF;
  IF NEW.valor IS NULL THEN
    RAISE EXCEPTION 'Fatura sem valor (preencha valor ou valor_centavos)';
  END IF;

  RETURN NEW;
END;
$function$;