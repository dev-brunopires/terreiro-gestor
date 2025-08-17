import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/10">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto mb-4"></div>
          <div className="w-32 h-4 bg-muted rounded mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-sacred flex items-center justify-center">
            <span className="text-3xl font-bold text-primary-foreground">🕯️</span>
          </div>
          <div>
            <CardTitle className="text-4xl font-bold bg-gradient-sacred bg-clip-text text-transparent mb-2">
              Terreiro Gestor
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Sistema completo de gestão para terreiros de Umbanda e Candomblé
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-primary">Gestão de Membros</h3>
              <p className="text-sm text-muted-foreground">
                Cadastre e gerencie todos os membros do seu terreiro com informações completas
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-accent">Controle Financeiro</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie mensalidades, faturas e pagamentos de forma organizada
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-secondary">Relatórios Detalhados</h3>
              <p className="text-sm text-muted-foreground">
                Acompanhe a evolução financeira com relatórios completos
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-primary">Segurança Total</h3>
              <p className="text-sm text-muted-foreground">
                Dados protegidos com autenticação segura e controle de acesso
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-gradient-sacred hover:opacity-90 transition-opacity"
              onClick={() => navigate('/signup')}
            >
              Começar Agora
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
              onClick={() => navigate('/login')}
            >
              Já tenho conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
