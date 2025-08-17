-- Drop existing RLS policies that depend on terreiro_id
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios membros" ON public.membros;
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios planos" ON public.planos;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias faturas" ON public.faturas;

-- Create terreiros table
CREATE TABLE IF NOT EXISTS public.terreiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table (user ↔ terreiro)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.terreiros(id) ON DELETE SET NULL,
  role TEXT CHECK (role IN ('owner','admin','viewer')) DEFAULT 'owner',
  nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update existing tables to new structure
ALTER TABLE public.membros 
  DROP COLUMN IF EXISTS terreiro_id CASCADE,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.terreiros(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS matricula TEXT,
  ADD COLUMN IF NOT EXISTS dt_nascimento DATE,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS data_admissao_terreiro DATE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Update planos table
ALTER TABLE public.planos 
  DROP COLUMN IF EXISTS terreiro_id CASCADE,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.terreiros(id) ON DELETE CASCADE;

-- Convert valor to valor_centavos if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'valor_centavos') THEN
    ALTER TABLE public.planos ADD COLUMN valor_centavos INTEGER;
    UPDATE public.planos SET valor_centavos = COALESCE((valor * 100)::INTEGER, 0) WHERE valor_centavos IS NULL;
    ALTER TABLE public.planos ALTER COLUMN valor_centavos SET NOT NULL;
    ALTER TABLE public.planos ADD CONSTRAINT check_valor_centavos_positive CHECK (valor_centavos > 0);
  END IF;
END $$;

-- Add dia_vencimento constraint
ALTER TABLE public.planos 
  DROP CONSTRAINT IF EXISTS check_dia_vencimento,
  ADD CONSTRAINT check_dia_vencimento CHECK (dia_vencimento BETWEEN 1 AND 28);

-- Update assinaturas table
ALTER TABLE public.assinaturas
  DROP COLUMN IF EXISTS terreiro_id CASCADE,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.terreiros(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS inicio DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS fim DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativa';

-- Add status constraint for assinaturas
ALTER TABLE public.assinaturas 
  DROP CONSTRAINT IF EXISTS check_assinatura_status,
  ADD CONSTRAINT check_assinatura_status CHECK (status IN ('ativa','pausada','cancelada'));

-- Update faturas table
ALTER TABLE public.faturas
  DROP COLUMN IF EXISTS terreiro_id CASCADE,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.terreiros(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS refer CHAR(6),
  ADD COLUMN IF NOT EXISTS dt_vencimento DATE,
  ADD COLUMN IF NOT EXISTS vl_desconto_centavos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dt_pagamento TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS vl_pago_centavos INTEGER,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS usuario_operacao TEXT,
  ADD COLUMN IF NOT EXISTS data_operacao TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Convert valor to valor_centavos for faturas if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'valor_centavos') THEN
    ALTER TABLE public.faturas ADD COLUMN valor_centavos INTEGER;
    UPDATE public.faturas SET valor_centavos = COALESCE((valor * 100)::INTEGER, 0) WHERE valor_centavos IS NULL;
    ALTER TABLE public.faturas ALTER COLUMN valor_centavos SET NOT NULL;
    ALTER TABLE public.faturas ADD CONSTRAINT check_valor_centavos_faturas_positive CHECK (valor_centavos > 0);
  END IF;
END $$;

-- Update status constraint for faturas
ALTER TABLE public.faturas 
  DROP CONSTRAINT IF EXISTS check_status,
  ADD CONSTRAINT check_status CHECK (status IN ('aberta','paga','atrasada','cancelada'));

-- Create pagamentos table
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fatura_id UUID NOT NULL REFERENCES public.faturas(id) ON DELETE CASCADE,
  pago_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  metodo TEXT,
  txn_id TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.terreiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for terreiros
CREATE POLICY "Users can view their terreiro" ON public.terreiros
  FOR SELECT USING (id = public.get_user_org_id());

CREATE POLICY "Users can update their terreiro" ON public.terreiros
  FOR UPDATE USING (id = public.get_user_org_id());

-- RLS Policies for other tables
CREATE POLICY "Users can manage their org membros" ON public.membros
  FOR ALL USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage their org planos" ON public.planos
  FOR ALL USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage their org assinaturas" ON public.assinaturas
  FOR ALL USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage their org faturas" ON public.faturas
  FOR ALL USING (org_id = public.get_user_org_id());

CREATE POLICY "Users can manage their org pagamentos" ON public.pagamentos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.faturas 
      WHERE id = pagamentos.fatura_id 
      AND org_id = public.get_user_org_id()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_membros_updated_at
  BEFORE UPDATE ON public.membros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_faturas_updated_at
  BEFORE UPDATE ON public.faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for auto-creating profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC: create_terreiro
CREATE OR REPLACE FUNCTION public.create_terreiro(nome_terreiro TEXT)
RETURNS UUID AS $$
DECLARE
  terreiro_id UUID;
BEGIN
  -- Create the terreiro
  INSERT INTO public.terreiros (nome)
  VALUES (nome_terreiro)
  RETURNING id INTO terreiro_id;
  
  -- Update user's profile with the org_id
  UPDATE public.profiles 
  SET org_id = terreiro_id, role = 'owner'
  WHERE user_id = auth.uid();
  
  RETURN terreiro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: gerar_faturas_mes
CREATE OR REPLACE FUNCTION public.gerar_faturas_mes(ano INTEGER, mes INTEGER)
RETURNS INTEGER AS $$
DECLARE
  user_org_id UUID;
  assinatura_record RECORD;
  refer_str CHAR(6);
  dt_venc DATE;
  faturas_created INTEGER := 0;
BEGIN
  -- Get user's org_id
  SELECT org_id INTO user_org_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not associated with any organization';
  END IF;
  
  -- Generate refer (AAAAMM)
  refer_str := LPAD(ano::TEXT, 4, '0') || LPAD(mes::TEXT, 2, '0');
  
  -- Loop through active subscriptions
  FOR assinatura_record IN 
    SELECT a.*, p.dia_vencimento, p.valor_centavos
    FROM public.assinaturas a
    JOIN public.planos p ON a.plano_id = p.id
    WHERE a.org_id = user_org_id 
    AND a.status = 'ativa'
    AND (a.fim IS NULL OR a.fim >= MAKE_DATE(ano, mes, 1))
  LOOP
    -- Calculate due date
    dt_venc := MAKE_DATE(ano, mes, assinatura_record.dia_vencimento);
    
    -- Check if fatura already exists for this refer
    IF NOT EXISTS (
      SELECT 1 FROM public.faturas 
      WHERE org_id = user_org_id 
      AND membro_id = assinatura_record.membro_id 
      AND refer = refer_str
    ) THEN
      -- Create fatura
      INSERT INTO public.faturas (
        org_id, membro_id, refer, dt_vencimento, 
        valor_centavos, status
      ) VALUES (
        user_org_id, assinatura_record.membro_id, refer_str, dt_venc,
        assinatura_record.valor_centavos, 'aberta'
      );
      
      faturas_created := faturas_created + 1;
    END IF;
  END LOOP;
  
  RETURN faturas_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;