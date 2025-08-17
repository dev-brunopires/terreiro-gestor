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
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('create_terreiro', {
        nome_terreiro: nomeTerreiro
      });

      if (error) {
        toast({
          title: "Erro ao criar terreiro",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Terreiro criado com sucesso!",
        description: `${nomeTerreiro} foi criado e você é o administrador`,
      });

      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Tente novamente em alguns instantes",
        variant: "destructive",
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