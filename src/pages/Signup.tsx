// src/pages/Signup.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Terreiro = { id: string; nome: string };

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');

  const [terreiros, setTerreiros] = useState<Terreiro[]>([]);
  const [terreiroId, setTerreiroId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingTerreiros, setLoadingTerreiros] = useState(true);
  const [erroTerreiros, setErroTerreiros] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Carrega lista de terreiros para seleção
  useEffect(() => {
    (async () => {
      setLoadingTerreiros(true);
      setErroTerreiros(null);
      const { data, error } = await supabase
        .from('terreiros')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) {
        setErroTerreiros(error.message);
        setTerreiros([]);
      } else {
        setTerreiros((data ?? []) as Terreiro[]);
      }
      setLoadingTerreiros(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormInfo(null);

    if (!nome.trim()) return setFormError('Informe seu nome completo.');
    if (!email.trim()) return setFormError('Informe um e-mail válido.');
    if (password.length < 6) return setFormError('A senha deve ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return setFormError('As senhas não coincidem.');
    if (!terreiroId) return setFormError('Selecione um terreiro.');

    try {
      setLoading(true);

      // 1) Cria a conta (sem depender de confirmação por e-mail)
      // Se o seu useAuth.signUp enviar confirmação por e-mail, remova isso no hook.
      const { error: signErr } = await signUp(email, password, nome);
      if (signErr) {
        setFormError(signErr.message ?? 'Erro ao criar conta.');
        setLoading(false);
        return;
      }

      // 2) Obtém o usuário (pode ser null se seu projeto ainda exige confirmação de e-mail)
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;

      // Guardamos a intenção localmente como fallback
      localStorage.setItem(
        'pending_profile_link',
        JSON.stringify({ org_id: terreiroId, nome })
      );

      if (userId) {
        // 3) Vincula ao terreiro com approved = false (aguardando aprovação)
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert(
            {
              user_id: userId,
              org_id: terreiroId,
              role: 'viewer',     // conforme CHECK/enum existente
              nome: nome || null,
              approved: false,    // <- chave: aguardando aprovação
            },
            { onConflict: 'user_id' }
          );

        if (upsertErr) {
          setFormError('Conta criada, mas houve erro ao vincular ao terreiro: ' + upsertErr.message);
          setLoading(false);
          return;
        }
      }

      // 4) Mensagem e redirecionamento para login
      setFormInfo('Cadastro enviado! Aguarde a aprovação do administrador do terreiro.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err: any) {
      setFormError(err?.message ?? 'Erro inesperado ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const disableSubmit =
    loading ||
    loadingTerreiros ||
    !terreiroId ||
    !email ||
    !password ||
    !confirmPassword ||
    password !== confirmPassword ||
    !nome;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-foreground">🕯️</span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-sacred bg-clip-text text-transparent">
              Criar Conta
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Selecione seu terreiro para concluir o cadastro
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Terreiro</Label>
              <Select
                value={terreiroId}
                onValueChange={(v) => setTerreiroId(v)}
                disabled={loadingTerreiros || !!erroTerreiros}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue
                    placeholder={
                      loadingTerreiros
                        ? 'Carregando terreiros...'
                        : erroTerreiros
                        ? 'Erro ao carregar'
                        : 'Selecione o seu terreiro'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {terreiros.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {erroTerreiros && (
                <p className="text-xs text-destructive mt-1">
                  Não foi possível carregar a lista. Verifique as permissões de leitura (RLS) da tabela <code>terreiros</code>.
                </p>
              )}
              {!erroTerreiros && !loadingTerreiros && terreiros.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum terreiro disponível para auto‑cadastro.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-background/50"
              />
              {password !== confirmPassword && confirmPassword && (
                <p className="text-sm text-destructive">As senhas não coincidem</p>
              )}
            </div>

            {formError && <div className="text-sm text-destructive">{formError}</div>}
            {formInfo && <div className="text-sm text-emerald-600">{formInfo}</div>}

            <Button
              type="submit"
              className="w-full bg-gradient-sacred hover:opacity-90 transition-opacity"
              disabled={disableSubmit}
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </Button>
          </form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              ou
            </span>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:text-accent transition-colors font-medium">
                Faça login aqui
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
