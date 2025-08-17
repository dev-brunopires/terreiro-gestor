-- Drop existing RLS policies first
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios membros" ON public.membros;
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios planos" ON public.planos;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias faturas" ON public.faturas;

-- Create terreiros and profiles tables
CREATE TABLE IF NOT EXISTS public.terreiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.terreiros(id) ON DELETE SET NULL,
  role TEXT CHECK (role IN ('owner','admin','viewer')) DEFAULT 'owner',
  nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create pagamentos table
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fatura_id UUID NOT NULL REFERENCES public.faturas(id) ON DELETE CASCADE,
  pago_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  metodo TEXT,
  txn_id TEXT
);

-- Add new columns to existing tables only if they don't exist
DO $$
BEGIN
  -- Add columns to membros
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membros' AND column_name = 'org_id') THEN
    ALTER TABLE public.membros ADD COLUMN org_id UUID REFERENCES public.terreiros(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membros' AND column_name = 'matricula') THEN
    ALTER TABLE public.membros ADD COLUMN matricula TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membros' AND column_name = 'dt_nascimento') THEN
    ALTER TABLE public.membros ADD COLUMN dt_nascimento DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membros' AND column_name = 'endereco') THEN
    ALTER TABLE public.membros ADD COLUMN endereco TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membros' AND column_name = 'bairro') THEN
    ALTER TABLE public.membros ADD COLUMN bairro TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membros' AND column_name = 'cep') THEN
    ALTER TABLE public.membros ADD COLUMN cep TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membros' AND column_name = 'data_admissao_terreiro') THEN
    ALTER TABLE public.membros ADD COLUMN data_admissao_terreiro DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membros' AND column_name = 'observacoes') THEN
    ALTER TABLE public.membros ADD COLUMN observacoes TEXT;
  END IF;

  -- Add columns to planos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'org_id') THEN
    ALTER TABLE public.planos ADD COLUMN org_id UUID REFERENCES public.terreiros(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'valor_centavos') THEN
    ALTER TABLE public.planos ADD COLUMN valor_centavos INTEGER;
  END IF;

  -- Add columns to assinaturas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assinaturas' AND column_name = 'org_id') THEN
    ALTER TABLE public.assinaturas ADD COLUMN org_id UUID REFERENCES public.terreiros(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assinaturas' AND column_name = 'inicio') THEN
    ALTER TABLE public.assinaturas ADD COLUMN inicio DATE DEFAULT CURRENT_DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assinaturas' AND column_name = 'fim') THEN
    ALTER TABLE public.assinaturas ADD COLUMN fim DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assinaturas' AND column_name = 'status') THEN
    ALTER TABLE public.assinaturas ADD COLUMN status TEXT DEFAULT 'ativa';
  END IF;

  -- Add columns to faturas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'org_id') THEN
    ALTER TABLE public.faturas ADD COLUMN org_id UUID REFERENCES public.terreiros(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'refer') THEN
    ALTER TABLE public.faturas ADD COLUMN refer CHAR(6);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'dt_vencimento') THEN
    ALTER TABLE public.faturas ADD COLUMN dt_vencimento DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'valor_centavos') THEN
    ALTER TABLE public.faturas ADD COLUMN valor_centavos INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'vl_desconto_centavos') THEN
    ALTER TABLE public.faturas ADD COLUMN vl_desconto_centavos INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'dt_pagamento') THEN
    ALTER TABLE public.faturas ADD COLUMN dt_pagamento TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'vl_pago_centavos') THEN
    ALTER TABLE public.faturas ADD COLUMN vl_pago_centavos INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'forma_pagamento') THEN
    ALTER TABLE public.faturas ADD COLUMN forma_pagamento TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'external_id') THEN
    ALTER TABLE public.faturas ADD COLUMN external_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'usuario_operacao') THEN
    ALTER TABLE public.faturas ADD COLUMN usuario_operacao TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faturas' AND column_name = 'data_operacao') THEN
    ALTER TABLE public.faturas ADD COLUMN data_operacao TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE public.terreiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Create security definer function
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create RLS policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their terreiro" ON public.terreiros
  FOR SELECT USING (id = public.get_user_org_id());

CREATE POLICY "Users can update their terreiro" ON public.terreiros
  FOR UPDATE USING (id = public.get_user_org_id());

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

-- Create auto-profile function and trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create RPC functions
CREATE OR REPLACE FUNCTION public.create_terreiro(nome_terreiro TEXT)
RETURNS UUID AS $$
DECLARE
  terreiro_id UUID;
BEGIN
  INSERT INTO public.terreiros (nome)
  VALUES (nome_terreiro)
  RETURNING id INTO terreiro_id;
  
  UPDATE public.profiles 
  SET org_id = terreiro_id, role = 'owner'
  WHERE user_id = auth.uid();
  
  RETURN terreiro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.gerar_faturas_mes(ano INTEGER, mes INTEGER)
RETURNS INTEGER AS $$
DECLARE
  user_org_id UUID;
  assinatura_record RECORD;
  refer_str CHAR(6);
  dt_venc DATE;
  faturas_created INTEGER := 0;
BEGIN
  SELECT org_id INTO user_org_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not associated with any organization';
  END IF;
  
  refer_str := LPAD(ano::TEXT, 4, '0') || LPAD(mes::TEXT, 2, '0');
  
  FOR assinatura_record IN 
    SELECT a.*, p.dia_vencimento, p.valor_centavos
    FROM public.assinaturas a
    JOIN public.planos p ON a.plano_id = p.id
    WHERE a.org_id = user_org_id 
    AND a.status = 'ativa'
    AND (a.fim IS NULL OR a.fim >= MAKE_DATE(ano, mes, 1))
  LOOP
    dt_venc := MAKE_DATE(ano, mes, assinatura_record.dia_vencimento);
    
    IF NOT EXISTS (
      SELECT 1 FROM public.faturas 
      WHERE org_id = user_org_id 
      AND membro_id = assinatura_record.membro_id 
      AND refer = refer_str
    ) THEN
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