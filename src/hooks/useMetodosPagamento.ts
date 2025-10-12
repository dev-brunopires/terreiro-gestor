import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MetodoPagamento {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
}

export function useMetodosPagamento() {
  const [metodos, setMetodos] = useState<MetodoPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetodos();
  }, []);

  const loadMetodos = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('metodos_pagamento' as any)
        .select('id, slug, nome, ativo')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (fetchError) throw fetchError;

      setMetodos((data as any) || []);
    } catch (err: any) {
      console.error('Erro ao carregar métodos de pagamento:', err);
      setError(err?.message || 'Erro ao carregar métodos');
      // Fallback: métodos básicos se falhar
      setMetodos([
        { id: 'fallback-pix', slug: 'pix', nome: 'PIX', ativo: true },
        { id: 'fallback-dinheiro', slug: 'dinheiro', nome: 'Dinheiro', ativo: true },
        { id: 'fallback-cartao', slug: 'cartao', nome: 'Cartão', ativo: true },
        { id: 'fallback-transferencia', slug: 'transferencia', nome: 'Transferência', ativo: true },
        { id: 'fallback-outro', slug: 'outro', nome: 'Outro', ativo: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getMetodoBySlug = (slug: string): MetodoPagamento | undefined => {
    return metodos.find(m => m.slug === slug);
  };

  const getMetodoById = (id: string): MetodoPagamento | undefined => {
    return metodos.find(m => m.id === id);
  };

  return {
    metodos,
    loading,
    error,
    reload: loadMetodos,
    getMetodoBySlug,
    getMetodoById,
  };
}
