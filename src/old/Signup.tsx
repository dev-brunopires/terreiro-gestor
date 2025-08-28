// src/pages/Signup.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');

  // Opcional: entrar num terreiro existente via código
  const [joinCode, setJoinCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormInfo(null);

    if (!nome.trim()) return setFormError('Informe seu nome completo.');
    if (!email.trim()) return setFormError('Informe um e-mail válido.');
    if (password.length < 6) return setFormError('A senha deve ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return setFormError('As senhas não coincidem.');

    try {
      setLoading(true);

      // 1) Cria a conta
      const { error: signErr } = await signUp(email.trim().toLowerCase(), password, nome.trim());
      if (signErr) {
        setFormError(signErr.message ?? 'Erro ao criar conta.');
        return;
      }

      // 2) Obtém usuário atual (pode ser null se exigir confirmação de e-mail)
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      // 3) Se for informado joinCode, resolve org_id e vincula ao profiles
      const code = joinCode.trim();
      if (code) {
        const { data: orgId, error: rpcErr } = await supabase.rpc('resolve_join_code', { p_code: code });
        if (rpcErr) {
          setFormError(`Erro ao validar código: ${rpcErr.message}`);
          return;
        }
        if (!orgId) {
          setFormError('Código de terreiro inválido. Verifique com o administrador.');
          return;
        }

        // guarda intenção localmente caso ainda não haja sessão válida
        localStorage.setItem(
          'pending_profile_link',
          JSON.stringify({ org_id: orgId, nome, role: 'viewer' })
        );

        if (userId) {
          const { error: upsertErr } = await supabase
            .from('profiles')
            .upsert(
              {
                user_id: userId,
                org_id: orgId as string,
                role: 'viewer',
                nome: nome || null,
              },
              { onConflict: 'user_id' }
            );
          if (upsertErr) {
            setFormError('Conta criada, mas houve erro ao vincular ao terreiro: ' + upsertErr.message);
            return;
          }
        }

        setFormInfo('Cadastro criado e vinculado ao seu terreiro!');
        // Com joinCode, pode seguir para o app
        setTimeout(() => navigate('/dashboard'), 800);
        return;
      }

      // 4) Sem joinCode → não há mais onboarding
      //    Apenas informa e leva ao dashboard (ou login, se preferir).
      setFormInfo(
        'Conta criada! Aguarde o Superadmin vincular você a um terreiro (ou peça o código ao administrador).'
      );
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err: any) {
      setFormError(err?.message ?? 'Erro inesperado ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const disableSubmit =
    loading ||
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
              Se tiver um <b>código do terreiro</b>, informe abaixo para já entrar no seu grupo.
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

            {/* Código do terreiro (opcional) */}
            <div className="space-y-2">
              <Label htmlFor="joinCode">Código do Terreiro (opcional)</Label>
              <Input
                id="joinCode"
                type="text"
                placeholder="Ex.: 9f3a1c2b"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="bg-background/50 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Se não tiver, deixe em branco. O Superadmin poderá vincular você depois.
              </p>
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
