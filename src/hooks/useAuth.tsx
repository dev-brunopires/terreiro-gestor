import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Role = 'owner' | 'admin' | 'viewer' | 'financeiro' | 'operador';

type Profile = {
  user_id: string;
  org_id: string | null;
  role: Role;
  nome: string | null;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;              // loading geral (auth + profile + permissions)
  authLoading: boolean;          // loading só do estado de auth
  profile: Profile | null;
  permissions: string[];
  can: (permission: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fallback local de permissões por papel (caso a view current_user_permissions não exista/retorne vazio)
const rolePermissions: Record<Role, string[]> = {
  owner: [
    'membros:create','membros:edit','membros:view',
    'faturas:gerar','faturas:pagar','planos:manage',
    'billing:view','logs:view','assinaturas:link','settings:view'
  ],
  admin: [
    'membros:create','membros:edit','membros:view',
    'faturas:gerar','faturas:pagar','planos:manage',
    'billing:view','logs:view','assinaturas:link','settings:view'
  ],
  financeiro: [
    'membros:view','faturas:gerar','faturas:pagar',
    'planos:manage','billing:view','logs:view','assinaturas:link','settings:view'
  ],
  operador: [
    'membros:create','membros:edit','membros:view','assinaturas:link','settings:view'
  ],
  viewer: ['membros:view']
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // loading geral

  const { toast } = useToast();

  // ---- helpers de carregamento de dados relacionados ao usuário ----
  const loadProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, org_id, role, nome')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) throw error;

    // Coerção de role para o tipo Role; default para 'viewer' se vier nulo/fora da lista
    const role = (data?.role as Role) ?? 'viewer';
    const prof: Profile | null = data
      ? { user_id: data.user_id, org_id: data.org_id, role, nome: data.nome }
      : null;

    setProfile(prof);
    return prof;
  };

  const loadPermissions = async (prof: Profile | null) => {
    // Tenta carregar da view escalável (Option B). Se falhar ou vier vazio, aplica fallback por role.
    // View esperada: public.current_user_permissions (cols: user_id, org_id, permission)
    try {
      if (prof?.user_id) {
        const { data, error } = await supabase
          .from('current_user_permissions')
          .select('permission');

        if (error) throw error;

        if (data && data.length > 0) {
          setPermissions(data.map((d: any) => d.permission as string));
          return;
        }
      }
    } catch {
      // Silencia e aplica fallback
    }

    // Fallback por role
    const fallback = prof?.role ? rolePermissions[prof.role] ?? [] : [];
    setPermissions(fallback);
  };

  // ---- on mount: sincroniza sessão e listener ----
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(session ?? null);
        setUser(session?.user ?? null);
        setAuthLoading(false);
      } catch {
        if (mounted) setAuthLoading(false);
      }
    };

    // Listener de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    init();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ---- quando o user mudar, carrega profile + permissions ----
  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      setLoading(true);
      try {
        if (user?.id) {
          const prof = await loadProfile(user.id);
          await loadPermissions(prof);
        } else {
          setProfile(null);
          setPermissions([]);
        }
      } catch (err: any) {
        // Se der erro, zera perfil/perms para evitar estados incorretos
        setProfile(null);
        setPermissions([]);
        toast({
          title: 'Falha ao carregar perfil',
          description: err?.message ?? 'Erro inesperado ao carregar dados do usuário.',
          variant: 'destructive'
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    hydrate();
    return () => { active = false; };
  }, [user, toast]);

  // ---- helper can() ----
  const can = useMemo(() => {
    const setPerms = new Set(permissions);
    return (permission: string) => setPerms.has(permission);
  }, [permissions]);

  // ---- auth actions ----
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message || 'Erro no login';
        toast({ title: 'Erro no login', description: msg, variant: 'destructive' });
        return { error: msg };
      }
      toast({ title: 'Login realizado com sucesso!', description: 'Bem-vindo ao Terreiro Gestor' });
      return {};
    } catch {
      const message = 'Erro inesperado no login';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return { error: message };
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const redirectUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { nome }
        }
      });

      if (error) {
        const msg = error.message || 'Erro no cadastro';
        toast({ title: 'Erro no cadastro', description: msg, variant: 'destructive' });
        return { error: msg };
      }

      toast({
        title: 'Cadastro realizado com sucesso!',
        description: 'Verifique seu email para confirmar a conta'
      });

      return {};
    } catch {
      const message = 'Erro inesperado no cadastro';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return { error: message };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setPermissions([]);
      toast({ title: 'Logout realizado', description: 'Até logo!' });
    } catch {
      toast({
        title: 'Erro no logout',
        description: 'Erro inesperado',
        variant: 'destructive'
      });
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,        // pronto para render com perfil/permissões
    authLoading,    // pronto só para decidir se há sessão
    profile,
    permissions,
    can,
    signIn,
    signUp,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
