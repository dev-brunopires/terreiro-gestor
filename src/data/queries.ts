// src/data/queries.ts
import { supabase } from '@/integrations/supabase/client';

export async function fetchMembros(orgId: string) {
  const { data, error } = await supabase
    .from('membros')
    .select('*')
    .eq('org_id', orgId)
    .order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchPlanos(orgId: string) {
  const { data, error } = await supabase
    .from('planos')
    .select('id,nome,valor_centavos,dia_vencimento,ativo,org_id,terreiro_id')
    .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
    .order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}
