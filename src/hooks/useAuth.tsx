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
  loading: boolean;
  authLoading: boolean;
  profile: Profile | null;
  permissions: string[];   // role + plano
  features: string[];      // features vindas do plano
  can: (permission: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// fallback por role
const rolePermissions: Record<Role, string[]> = {
  owner: ['membros:create','membros:edit','membros:view','faturas:gerar','faturas:pagar','planos:manage','billing:view','logs:view','assinaturas:link','settings:view'],
  admin: ['membros:create','membros:edit','membros:view','faturas:gerar','faturas:pagar','planos:manage','billing:view','logs:view','assinaturas:link','settings:view'],
  financeiro: ['membros:view','faturas:gerar','faturas:pagar','planos:manage','billing:view','logs:view','assinaturas:link','settings:view'],
  operador: ['membros:create','membros:edit','membros:view','assinaturas:link','settings:view'],
  viewer: ['membros:view']
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  // ---- helpers ----
  const loadProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, org_id, role, nome')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) throw error;

    const role = (data?.role as Role) ?? 'viewer';
    const prof: Profile | null = data
      ? { user_id: data.user_id, org_id: data.org_id, role, nome: data.nome }
      : null;

    setProfile(prof);
    return prof;
  };

  const loadPermissionsAndFeatures = async (prof: Profile | null) => {
    let perms: string[] = [];
    const feats: string[] = [];

    // Usar permissões baseadas em role apenas
    if (prof?.role) {
      perms = rolePermissions[prof.role] ?? [];
    }

    setPermissions(perms);
    setFeatures(feats);
  };

  // ---- monta sessão + listener ----
  useEffect(() => {
    let mounted = true;
    let initialSessionLoaded = false;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        initialSessionLoaded = true;
        setSession(session ?? null);
        setUser(session?.user ?? null);
        setAuthLoading(false);
      } catch {
        if (mounted) {
          initialSessionLoaded = true;
          setAuthLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Ignora eventos de TOKEN_REFRESHED e INITIAL_SESSION após carregamento inicial
      // para evitar re-renders desnecessários ao voltar para a aba
      if (initialSessionLoaded && (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        return;
      }

      // Só atualiza se o user_id realmente mudou (login/logout)
      setSession(prev => {
        const prevUserId = prev?.user?.id;
        const newUserId = newSession?.user?.id;
        if (prevUserId === newUserId && prev !== null && newSession !== null) {
          return prev; // Mantém referência estável
        }
        return newSession ?? null;
      });

      setUser(prev => {
        const prevId = prev?.id;
        const newId = newSession?.user?.id;
        if (prevId === newId && prev !== null && newSession?.user !== null) {
          return prev; // Mantém referência estável
        }
        return newSession?.user ?? null;
      });

      setAuthLoading(false);
    });

    init();
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // ---- carrega profile + perms + features quando user mudar ----
  // Usa user?.id como dependência em vez de user para evitar re-renders desnecessários
  const userId = user?.id;
  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      setLoading(true);
      try {
        if (userId) {
          const prof = await loadProfile(userId);
          await loadPermissionsAndFeatures(prof);
        } else {
          setProfile(null);
          setPermissions([]);
          setFeatures([]);
        }
      } catch (err: any) {
        setProfile(null);
        setPermissions([]);
        setFeatures([]);
        console.error('Falha ao carregar perfil:', err?.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    hydrate();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---- can() leva em conta permissions + features ----
  const can = useMemo(() => {
    const setPerms = new Set([...permissions, ...features.map(f => `feature:${f}`)]);
    return (permission: string) => setPerms.has(permission);
  }, [permissions, features]);

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
      setFeatures([]);
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
    loading,
    authLoading,
    profile,
    permissions,
    features,
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
