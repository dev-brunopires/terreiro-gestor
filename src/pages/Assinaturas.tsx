import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, FileText, Search } from 'lucide-react';

interface Assinatura {
  id: string;
  inicio: string;
  fim?: string;
  status: string;
  membro: {
    id: string;
    nome: string;
    matricula?: string;
  };
  plano: {
    id: string;
    nome: string;
    valor_centavos: number;
  };
  created_at: string;
}

interface Membro {
  id: string;
  nome: string;
  matricula?: string;
}

interface Plano {
  id: string;
  nome: string;
  valor_centavos: number;
}

export default function Assinaturas() {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    membro_id: '',
    plano_id: '',
    inicio: new Date().toISOString().split('T')[0],
    fim: '',
    status: 'ativa',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [assinaturasResult, membrosResult, planosResult] = await Promise.all([
        supabase
          .from('assinaturas')
          .select(`
            id,
            inicio,
            fim,
            status,
            created_at,
            membros:membro_id (
              id,
              nome,
              matricula
            ),
            planos:plano_id (
              id,
              nome,
              valor_centavos
            )
          `)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('membros')
          .select('id, nome, matricula')
          .eq('ativo', true)
          .order('nome'),
        
        supabase
          .from('planos')
          .select('id, nome, valor_centavos')
          .order('nome')
      ]);

      if (assinaturasResult.error) throw assinaturasResult.error;
      if (membrosResult.error) throw membrosResult.error;
      if (planosResult.error) throw planosResult.error;

      setAssinaturas(assinaturasResult.data?.map(a => ({
        id: a.id,
        inicio: a.inicio,
        fim: a.fim,
        status: a.status,
        created_at: a.created_at,
        membro: {
          id: (a.membros as any)?.id || '',
          nome: (a.membros as any)?.nome || 'N/A',
          matricula: (a.membros as any)?.matricula,
        },
        plano: {
          id: (a.planos as any)?.id || '',
          nome: (a.planos as any)?.nome || 'N/A',
          valor_centavos: (a.planos as any)?.valor_centavos || 0,
        },
      })) || []);
      
      setMembros(membrosResult.data || []);
      setPlanos(planosResult.data || []);
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

  const resetForm = () => {
    setFormData({
      membro_id: '',
      plano_id: '',
      inicio: new Date().toISOString().split('T')[0],
      fim: '',
      status: 'ativa',
    });
    setEditingAssinatura(null);
  };

  const openEditDialog = (assinatura: Assinatura) => {
    setFormData({
      membro_id: assinatura.membro.id,
      plano_id: assinatura.plano.id,
      inicio: assinatura.inicio,
      fim: assinatura.fim || '',
      status: assinatura.status,
    });
    setEditingAssinatura(assinatura);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        membro_id: formData.membro_id,
        plano_id: formData.plano_id,
        inicio: formData.inicio,
        fim: formData.fim || null,
        status: formData.status,
      };

      if (editingAssinatura) {
        const { error } = await supabase
          .from('assinaturas')
          .update(payload)
          .eq('id', editingAssinatura.id);

        if (error) throw error;

        toast({
          title: "Assinatura atualizada",
          description: "A assinatura foi atualizada com sucesso",
        });
      } else {
        const { error } = await supabase
          .from('assinaturas')
          .insert(payload);

        if (error) throw error;

        toast({
          title: "Assinatura criada",
          description: "A assinatura foi criada com sucesso",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: "Erro ao salvar assinatura",
        description: "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (assinatura: Assinatura) => {
    try {
      const { error } = await supabase
        .from('assinaturas')
        .delete()
        .eq('id', assinatura.id);

      if (error) throw error;

      toast({
        title: "Assinatura excluída",
        description: "A assinatura foi excluída do sistema",
      });

      loadData();
    } catch (error) {
      toast({
        title: "Erro ao excluir assinatura",
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
      'ativa': 'default',
      'pausada': 'secondary',
      'cancelada': 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const filteredAssinaturas = assinaturas.filter(assinatura => {
    const matchesSearch = assinatura.membro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (assinatura.membro.matricula && assinatura.membro.matricula.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         assinatura.plano.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || assinatura.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Assinaturas
            </h1>
            <p className="text-muted-foreground">Gerencie as assinaturas de planos</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-sacred hover:opacity-90" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Assinatura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingAssinatura ? 'Editar Assinatura' : 'Nova Assinatura'}
                </DialogTitle>
                <DialogDescription>
                  {editingAssinatura ? 'Atualize os dados da assinatura' : 'Vincule um membro a um plano'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="membro_id">Membro *</Label>
                  <Select value={formData.membro_id} onValueChange={(value) => setFormData({ ...formData, membro_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um membro" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {membros.map((membro) => (
                        <SelectItem key={membro.id} value={membro.id}>
                          {membro.nome} {membro.matricula && `(${membro.matricula})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="plano_id">Plano *</Label>
                  <Select value={formData.plano_id} onValueChange={(value) => setFormData({ ...formData, plano_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {planos.map((plano) => (
                        <SelectItem key={plano.id} value={plano.id}>
                          {plano.nome} - {formatCurrency(plano.valor_centavos)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="inicio">Data de início *</Label>
                  <Input
                    id="inicio"
                    type="date"
                    value={formData.inicio}
                    onChange={(e) => setFormData({ ...formData, inicio: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fim">Data de fim (opcional)</Label>
                  <Input
                    id="fim"
                    type="date"
                    value={formData.fim}
                    onChange={(e) => setFormData({ ...formData, fim: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                    {editingAssinatura ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por membro ou plano..."
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
                    <SelectItem value="ativa">Ativas</SelectItem>
                    <SelectItem value="pausada">Pausadas</SelectItem>
                    <SelectItem value="cancelada">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions Table */}
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>
              {filteredAssinaturas.length} assinatura{filteredAssinaturas.length !== 1 ? 's' : ''} encontrada{filteredAssinaturas.length !== 1 ? 's' : ''}
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
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssinaturas.map((assinatura) => (
                    <TableRow key={assinatura.id} className="border-border/50">
                      <TableCell className="font-medium">
                        {assinatura.membro.nome}
                        {assinatura.membro.matricula && (
                          <div className="text-xs text-muted-foreground">
                            {assinatura.membro.matricula}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{assinatura.plano.nome}</TableCell>
                      <TableCell className="font-semibold text-secondary">
                        {formatCurrency(assinatura.plano.valor_centavos)}
                      </TableCell>
                      <TableCell>
                        {new Date(assinatura.inicio).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {assinatura.fim ? new Date(assinatura.fim).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(assinatura.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(assinatura)}
                            className="hover:bg-accent hover:text-accent-foreground"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="hover:bg-destructive hover:text-destructive-foreground">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir esta assinatura? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(assinatura)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!loading && filteredAssinaturas.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhuma assinatura encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}