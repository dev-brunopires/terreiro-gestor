// src/pages/Login.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const code = orgCode.trim();
    if (!code) return setFormError('Informe o código do terreiro.');

    setLoading(true);
    try {
      // 1) Resolve orgId: aceita UUID ou código curto via RPC
      let orgId: string | null = null;

      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRe.test(code)) {
        // UUID direto (útil para testes)
        const { data } = await supabase.from('terreiros').select('id').eq('id', code).maybeSingle();
        orgId = data?.id ?? null;
      } else {
        // Código curto -> RPC SECURITY DEFINER (não quebra RLS)
        const { data, error: rpcErr } = await supabase.rpc('get_terreiro_id_by_code', { p_code: code });
        if (rpcErr) throw rpcErr;
        orgId = (data as string) ?? null;
      }

      if (!orgId) {
        setFormError('Código do terreiro inválido. Verifique com o administrador.');
        setLoading(false);
        return;
      }

      // 2) Autentica
      const { error } = await signIn(email, password);
      if (error) {
        setFormError(typeof error === 'string' ? error : (error as any)?.message ?? 'Falha ao entrar. Verifique suas credenciais.');
        setLoading(false);
        return;
      }

      // 3) Vincula/atualiza profile do usuário para esse terreiro
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) {
        setFormError('Usuário não autenticado após o login.');
        setLoading(false);
        return;
      }

      // preserva role/nome se já existir
      const { data: existing } = await supabase
        .from('profiles')
        .select('role, nome')
        .eq('user_id', userId)
        .maybeSingle();

      const role = existing?.role ?? 'viewer';
      const nome = existing?.nome ?? null;

      const { error: upErr } = await supabase
        .from('profiles')
        .upsert(
          { user_id: userId, org_id: orgId, role, nome },
          { onConflict: 'user_id' }
        );
      if (upErr) {
        setFormError('Login feito, mas não foi possível vincular ao terreiro: ' + upErr.message);
        setLoading(false);
        return;
      }

      localStorage.setItem('last_org_code', code);
      localStorage.setItem('last_org_id', orgId);

      navigate('/dashboard');
    } catch (err: any) {
      setFormError(err?.message ?? 'Erro inesperado ao entrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-foreground">🕯️</span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-sacred bg-clip-text text-transparent">
              Terreiro Gestor
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Sistema de gestão para terreiros
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com"
                     value={email} onChange={(e) => setEmail(e.target.value)}
                     required className="bg-background/50" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="Sua senha"
                     value={password} onChange={(e) => setPassword(e.target.value)}
                     required className="bg-background/50" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgCode">Código do Terreiro</Label>
              <Input id="orgCode" placeholder="Ex.: A7B9XK ou UUID"
                     value={orgCode} onChange={(e) => setOrgCode(e.target.value)}
                     required className="bg-background/50 font-mono" />
              <p className="text-xs text-muted-foreground">
                Informe o código fornecido pelo seu terreiro. Não exibimos nomes de outras organizações.
              </p>
            </div>

            {formError && <div className="text-sm text-destructive">{formError}</div>}

            <Button type="submit" className="w-full bg-gradient-sacred hover:opacity-90 transition-opacity" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
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
              Não tem uma conta?{' '}
              <Link to="/signup" className="text-primary hover:text-accent transition-colors font-medium">
                Cadastre-se aqui
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
