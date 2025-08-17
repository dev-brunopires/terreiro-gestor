import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, CreditCard } from 'lucide-react';

interface Plano {
  id: string;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
  created_at: string;
}

export default function Planos() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    valor_centavos: '',
    dia_vencimento: '',
  });

  useEffect(() => {
    loadPlanos();
  }, []);

  const loadPlanos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .order('nome');

      if (error) throw error;
      setPlanos(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar planos",
        description: "Tente recarregar a página",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      valor_centavos: '',
      dia_vencimento: '',
    });
    setEditingPlano(null);
  };

  const openEditDialog = (plano: Plano) => {
    setFormData({
      nome: plano.nome,
      valor_centavos: (plano.valor_centavos / 100).toString(),
      dia_vencimento: plano.dia_vencimento.toString(),
    });
    setEditingPlano(plano);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const valor_centavos = Math.round(parseFloat(formData.valor_centavos) * 100);
      const dia_vencimento = parseInt(formData.dia_vencimento);

      if (valor_centavos <= 0) {
        toast({
          title: "Valor inválido",
          description: "O valor deve ser maior que zero",
          variant: "destructive",
        });
        return;
      }

      if (dia_vencimento < 1 || dia_vencimento > 28) {
        toast({
          title: "Dia de vencimento inválido",
          description: "O dia deve estar entre 1 e 28",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        nome: formData.nome,
        valor_centavos,
        dia_vencimento,
      };

      if (editingPlano) {
        const { error } = await supabase
          .from('planos')
          .update(payload)
          .eq('id', editingPlano.id);

        if (error) throw error;

        toast({
          title: "Plano atualizado",
          description: `${formData.nome} foi atualizado com sucesso`,
        });
      } else {
        const { error } = await supabase
          .from('planos')
          .insert(payload);

        if (error) throw error;

        toast({
          title: "Plano cadastrado",
          description: `${formData.nome} foi cadastrado com sucesso`,
        });
      }

      setDialogOpen(false);
      resetForm();
      loadPlanos();
    } catch (error) {
      toast({
        title: "Erro ao salvar plano",
        description: "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (plano: Plano) => {
    try {
      const { error } = await supabase
        .from('planos')
        .delete()
        .eq('id', plano.id);

      if (error) throw error;

      toast({
        title: "Plano excluído",
        description: `${plano.nome} foi excluído do sistema`,
      });

      loadPlanos();
    } catch (error) {
      toast({
        title: "Erro ao excluir plano",
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <CreditCard className="h-8 w-8 text-primary" />
              Planos
            </h1>
            <p className="text-muted-foreground">Gerencie os planos de mensalidade</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-sacred hover:opacity-90" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPlano ? 'Editar Plano' : 'Novo Plano'}
                </DialogTitle>
                <DialogDescription>
                  {editingPlano ? 'Atualize os dados do plano' : 'Cadastre um novo plano de mensalidade'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do plano *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Mensalidade Básica"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="valor_centavos">Valor (R$) *</Label>
                  <Input
                    id="valor_centavos"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.valor_centavos}
                    onChange={(e) => setFormData({ ...formData, valor_centavos: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dia_vencimento">Dia do vencimento *</Label>
                  <Input
                    id="dia_vencimento"
                    type="number"
                    min="1"
                    max="28"
                    value={formData.dia_vencimento}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento: e.target.value })}
                    placeholder="Ex: 10"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Dia do mês em que a mensalidade vence (1 a 28)
                  </p>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                    {editingPlano ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Plans Table */}
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>
              {planos.length} plano{planos.length !== 1 ? 's' : ''} cadastrado{planos.length !== 1 ? 's' : ''}
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Dia de Vencimento</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planos.map((plano) => (
                    <TableRow key={plano.id} className="border-border/50">
                      <TableCell className="font-medium">{plano.nome}</TableCell>
                      <TableCell className="font-semibold text-secondary">
                        {formatCurrency(plano.valor_centavos)}
                      </TableCell>
                      <TableCell>Dia {plano.dia_vencimento}</TableCell>
                      <TableCell>
                        {new Date(plano.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(plano)}
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
                                  Tem certeza que deseja excluir o plano "{plano.nome}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(plano)}
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

            {!loading && planos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum plano cadastrado</p>
                <p className="text-sm">Crie seu primeiro plano de mensalidade</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}