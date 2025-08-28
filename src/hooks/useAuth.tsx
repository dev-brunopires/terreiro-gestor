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
    let feats: string[] = [];

    try {
      // carrega permissões explícitas
      if (prof?.user_id) {
        const { data, error } = await supabase
          .from('current_user_permissions')
          .select('permission');
        if (error) throw error;
        if (data?.length) {
          perms = data.map((d: any) => d.permission as string);
        }
      }
    } catch {
      // ignora, cai no fallback
    }

    // fallback por role
    if (!perms.length && prof?.role) {
      perms = rolePermissions[prof.role] ?? [];
    }

    // carrega features pelo plano da assinatura ativa
    if (prof?.org_id) {
      const { data: sub } = await supabase
        .from('assinaturas')
        .select('plano_id')
        .eq('org_id', prof.org_id)
        .eq('status', 'ativa')
        .maybeSingle();

      if (sub?.plano_id) {
        const { data: featsData } = await supabase
          .from('plan_features')
          .select('feature')
          .eq('plano_id', sub.plano_id);
        feats = (featsData ?? []).map(f => f.feature);
      }
    }

    setPermissions(perms);
    setFeatures(feats);
  };

  // ---- monta sessão + listener ----
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    init();
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // ---- carrega profile + perms + features quando user mudar ----
  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      setLoading(true);
      try {
        if (user?.id) {
          const prof = await loadProfile(user.id);
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
