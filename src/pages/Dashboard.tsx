import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Receipt, DollarSign, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DashboardStats {
  membrosAtivos: number;
  faturasAbertas: number;
  receitaMesAtual: number;
}

interface FaturaRecente {
  id: string;
  membro: { nome: string };
  refer: string;
  dt_vencimento: string;
  status: string;
  valor_centavos: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    membrosAtivos: 0,
    faturasAbertas: 0,
    receitaMesAtual: 0,
  });
  const [faturasRecentes, setFaturasRecentes] = useState<FaturaRecente[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get stats
      const [membrosResult, faturasResult, receitaResult] = await Promise.all([
        supabase.from('membros').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('faturas').select('id', { count: 'exact', head: true }).eq('status', 'aberta'),
        supabase.from('faturas')
          .select('vl_pago_centavos')
          .eq('status', 'paga')
          .gte('dt_pagamento', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      ]);

      // Get recent invoices
      const { data: faturas } = await supabase
        .from('faturas')
        .select(`
          id,
          refer,
          dt_vencimento,
          status,
          valor_centavos,
          membros:membro_id (
            nome
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const receita = receitaResult.data?.reduce((sum, fatura) => sum + (fatura.vl_pago_centavos || 0), 0) || 0;

      setStats({
        membrosAtivos: membrosResult.count || 0,
        faturasAbertas: faturasResult.count || 0,
        receitaMesAtual: receita,
      });

      setFaturasRecentes(faturas?.map(f => ({
        id: f.id,
        membro: { nome: (f.membros as any)?.nome || 'N/A' },
        refer: f.refer,
        dt_vencimento: f.dt_vencimento,
        status: f.status,
        valor_centavos: f.valor_centavos,
      })) || []);

    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Tente recarregar a página",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const marcarComoPaga = async (faturaId: string) => {
    try {
      const { error } = await supabase
        .from('faturas')
        .update({
          status: 'paga',
          dt_pagamento: new Date().toISOString(),
          vl_pago_centavos: faturasRecentes.find(f => f.id === faturaId)?.valor_centavos,
          forma_pagamento: 'dinheiro'
        })
        .eq('id', faturaId);

      if (error) throw error;

      toast({
        title: "Fatura marcada como paga",
        description: "A fatura foi atualizada com sucesso",
      });

      loadDashboardData();
    } catch (error) {
      toast({
        title: "Erro ao marcar fatura",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (centavos: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(centavos / 100);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'aberta': 'secondary',
      'paga': 'default',
      'atrasada': 'destructive',
      'cancelada': 'secondary'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted/20 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu terreiro</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sacred">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Membros Ativos</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.membrosAtivos}</div>
              <p className="text-xs text-muted-foreground">
                Total de membros cadastrados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 shadow-warm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturas Abertas</CardTitle>
              <Receipt className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.faturasAbertas}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando pagamento
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-secondary/20 shadow-ethereal">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {formatCurrency(stats.receitaMesAtual)}
              </div>
              <p className="text-xs text-muted-foreground">
                Valores recebidos este mês
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card className="bg-card/30 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Faturas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Membro</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturasRecentes.map((fatura) => (
                  <TableRow key={fatura.id} className="border-border/50">
                    <TableCell className="font-medium">{fatura.membro.nome}</TableCell>
                    <TableCell>{fatura.refer}</TableCell>
                    <TableCell>
                      {new Date(fatura.dt_vencimento).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>{getStatusBadge(fatura.status)}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(fatura.valor_centavos)}
                    </TableCell>
                    <TableCell>
                      {fatura.status === 'aberta' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marcarComoPaga(fatura.id)}
                          className="text-xs hover:bg-secondary hover:text-secondary-foreground"
                        >
                          Marcar como paga
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {faturasRecentes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhuma fatura encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}