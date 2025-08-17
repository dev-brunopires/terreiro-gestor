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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Edit, Trash2, Users } from 'lucide-react';

interface Membro {
  id: string;
  nome: string;
  matricula?: string;
  dt_nascimento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  data_admissao_terreiro?: string;
  ativo: boolean;
  observacoes?: string;
  created_at: string;
}

export default function Membros() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    matricula: '',
    dt_nascimento: '',
    telefone: '',
    email: '',
    endereco: '',
    bairro: '',
    cep: '',
    data_admissao_terreiro: '',
    ativo: true,
    observacoes: '',
  });

  useEffect(() => {
    loadMembros();
  }, []);

  const loadMembros = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('membros')
        .select('*')
        .order('nome');

      if (error) throw error;
      setMembros(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar membros",
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
      matricula: '',
      dt_nascimento: '',
      telefone: '',
      email: '',
      endereco: '',
      bairro: '',
      cep: '',
      data_admissao_terreiro: '',
      ativo: true,
      observacoes: '',
    });
    setEditingMembro(null);
  };

  const openEditDialog = (membro: Membro) => {
    setFormData({
      nome: membro.nome,
      matricula: membro.matricula || '',
      dt_nascimento: membro.dt_nascimento || '',
      telefone: membro.telefone || '',
      email: membro.email || '',
      endereco: membro.endereco || '',
      bairro: membro.bairro || '',
      cep: membro.cep || '',
      data_admissao_terreiro: membro.data_admissao_terreiro || '',
      ativo: membro.ativo,
      observacoes: membro.observacoes || '',
    });
    setEditingMembro(membro);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingMembro) {
        const { error } = await supabase
          .from('membros')
          .update(formData)
          .eq('id', editingMembro.id);

        if (error) throw error;

        toast({
          title: "Membro atualizado",
          description: `${formData.nome} foi atualizado com sucesso`,
        });
      } else {
        const { error } = await supabase
          .from('membros')
          .insert(formData);

        if (error) throw error;

        toast({
          title: "Membro cadastrado",
          description: `${formData.nome} foi cadastrado com sucesso`,
        });
      }

      setDialogOpen(false);
      resetForm();
      loadMembros();
    } catch (error) {
      toast({
        title: "Erro ao salvar membro",
        description: "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (membro: Membro) => {
    try {
      const { error } = await supabase
        .from('membros')
        .delete()
        .eq('id', membro.id);

      if (error) throw error;

      toast({
        title: "Membro excluído",
        description: `${membro.nome} foi excluído do sistema`,
      });

      loadMembros();
    } catch (error) {
      toast({
        title: "Erro ao excluir membro",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const filteredMembros = membros.filter(membro => {
    const matchesSearch = membro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (membro.matricula && membro.matricula.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesActive = showActiveOnly ? membro.ativo : true;
    return matchesSearch && matchesActive;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Membros
            </h1>
            <p className="text-muted-foreground">Gerencie os membros do terreiro</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-sacred hover:opacity-90" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Membro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMembro ? 'Editar Membro' : 'Novo Membro'}
                </DialogTitle>
                <DialogDescription>
                  {editingMembro ? 'Atualize os dados do membro' : 'Cadastre um novo membro do terreiro'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="matricula">Matrícula</Label>
                    <Input
                      id="matricula"
                      value={formData.matricula}
                      onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dt_nascimento">Data de nascimento</Label>
                    <Input
                      id="dt_nascimento"
                      type="date"
                      value={formData.dt_nascimento}
                      onChange={(e) => setFormData({ ...formData, dt_nascimento: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="data_admissao_terreiro">Data de admissão</Label>
                    <Input
                      id="data_admissao_terreiro"
                      type="date"
                      value={formData.data_admissao_terreiro}
                      onChange={(e) => setFormData({ ...formData, data_admissao_terreiro: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ativo"
                      checked={formData.ativo}
                      onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                    />
                    <Label htmlFor="ativo">Membro ativo</Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações sobre o membro..."
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                    {editingMembro ? 'Atualizar' : 'Cadastrar'}
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
                    placeholder="Buscar por nome ou matrícula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="showActive"
                  checked={showActiveOnly}
                  onCheckedChange={setShowActiveOnly}
                />
                <Label htmlFor="showActive">Apenas ativos</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>
              {filteredMembros.length} membro{filteredMembros.length !== 1 ? 's' : ''} encontrado{filteredMembros.length !== 1 ? 's' : ''}
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
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembros.map((membro) => (
                    <TableRow key={membro.id} className="border-border/50">
                      <TableCell className="font-medium">{membro.nome}</TableCell>
                      <TableCell>{membro.matricula || '-'}</TableCell>
                      <TableCell>{membro.telefone || '-'}</TableCell>
                      <TableCell>{membro.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={membro.ativo ? "default" : "secondary"}>
                          {membro.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(membro)}
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
                                  Tem certeza que deseja excluir {membro.nome}? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(membro)}
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

            {!loading && filteredMembros.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum membro encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}