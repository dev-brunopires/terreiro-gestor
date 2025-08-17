import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Search, Calendar, Zap } from 'lucide-react';

interface Fatura {
  id: string;
  refer: string;
  dt_vencimento: string;
  valor_centavos: number;
  vl_desconto_centavos: number;
  status: string;
  dt_pagamento?: string;
  vl_pago_centavos?: number;
  forma_pagamento?: string;
  membro: {
    nome: string;
    matricula?: string;
  };
  created_at: string;
}

export default function Faturas() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gerandoFaturas, setGerandoFaturas] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);
  const { toast } = useToast();

  const [pagamentoData, setPagamentoData] = useState({
    valor_pago: '',
    forma_pagamento: 'dinheiro',
  });

  const [gerarFaturasData, setGerarFaturasData] = useState({
    ano: new Date().getFullYear().toString(),
    mes: (new Date().getMonth() + 1).toString().padStart(2, '0'),
  });

  useEffect(() => {
    loadFaturas();
  }, []);

  const loadFaturas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('faturas')
        .select(`
          id,
          refer,
          dt_vencimento,
          valor_centavos,
          vl_desconto_centavos,
          status,
          dt_pagamento,
          vl_pago_centavos,
          forma_pagamento,
          created_at,
          membros:membro_id (
            nome,
            matricula
          )
        `)
        .order('dt_vencimento', { ascending: false });

      if (error) throw error;

      setFaturas(data?.map(f => ({
        id: f.id,
        refer: f.refer,
        dt_vencimento: f.dt_vencimento,
        valor_centavos: f.valor_centavos,
        vl_desconto_centavos: f.vl_desconto_centavos || 0,
        status: f.status,
        dt_pagamento: f.dt_pagamento,
        vl_pago_centavos: f.vl_pago_centavos,
        forma_pagamento: f.forma_pagamento,
        created_at: f.created_at,
        membro: {
          nome: (f.membros as any)?.nome || 'N/A',
          matricula: (f.membros as any)?.matricula,
        },
      })) || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar faturas",
        description: "Tente recarregar a página",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const gerarFaturas = async () => {
    try {
      setGerandoFaturas(true);
      const { data, error } = await supabase.rpc('gerar_faturas_mes', {
        ano: parseInt(gerarFaturasData.ano),
        mes: parseInt(gerarFaturasData.mes)
      });

      if (error) throw error;

      toast({
        title: "Faturas geradas",
        description: `${data} faturas foram geradas para ${gerarFaturasData.mes}/${gerarFaturasData.ano}`,
      });

      loadFaturas();
    } catch (error) {
      toast({
        title: "Erro ao gerar faturas",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setGerandoFaturas(false);
    }
  };

  const abrirDialogPagamento = (fatura: Fatura) => {
    setSelectedFatura(fatura);
    setPagamentoData({
      valor_pago: ((fatura.valor_centavos - fatura.vl_desconto_centavos) / 100).toString(),
      forma_pagamento: 'dinheiro',
    });
    setDialogOpen(true);
  };

  const marcarComoPaga = async () => {
    if (!selectedFatura) return;

    try {
      const valor_pago_centavos = Math.round(parseFloat(pagamentoData.valor_pago) * 100);

      // Update fatura
      const { error: faturaError } = await supabase
        .from('faturas')
        .update({
          status: 'paga',
          dt_pagamento: new Date().toISOString(),
          vl_pago_centavos: valor_pago_centavos,
          forma_pagamento: pagamentoData.forma_pagamento,
        })
        .eq('id', selectedFatura.id);

      if (faturaError) throw faturaError;

      // Insert payment record
      const { error: pagamentoError } = await supabase
        .from('pagamentos')
        .insert([{
          fatura_id: selectedFatura.id,
          valor_centavos: valor_pago_centavos,
          metodo: pagamentoData.forma_pagamento,
        }]);

      if (pagamentoError) throw pagamentoError;

      toast({
        title: "Pagamento registrado",
        description: "A fatura foi marcada como paga",
      });

      setDialogOpen(false);
      setSelectedFatura(null);
      loadFaturas();
    } catch (error) {
      toast({
        title: "Erro ao registrar pagamento",
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

  const filteredFaturas = faturas.filter(fatura => {
    const matchesSearch = fatura.membro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (fatura.membro.matricula && fatura.membro.matricula.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         fatura.refer.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || fatura.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-8 w-8 text-primary" />
              Faturas
            </h1>
            <p className="text-muted-foreground">Gerencie as faturas de mensalidade</p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={gerarFaturas} 
              disabled={gerandoFaturas}
              className="bg-gradient-earth hover:opacity-90"
            >
              <Zap className="h-4 w-4 mr-2" />
              {gerandoFaturas ? 'Gerando...' : 'Gerar Faturas'}
            </Button>
          </div>
        </div>

        {/* Generate Invoices Card */}
        <Card className="bg-card/50 backdrop-blur-sm border-secondary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-secondary" />
              Gerar Faturas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="ano">Ano</Label>
                <Input
                  id="ano"
                  type="number"
                  min="2020"
                  max="2030"
                  value={gerarFaturasData.ano}
                  onChange={(e) => setGerarFaturasData({ ...gerarFaturasData, ano: e.target.value })}
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mes">Mês</Label>
                <Select value={gerarFaturasData.mes} onValueChange={(value) => setGerarFaturasData({ ...gerarFaturasData, mes: value })}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString().padStart(2, '0')}>
                        {new Date(2000, i).toLocaleDateString('pt-BR', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={gerarFaturas} 
                disabled={gerandoFaturas}
                className="bg-gradient-sacred hover:opacity-90"
              >
                <Zap className="h-4 w-4 mr-2" />
                {gerandoFaturas ? 'Gerando...' : 'Gerar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por membro, matrícula ou referência..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="aberta">Abertas</SelectItem>
                    <SelectItem value="paga">Pagas</SelectItem>
                    <SelectItem value="atrasada">Atrasadas</SelectItem>
                    <SelectItem value="cancelada">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>
              {filteredFaturas.length} fatura{filteredFaturas.length !== 1 ? 's' : ''} encontrada{filteredFaturas.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Membro</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFaturas.map((fatura) => (
                    <TableRow key={fatura.id} className="border-border/50">
                      <TableCell className="font-medium">
                        {fatura.membro.nome}
                        {fatura.membro.matricula && (
                          <div className="text-xs text-muted-foreground">
                            {fatura.membro.matricula}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{fatura.refer}</TableCell>
                      <TableCell>
                        {new Date(fatura.dt_vencimento).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-semibold text-secondary">
                        {formatCurrency(fatura.valor_centavos)}
                        {fatura.vl_desconto_centavos > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Desc: {formatCurrency(fatura.vl_desconto_centavos)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(fatura.status)}</TableCell>
                      <TableCell>
                        {fatura.dt_pagamento ? (
                          <div>
                            <div className="font-medium text-accent">
                              {formatCurrency(fatura.vl_pago_centavos || 0)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(fatura.dt_pagamento).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fatura.forma_pagamento}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {fatura.status === 'aberta' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirDialogPagamento(fatura)}
                            className="hover:bg-accent hover:text-accent-foreground"
                          >
                            Marcar como paga
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!loading && filteredFaturas.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhuma fatura encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>
                Confirme os dados do pagamento da fatura
              </DialogDescription>
            </DialogHeader>
            
            {selectedFatura && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/20 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Membro:</span>
                      <span className="font-medium">{selectedFatura.membro.nome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Referência:</span>
                      <span className="font-mono">{selectedFatura.refer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Valor original:</span>
                      <span>{formatCurrency(selectedFatura.valor_centavos)}</span>
                    </div>
                    {selectedFatura.vl_desconto_centavos > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Desconto:</span>
                        <span className="text-destructive">-{formatCurrency(selectedFatura.vl_desconto_centavos)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="valor_pago">Valor pago (R$)</Label>
                  <Input
                    id="valor_pago"
                    type="number"
                    step="0.01"
                    value={pagamentoData.valor_pago}
                    onChange={(e) => setPagamentoData({ ...pagamentoData, valor_pago: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
                  <Select value={pagamentoData.forma_pagamento} onValueChange={(value) => setPagamentoData({ ...pagamentoData, forma_pagamento: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={marcarComoPaga} className="bg-gradient-sacred hover:opacity-90">
                    Confirmar Pagamento
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}