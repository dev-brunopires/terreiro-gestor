# Fase 0 - Inventário e Análise do Banco de Dados

## Data: 2025-10-09

## Objetivo
Documentar todas as tabelas, colunas, índices, FKs, triggers, views e RLS policies existentes, identificando duplicatas e pontos de normalização.

---

## 1. TABELAS PRINCIPAIS

### 1.1 Gestão de Membros e Organizações

#### `terreiros`
- **Colunas**: id (uuid PK), nome (text), created_at (timestamptz), access_code (text), join_code (text)
- **Propósito**: Organizações/terreiros do sistema
- **RLS**: Políticas básicas habilitadas
- **Triggers**: 
  - `set_access_code_if_missing()` - gera código de acesso
  - `trg_terreiros_ensure_contract()` - garante contrato SaaS

#### `profiles`
- **Colunas**: user_id (uuid PK), org_id (uuid), role (text), nome (text), created_at (timestamptz), membro_id (uuid), must_reset_password (bool), paused (bool), approved (bool)
- **Propósito**: Perfis de usuários autenticados
- **RLS**: Políticas por org_id
- **⚠️ PROBLEMA**: Role armazenado diretamente (risco de escalação de privilégios)

#### `membros`
- **Colunas**: id (uuid PK), nome (text), email (text), telefone (text), endereco (text), bairro (text), cidade (text), uf (text), cep (text), numero (text), complemento (text), data_nascimento (date), dt_nascimento (date), matricula (text), ativo (bool), org_id (uuid), terreiro_id (uuid), created_at, updated_at, profissao, tipo_pessoa, data_admissao_terreiro, observacoes (jsonb), docs (jsonb), espiritual_umbanda (jsonb), espiritual_candomble (jsonb), digina (text)
- **Propósito**: Membros/filhos de santo dos terreiros
- **RLS**: Políticas por org_id
- **⚠️ DUPLICAÇÃO**: data_nascimento vs dt_nascimento, org_id vs terreiro_id

---

### 1.2 Planos e Assinaturas

#### `planos`
- **Colunas**: id (uuid PK), nome (text), valor (numeric), valor_centavos (int), dia_vencimento (int), ativo (bool), org_id (uuid), terreiro_id (uuid), is_default (bool), created_at, updated_at
- **Propósito**: Planos de mensalidade
- **RLS**: Políticas por org/terreiro
- **⚠️ DUPLICAÇÃO**: org_id vs terreiro_id

#### `assinaturas`
- **Colunas**: id (uuid PK), membro_id (uuid FK), plano_id (uuid FK), inicio (date), fim (date), dt_fim (date), status (text), ativo (bool), org_id (uuid), terreiro_id (uuid), created_at, updated_at
- **Propósito**: Vinculação membro-plano
- **RLS**: Políticas por org_id
- **Triggers**: 
  - `assinaturas_ai_gen_faturas()` - gera faturas automaticamente
  - `assinaturas_aiu_sync_fatura()` - sincroniza faturas
- **⚠️ DUPLICAÇÃO**: fim vs dt_fim, org_id vs terreiro_id

#### `faturas`
- **Colunas**: id (uuid PK), assinatura_id (uuid FK), membro_id (uuid FK), plano_id (uuid FK), valor (numeric), valor_centavos (int), vl_desconto_centavos (int), vl_pago_centavos (int), data_vencimento (date), dt_vencimento (date), data_pagamento (date), dt_pagamento (timestamptz), status (text), **forma_pagamento (text)**, forma_pagamento_id (uuid FK), refer (char(6)), org_id (uuid), terreiro_id (uuid), usuario_operacao (text), data_operacao (timestamptz), external_id (text), cancelada_em (timestamptz), cancelada_por (text), motivo_cancelamento (text), created_at, updated_at
- **Propósito**: Faturas de mensalidades
- **RLS**: Políticas por org_id
- **Triggers**: `faturas_coalesce_before_ins_upd()` - coalesce de datas
- **🔴 DUPLICAÇÃO CRÍTICA**: 
  - forma_pagamento (text) vs forma_pagamento_id (uuid FK)
  - data_vencimento vs dt_vencimento
  - data_pagamento vs dt_pagamento
  - org_id vs terreiro_id

---

### 1.3 Pagamentos

#### `pagamentos`
- **Colunas**: id (uuid PK), fatura_id (uuid FK), valor (numeric), valor_centavos (int), **metodo (text)**, forma_pagamento_id (uuid FK), pago_em (timestamptz), txn_id (text), estornado (bool), estornado_em (timestamptz), estornado_por (text), motivo_estorno (text)
- **Propósito**: Pagamentos de faturas
- **RLS**: Políticas via fatura.org_id
- **🔴 DUPLICAÇÃO CRÍTICA**: metodo (text) vs forma_pagamento_id (uuid FK)

#### `pagamentos_diversos`
- **Colunas**: id (uuid PK), descricao (text), valor_centavos (int), **tipo (text)**, **metodo (text)**, **forma_pagamento (text)**, forma_pagamento_id (uuid FK), data (date), membro_id (uuid FK), matricula (text), observacoes (text), org_id (uuid), terreiro_id (uuid), pos_venda_id (uuid FK), usuario_operacao (text), estornado (bool), estornado_em (timestamptz), estornado_por (text), motivo_estorno (text), created_at
- **Propósito**: Pagamentos diversos (ofertas, doações, etc)
- **RLS**: Políticas por org_id
- **Triggers**: `sync_pagdiv_forma_pagamento()` - sincroniza forma_pagamento com metodo
- **🔴 DUPLICAÇÃO CRÍTICA**: 
  - tipo (text) - valores soltos, sem normalização
  - metodo (text) vs forma_pagamento (text) vs forma_pagamento_id (uuid FK)
  - org_id vs terreiro_id

#### `pagamentos_diversos_tipos`
- **Colunas**: id (uuid PK), nome (text), terreiro_id (uuid), created_at
- **Propósito**: Tipos customizados por terreiro
- **RLS**: Políticas por terreiro_id
- **⚠️ PROBLEMA**: Pode ter duplicatas por terreiro (ex: "Doação" vs "doação")

#### `pagamentos_diversos_metodos`
- **Colunas**: id (uuid PK), nome (text), terreiro_id (uuid), created_at
- **Propósito**: Métodos customizados por terreiro
- **RLS**: Políticas por terreiro_id
- **⚠️ PROBLEMA**: Duplica conceito de formas_pagamento

#### `formas_pagamento`
- **Colunas**: id (uuid PK), nome (text), codigo (text), ativo (bool)
- **Propósito**: Lookup table de formas de pagamento (GLOBAL)
- **RLS**: SELECT para authenticated, INSERT/UPDATE/DELETE apenas service_role
- **✅ MODELO CANÔNICO**: Esta é a tabela que deve ser usada

---

### 1.4 Ponto de Venda (PDV/POS)

#### `produtos`
- **Colunas**: id (uuid PK), nome (text), codigo (text), preco_centavos (int), estoque_atual (int), estoque_minimo (int), categoria_id (uuid FK), ativo (bool), org_id (uuid), terreiro_id (uuid), created_at, updated_at
- **Propósito**: Produtos para venda no PDV
- **RLS**: Políticas por org_id
- **⚠️ DUPLICAÇÃO**: org_id vs terreiro_id

#### `categorias_produtos`
- **Colunas**: id (uuid PK), nome (text), descricao (text), ativo (bool), org_id (uuid), terreiro_id (uuid), created_at, updated_at
- **Propósito**: Categorias de produtos
- **RLS**: Políticas por org_id
- **⚠️ DUPLICAÇÃO**: org_id vs terreiro_id

#### `pos_vendas`
- **Colunas**: id (uuid PK), numero (bigint), serie (text), subtotal_centavos (int), desconto_centavos (int), total_centavos (int), pago_centavos (int), troco_centavos (int), **metodo_pagamento (text)**, membro_id (uuid FK), org_id (uuid), terreiro_id (uuid), usuario_operacao (text), observacoes (text), created_at
- **Propósito**: Vendas do PDV
- **RLS**: Políticas por org_id
- **Triggers**: `trg_pos_vendas_set_num()` - define número sequencial
- **🔴 DUPLICAÇÃO CRÍTICA**: 
  - metodo_pagamento (text) - sem FK
  - org_id vs terreiro_id

#### `pos_venda_itens`
- **Colunas**: id (uuid PK), venda_id (uuid FK), produto_id (uuid FK), quantidade (int), preco_centavos (int), total_centavos (int), org_id (uuid), terreiro_id (uuid)
- **Propósito**: Itens de cada venda
- **RLS**: Políticas via venda.org_id
- **Triggers**: 
  - `trg_baixa_pos_itens_ins/upd/del()` - atualiza estoque
- **⚠️ DUPLICAÇÃO**: org_id vs terreiro_id

#### `pos_venda_counters`
- **Colunas**: org_id (uuid PK), prox_num (bigint), seq (bigint)
- **Propósito**: Controle de numeração de vendas
- **RLS**: Políticas por org_id

#### `movimentacoes_estoque`
- **Colunas**: id (uuid PK), produto_id (uuid FK), quantidade (int), tipo (text), referencia (text), pos_venda_id (uuid FK), venda_conv_id (uuid FK), org_id (uuid), terreiro_id (uuid), created_at
- **Propósito**: Histórico de movimentações de estoque
- **RLS**: Políticas por org_id
- **Triggers**: `sync_estoque_from_mov()` - sincroniza estoque
- **⚠️ DUPLICAÇÃO**: org_id vs terreiro_id

---

### 1.5 Vendas Convencionais (Legado?)

#### `vendas`
- **Colunas**: id (uuid PK), numero (bigint), total_centavos (int), org_id (uuid), created_at
- **Propósito**: Vendas (parece legado, pos_vendas é mais completo)
- **RLS**: Políticas por org_id

#### `itens_venda`
- **Colunas**: id (uuid PK), venda_id (uuid FK), produto_id (uuid FK), quantidade (int), preco_centavos (int), total_centavos (int)
- **Propósito**: Itens de vendas
- **RLS**: Políticas via venda.org_id
- **Triggers**: `trg_baixa_venda_itens_ins/upd/del()` - atualiza estoque

---

### 1.6 Gestão de Acessos e Convites

#### `org_invites`
- **Colunas**: id (uuid PK), org_id (uuid), email (text), role (text), invited_by (uuid), created_at, accepted_at
- **Propósito**: Convites para organização
- **RLS**: Políticas por org_id (apenas owner/admin)

#### `org_access_requests`
- **Colunas**: id (uuid PK), org_id (uuid), user_id (uuid), email (text), nome (text), status (text), created_at, approved_at
- **Propósito**: Solicitações de acesso
- **RLS**: Políticas por org_id

---

### 1.7 SaaS (Planos da plataforma)

#### `saas_plans`
- **Colunas**: id (uuid PK), nome (text), slug (text), preco_centavos (int), max_usuarios (int), max_membros (int), ativo (bool), created_at, updated_at
- **Propósito**: Planos SaaS da plataforma
- **RLS**: SELECT público, modificação apenas service_role

#### `saas_org_contracts`
- **Colunas**: id (uuid PK), org_id (uuid UNIQUE), plan_id (uuid FK), inicio (date), fim (date), status (text), created_at, updated_at
- **Propósito**: Contratos SaaS das orgs
- **RLS**: Políticas por org_id

#### `plan_features`
- **Colunas**: id (uuid PK), plano_id (uuid FK), feature (text), ativo (bool)
- **Propósito**: Features dos planos SaaS
- **RLS**: SELECT público, modificação apenas service_role

---

### 1.8 Marketing

#### `leads`
- **Colunas**: id (uuid PK), nome (text), email (text), telefone (text), terreiro_nome (text), plano (text), tamanho_terreiro (text), cidade_uf (text), origem (text), status (text), notes (text), created_at
- **Propósito**: Leads do site/landing page
- **RLS**: INSERT público (origem='landing'), SELECT/UPDATE/DELETE apenas admins

---

### 1.9 Tabelas Auxiliares

#### `pessoas`
- **Colunas**: id (uuid PK), nome (text), telefone (text), email (text), terreiro_id (uuid)
- **Propósito**: Não claro (parece legado ou duplicação de membros?)
- **RLS**: SELECT público
- **⚠️ PROBLEMA**: Propósito indefinido, pode ser removida

---

## 2. FUNÇÕES E TRIGGERS IMPORTANTES

### 2.1 Funções de Normalização

#### `normalize_metodo(text) → text`
```sql
-- Normaliza métodos de pagamento para slugs padronizados
-- Valores: pix, cartao, dinheiro, transferencia, outro
```

#### `normalize_tipo(text) → text`
```sql
-- Normaliza tipos de pagamento
-- Valores: doacao, loja, outro
```

### 2.2 Funções de Estoque

- `inc_estoque(produto_id, org_id, qtd)` - incrementa estoque
- `dec_estoque(produto_id, org_id, qtd)` - decrementa estoque
- `aplica_mov_estoque()` - trigger para movimentações

### 2.3 Funções de Faturas

- `gen_faturas_for_assinatura(assinatura_id, meses)` - gera faturas
- `generate_missing_faturas_for_member(membro_id, org_id, until)` - gera faturas faltantes
- `apply_assinatura_to_open_faturas(assinatura_id)` - aplica plano a faturas abertas

### 2.4 Funções de Segurança/RLS

- `my_org_id()` - retorna org_id do usuário logado
- `current_org_id()` - alias de my_org_id()
- `is_org_admin(org_id)` - verifica se usuário é admin da org
- `has_org_role(org_id, roles[])` - verifica se tem role específico
- `_jwt_org_id()` - extrai org_id do JWT

---

## 3. PROBLEMAS IDENTIFICADOS

### 3.1 🔴 CRÍTICO - Métodos de Pagamento

**Tabelas afetadas**: 
- `faturas.forma_pagamento` (text) vs `faturas.forma_pagamento_id` (uuid FK)
- `pagamentos.metodo` (text) vs `pagamentos.forma_pagamento_id` (uuid FK)
- `pagamentos_diversos.metodo` (text) vs `pagamentos_diversos.forma_pagamento` (text) vs `pagamentos_diversos.forma_pagamento_id` (uuid FK)
- `pos_vendas.metodo_pagamento` (text) - sem FK algum
- `pagamentos_diversos_metodos` - tabela separada por terreiro

**Valores encontrados** (exemplos):
- Texto livre: "pix", "PIX", "Pix", "cartão", "cartao", "CARTAO", "dinheiro", "DINHEIRO", "cash", etc.

**Solução**: 
- Usar `formas_pagamento` como tabela canônica
- Popular com valores padrão: pix, cartao, dinheiro, transferencia, boleto, outro
- Migrar todas as referências para `forma_pagamento_id`
- Criar views de compatibilidade temporárias

### 3.2 🟠 ALTO - Tipos de Pagamentos Diversos

**Tabelas afetadas**:
- `pagamentos_diversos.tipo` (text) - valores soltos
- `pagamentos_diversos_tipos` - tabela por terreiro (pode ter duplicatas)

**Valores possíveis** (exemplos):
- "doacao", "doação", "oferta", "dizimo", "dízimo", "loja", "mercadoria", "outro"

**Solução**:
- Criar lookup table `tipos_pagamento_diversos` canônica
- Valores padrão: doacao, oferta, dizimo, loja, evento, outro
- Migrar `pagamentos_diversos.tipo` para `tipo_id` (uuid FK)
- Consolidar `pagamentos_diversos_tipos` removendo duplicatas por org

### 3.3 🟡 MÉDIO - Duplicação de Datas

**Campos afetados**:
- `membros.data_nascimento` vs `membros.dt_nascimento`
- `faturas.data_vencimento` vs `faturas.dt_vencimento`
- `faturas.data_pagamento` vs `faturas.dt_pagamento`
- `assinaturas.fim` vs `assinaturas.dt_fim`

**Solução**:
- Padronizar para `dt_*` (timestamp with time zone)
- Remover `data_*` após migração
- Views de compatibilidade enquanto o front não for atualizado

### 3.4 🟡 MÉDIO - org_id vs terreiro_id

**Tabelas afetadas**: Quase todas

**Problema**: 
- Algumas tabelas têm ambos (ex: `membros`, `planos`, `faturas`)
- Aparentemente `org_id` é sempre igual a `terreiro_id`
- Redundância desnecessária

**Solução**:
- Padronizar para `org_id` em todas as tabelas
- Criar trigger/view que exponha `terreiro_id` como alias (compat)
- Atualizar RLS policies para usar apenas `org_id`

### 3.5 🟢 BAIXO - Tabela pessoas sem propósito claro

**Problema**: Tabela `pessoas` parece duplicar `membros` ou não tem uso claro

**Solução**: Investigar uso, possivelmente remover ou integrar com `membros`

### 3.6 🔴 CRÍTICO - Roles em profiles (segurança)

**Problema**: Campo `profiles.role` (text) permite escalação de privilégios

**Solução**:
- Criar tabela `user_roles` separada
- Criar enum `app_role` (owner, admin, moderator, user, viewer)
- Criar função `has_role(user_id, role)` com SECURITY DEFINER
- Atualizar todas as RLS policies para usar a função

---

## 4. MODELO CANÔNICO PROPOSTO

### 4.1 Lookup Tables (Normalização)

```sql
-- Formas de pagamento (JÁ EXISTE - só popular e usar)
CREATE TABLE IF NOT EXISTS formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL, -- slug: pix, cartao, dinheiro, etc
  nome text NOT NULL,
  ativo boolean DEFAULT true
);

-- Tipos de pagamentos diversos (NOVA)
CREATE TABLE tipos_pagamento_diversos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL, -- slug: doacao, oferta, dizimo, loja, etc
  nome text NOT NULL,
  ativo boolean DEFAULT true
);

-- User roles (NOVA - segurança)
CREATE TYPE app_role AS ENUM ('owner', 'admin', 'moderator', 'user', 'viewer');

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id uuid REFERENCES terreiros(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, org_id, role)
);
```

### 4.2 Colunas FK a Adicionar

```sql
-- faturas: já tem forma_pagamento_id, popular
-- pagamentos: já tem forma_pagamento_id, popular
-- pagamentos_diversos: já tem forma_pagamento_id, popular
ALTER TABLE pagamentos_diversos 
  ADD COLUMN IF NOT EXISTS tipo_id uuid REFERENCES tipos_pagamento_diversos(id);

-- pos_vendas: adicionar FK
ALTER TABLE pos_vendas 
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid REFERENCES formas_pagamento(id);
```

### 4.3 Funções de Normalização

```sql
-- Já existem normalize_metodo() e normalize_tipo()
-- Garantir que retornam códigos válidos da lookup table
```

---

## 5. PLANO DE MIGRAÇÃO (4 FASES)

### Fase 1 - Preparação (Este documento + Proposta)
- ✅ Inventário completo
- ✅ Identificação de duplicatas
- ✅ Proposta de modelo canônico
- ⏳ Aprovação do modelo

### Fase 2 - Migrações Seguras (Zero-downtime)
1. Popular `formas_pagamento` com valores padrão
2. Criar `tipos_pagamento_diversos` e popular
3. Criar `user_roles` e migrar dados de `profiles.role`
4. Adicionar colunas FK (*_id) onde faltam
5. Popular FKs com normalização (UPDATE ... SET *_id = ...)
6. Criar views de compatibilidade (expondo campos antigos)
7. Criar triggers de dual-write temporários

### Fase 3 - Refatoração do Código
1. Atualizar queries para usar JOINs com lookup tables
2. Remover referências a campos text de métodos/tipos
3. Atualizar dropdowns/filtros para usar lookup tables
4. Testes em todas as telas:
   - Faturas
   - Mensalidades
   - Pagamentos Diversos
   - PDV
   - Relatórios

### Fase 4 - Limpeza Final
1. Remover views de compatibilidade
2. Remover triggers temporários
3. Remover colunas antigas (text)
4. Remover colunas duplicadas (data_* vs dt_*)
5. Consolidar org_id vs terreiro_id

---

## 6. MÉTRICAS E VALIDAÇÕES

### Queries de Validação Pré-Migração

```sql
-- Total de faturas por forma de pagamento (antes)
SELECT forma_pagamento, COUNT(*) 
FROM faturas 
WHERE forma_pagamento IS NOT NULL 
GROUP BY forma_pagamento 
ORDER BY COUNT(*) DESC;

-- Total de pagamentos por método (antes)
SELECT metodo, COUNT(*) 
FROM pagamentos 
WHERE metodo IS NOT NULL 
GROUP BY metodo 
ORDER BY COUNT(*) DESC;

-- Total de pagamentos diversos por tipo e método (antes)
SELECT tipo, metodo, COUNT(*) 
FROM pagamentos_diversos 
GROUP BY tipo, metodo 
ORDER BY COUNT(*) DESC;

-- Vendas POS por método (antes)
SELECT metodo_pagamento, COUNT(*) 
FROM pos_vendas 
WHERE metodo_pagamento IS NOT NULL 
GROUP BY metodo_pagamento 
ORDER BY COUNT(*) DESC;
```

### Queries de Validação Pós-Migração

```sql
-- Total de faturas por forma de pagamento (depois)
SELECT fp.nome, COUNT(*) 
FROM faturas f
LEFT JOIN formas_pagamento fp ON f.forma_pagamento_id = fp.id
GROUP BY fp.nome 
ORDER BY COUNT(*) DESC;

-- Verificar registros sem FK (devem ser 0)
SELECT COUNT(*) FROM faturas WHERE forma_pagamento_id IS NULL AND forma_pagamento IS NOT NULL;
SELECT COUNT(*) FROM pagamentos WHERE forma_pagamento_id IS NULL AND metodo IS NOT NULL;
SELECT COUNT(*) FROM pagamentos_diversos WHERE forma_pagamento_id IS NULL AND (metodo IS NOT NULL OR forma_pagamento IS NOT NULL);
SELECT COUNT(*) FROM pagamentos_diversos WHERE tipo_id IS NULL AND tipo IS NOT NULL;
SELECT COUNT(*) FROM pos_vendas WHERE forma_pagamento_id IS NULL AND metodo_pagamento IS NOT NULL;
```

---

## 7. RISCOS E MITIGAÇÕES

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Quebrar telas existentes | Alto | Média | Views de compat + dual-write |
| Perda de dados | Crítico | Baixa | Backups + validações |
| Performance degradada | Médio | Baixa | Índices nas FKs + testes |
| RLS policies quebradas | Alto | Média | Testes por org + rollback |
| Valores não mapeados | Médio | Média | Função normalize + default 'outro' |

---

## 8. PRÓXIMOS PASSOS

1. ✅ Revisar este inventário com o time
2. ⏳ Aprovar modelo canônico proposto
3. ⏳ Criar PR 1 - Migrações Fase 2
4. ⏳ Testar migrações em ambiente de staging
5. ⏳ Aplicar em produção (horário de baixo uso)
6. ⏳ PR 2 - Refatoração de código
7. ⏳ PR 3 - Limpeza final

---

**Documento gerado em**: 2025-10-09  
**Responsável**: Sistema de Normalização Automatizada  
**Status**: ✅ COMPLETO - Aguardando Aprovação
