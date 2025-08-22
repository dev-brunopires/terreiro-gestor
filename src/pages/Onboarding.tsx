import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Onboarding() {
  const [nomeTerreiro, setNomeTerreiro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = nomeTerreiro.trim();
    if (!nome) return;

    setLoading(true);

    try {
      // 1) Cria o terreiro via RPC (precisa retornar o ID do novo terreiro)
      const { data, error } = await supabase.rpc('create_terreiro', {
        nome_terreiro: nome,
      });

      if (error) {
        toast({
          title: 'Erro ao criar terreiro',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // A RPC pode retornar uma string (id) ou um objeto com { id }
      const terreiroId: string | null =
        typeof data === 'string' ? data : (data?.id ?? null);

      // 2) Vincula o usuário logado ao terreiro como OWNER (profiles.org_id/role)
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user && terreiroId) {
        const { error: upErr } = await supabase
          .from('profiles')
          .update({ org_id: terreiroId, role: 'owner' })
          .eq('user_id', auth.user.id);

        if (upErr) {
          // não bloqueia o fluxo, mas avisa para recarregar caso necessário
          toast({
            title: 'Aviso',
            description:
              'Terreiro criado, mas não consegui vincular seu perfil. Recarregue a página se o menu não atualizar.',
            variant: 'destructive',
          });
        }
      }

      toast({
        title: 'Terreiro criado com sucesso!',
        description: `${nome} foi criado e você é o administrador.`,
      });

      navigate('/dashboard');
    } catch (err: any) {
      toast({
        title: 'Erro inesperado',
        description: err?.message ?? 'Tente novamente em alguns instantes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-foreground">🏛️</span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-sacred bg-clip-text text-transparent">
              Bem-vindo!
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Vamos configurar o seu terreiro
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nomeTerreiro">Nome do Terreiro</Label>
              <Input
                id="nomeTerreiro"
                type="text"
                placeholder="Ex: Terreiro de Iemanjá"
                value={nomeTerreiro}
                onChange={(e) => setNomeTerreiro(e.target.value)}
                required
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                Este será o nome principal do seu terreiro no sistema
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-sacred hover:opacity-90 transition-opacity"
              disabled={loading || !nomeTerreiro.trim()}
            >
              {loading ? 'Criando terreiro...' : 'Criar terreiro'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
