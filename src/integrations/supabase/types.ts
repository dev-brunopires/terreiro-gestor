export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      assinaturas: {
        Row: {
          created_at: string | null
          dt_fim: string | null
          fim: string | null
          id: string
          inicio: string | null
          membro_id: string
          org_id: string
          plano_id: string
          status: string | null
          terreiro_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dt_fim?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          membro_id: string
          org_id: string
          plano_id: string
          status?: string | null
          terreiro_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dt_fim?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          membro_id?: string
          org_id?: string
          plano_id?: string
          status?: string | null
          terreiro_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_membros_ativos_sem_assinatura"
            referencedColumns: ["membro_id"]
          },
          {
            foreignKeyName: "assinaturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_stage_pagdiv_com_membro"
            referencedColumns: ["resolved_membro_id"]
          },
          {
            foreignKeyName: "assinaturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "assinaturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "assinaturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "assinaturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_plano_fk"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "assinaturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "assinaturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "assinaturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_produtos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          org_id: string
          terreiro_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          org_id: string
          terreiro_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          org_id?: string
          terreiro_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "categorias_produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "categorias_produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "categorias_produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "categorias_produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "categorias_produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "categorias_produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          assinatura_id: string
          cancelada_em: string | null
          cancelada_por: string | null
          created_at: string | null
          data_operacao: string | null
          data_pagamento: string | null
          data_vencimento: string
          dt_pagamento: string | null
          dt_vencimento: string | null
          external_id: string | null
          forma_pagamento_id: string | null
          id: string
          membro_id: string
          motivo_cancelamento: string | null
          org_id: string
          plano_id: string
          refer: string | null
          status: string | null
          terreiro_id: string
          updated_at: string | null
          usuario_operacao: string | null
          valor: number | null
          valor_centavos: number
          vl_desconto_centavos: number | null
          vl_pago_centavos: number | null
        }
        Insert: {
          assinatura_id: string
          cancelada_em?: string | null
          cancelada_por?: string | null
          created_at?: string | null
          data_operacao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          dt_pagamento?: string | null
          dt_vencimento?: string | null
          external_id?: string | null
          forma_pagamento_id?: string | null
          id?: string
          membro_id: string
          motivo_cancelamento?: string | null
          org_id: string
          plano_id: string
          refer?: string | null
          status?: string | null
          terreiro_id: string
          updated_at?: string | null
          usuario_operacao?: string | null
          valor?: number | null
          valor_centavos: number
          vl_desconto_centavos?: number | null
          vl_pago_centavos?: number | null
        }
        Update: {
          assinatura_id?: string
          cancelada_em?: string | null
          cancelada_por?: string | null
          created_at?: string | null
          data_operacao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          dt_pagamento?: string | null
          dt_vencimento?: string | null
          external_id?: string | null
          forma_pagamento_id?: string | null
          id?: string
          membro_id?: string
          motivo_cancelamento?: string | null
          org_id?: string
          plano_id?: string
          refer?: string | null
          status?: string | null
          terreiro_id?: string
          updated_at?: string | null
          usuario_operacao?: string | null
          valor?: number | null
          valor_centavos?: number
          vl_desconto_centavos?: number | null
          vl_pago_centavos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_membros_ativos_sem_assinatura"
            referencedColumns: ["membro_id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_stage_pagdiv_com_membro"
            referencedColumns: ["resolved_membro_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean
          codigo: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      itens_venda: {
        Row: {
          id: string
          preco_centavos: number
          produto_id: string
          quantidade: number
          total_centavos: number
          venda_id: string
        }
        Insert: {
          id?: string
          preco_centavos: number
          produto_id: string
          quantidade: number
          total_centavos: number
          venda_id: string
        }
        Update: {
          id?: string
          preco_centavos?: number
          produto_id?: string
          quantidade?: number
          total_centavos?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cidade_uf: string | null
          created_at: string | null
          email: string
          id: string
          nome: string
          notes: string | null
          origem: string | null
          plano: string
          status: string
          tamanho_terreiro: string | null
          telefone: string
          terreiro_nome: string
        }
        Insert: {
          cidade_uf?: string | null
          created_at?: string | null
          email: string
          id?: string
          nome: string
          notes?: string | null
          origem?: string | null
          plano: string
          status?: string
          tamanho_terreiro?: string | null
          telefone: string
          terreiro_nome: string
        }
        Update: {
          cidade_uf?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          notes?: string | null
          origem?: string | null
          plano?: string
          status?: string
          tamanho_terreiro?: string | null
          telefone?: string
          terreiro_nome?: string
        }
        Relationships: []
      }
      membros: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string | null
          data_admissao_terreiro: string | null
          data_cadastro: string | null
          data_nascimento: string | null
          digina: string | null
          docs: Json | null
          dt_nascimento: string | null
          email: string | null
          endereco: string | null
          espiritual_candomble: Json | null
          espiritual_umbanda: Json | null
          id: string
          matricula: string | null
          nome: string
          numero: string | null
          observacoes: Json | null
          org_id: string
          profissao: string | null
          telefone: string | null
          terreiro_id: string | null
          tipo_pessoa: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          data_admissao_terreiro?: string | null
          data_cadastro?: string | null
          data_nascimento?: string | null
          digina?: string | null
          docs?: Json | null
          dt_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          espiritual_candomble?: Json | null
          espiritual_umbanda?: Json | null
          id?: string
          matricula?: string | null
          nome: string
          numero?: string | null
          observacoes?: Json | null
          org_id: string
          profissao?: string | null
          telefone?: string | null
          terreiro_id?: string | null
          tipo_pessoa?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          data_admissao_terreiro?: string | null
          data_cadastro?: string | null
          data_nascimento?: string | null
          digina?: string | null
          docs?: Json | null
          dt_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          espiritual_candomble?: Json | null
          espiritual_umbanda?: Json | null
          id?: string
          matricula?: string | null
          nome?: string
          numero?: string | null
          observacoes?: Json | null
          org_id?: string
          profissao?: string | null
          telefone?: string | null
          terreiro_id?: string | null
          tipo_pessoa?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "membros_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "membros_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "membros_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          pos_venda_id: string | null
          produto_id: string
          quantidade: number
          referencia: string | null
          terreiro_id: string
          tipo: string
          venda_conv_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          pos_venda_id?: string | null
          produto_id: string
          quantidade: number
          referencia?: string | null
          terreiro_id: string
          tipo: string
          venda_conv_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          pos_venda_id?: string | null
          produto_id?: string
          quantidade?: number
          referencia?: string | null
          terreiro_id?: string
          tipo?: string
          venda_conv_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mov_est_pos_venda_fk"
            columns: ["pos_venda_id"]
            isOneToOne: false
            referencedRelation: "pos_vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_est_venda_fk"
            columns: ["venda_conv_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_estq_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "mov_estq_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_estq_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "mov_estq_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "mov_estq_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      org_access_requests: {
        Row: {
          approved_at: string | null
          created_at: string
          email: string
          id: string
          nome: string | null
          org_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          org_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          org_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "org_access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          id: string
          invited_by: string | null
          org_id: string
          role: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          invited_by?: string | null
          org_id: string
          role: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          estornado: boolean | null
          estornado_em: string | null
          estornado_por: string | null
          fatura_id: string
          forma_pagamento_id: string | null
          id: string
          motivo_estorno: string | null
          pago_em: string
          txn_id: string | null
          valor: number | null
          valor_centavos: number
        }
        Insert: {
          estornado?: boolean | null
          estornado_em?: string | null
          estornado_por?: string | null
          fatura_id: string
          forma_pagamento_id?: string | null
          id?: string
          motivo_estorno?: string | null
          pago_em?: string
          txn_id?: string | null
          valor?: number | null
          valor_centavos: number
        }
        Update: {
          estornado?: boolean | null
          estornado_em?: string | null
          estornado_por?: string | null
          fatura_id?: string
          forma_pagamento_id?: string | null
          id?: string
          motivo_estorno?: string | null
          pago_em?: string
          txn_id?: string | null
          valor?: number | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "v_faturas_exibicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "v_mensalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_diversos: {
        Row: {
          created_at: string | null
          data: string
          descricao: string | null
          estornado: boolean | null
          estornado_em: string | null
          estornado_por: string | null
          forma_pagamento_id: string
          id: string
          matricula: string | null
          membro_id: string | null
          motivo_estorno: string | null
          observacoes: string | null
          org_id: string | null
          pos_venda_id: string | null
          terreiro_id: string
          tipo: string
          usuario_operacao: string | null
          valor_centavos: number
        }
        Insert: {
          created_at?: string | null
          data?: string
          descricao?: string | null
          estornado?: boolean | null
          estornado_em?: string | null
          estornado_por?: string | null
          forma_pagamento_id: string
          id?: string
          matricula?: string | null
          membro_id?: string | null
          motivo_estorno?: string | null
          observacoes?: string | null
          org_id?: string | null
          pos_venda_id?: string | null
          terreiro_id: string
          tipo?: string
          usuario_operacao?: string | null
          valor_centavos: number
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao?: string | null
          estornado?: boolean | null
          estornado_em?: string | null
          estornado_por?: string | null
          forma_pagamento_id?: string
          id?: string
          matricula?: string | null
          membro_id?: string | null
          motivo_estorno?: string | null
          observacoes?: string | null
          org_id?: string | null
          pos_venda_id?: string | null
          terreiro_id?: string
          tipo?: string
          usuario_operacao?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_diversos_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_membros_ativos_sem_assinatura"
            referencedColumns: ["membro_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_stage_pagdiv_com_membro"
            referencedColumns: ["resolved_membro_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_pos_venda_id_fkey"
            columns: ["pos_venda_id"]
            isOneToOne: false
            referencedRelation: "pos_vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_diversos_metodos: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          terreiro_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          terreiro_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          terreiro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_diversos_metodos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_metodos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_metodos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_metodos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_metodos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_diversos_tipos: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          terreiro_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          terreiro_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          terreiro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_diversos_tipos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_tipos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_tipos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_tipos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pagamentos_diversos_tipos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          email: string | null
          id: string
          nome: string
          telefone: string | null
          terreiro_id: string | null
        }
        Insert: {
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          terreiro_id?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          terreiro_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pessoas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pessoas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pessoas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          ativo: boolean | null
          feature: string
          id: string
          plano_id: string
        }
        Insert: {
          ativo?: boolean | null
          feature: string
          id?: string
          plano_id: string
        }
        Update: {
          ativo?: boolean | null
          feature?: string
          id?: string
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dia_vencimento: number
          id: string
          is_default: boolean | null
          nome: string
          org_id: string
          terreiro_id: string
          updated_at: string | null
          valor_centavos: number
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dia_vencimento: number
          id?: string
          is_default?: boolean | null
          nome: string
          org_id: string
          terreiro_id: string
          updated_at?: string | null
          valor_centavos: number
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dia_vencimento?: number
          id?: string
          is_default?: boolean | null
          nome?: string
          org_id?: string
          terreiro_id?: string
          updated_at?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "planos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "planos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "planos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "planos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "planos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "planos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "planos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_venda_counters: {
        Row: {
          org_id: string
          prox_num: number
          seq: number
        }
        Insert: {
          org_id: string
          prox_num?: number
          seq?: number
        }
        Update: {
          org_id?: string
          prox_num?: number
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_venda_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_venda_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_venda_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_venda_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pos_venda_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_venda_itens: {
        Row: {
          id: string
          org_id: string | null
          preco_centavos: number
          produto_id: string
          quantidade: number
          terreiro_id: string
          total_centavos: number
          venda_id: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          preco_centavos: number
          produto_id: string
          quantidade: number
          terreiro_id: string
          total_centavos: number
          venda_id: string
        }
        Update: {
          id?: string
          org_id?: string | null
          preco_centavos?: number
          produto_id?: string
          quantidade?: number
          terreiro_id?: string
          total_centavos?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_venda_itens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_venda_itens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_venda_itens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_venda_itens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pos_venda_itens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_venda_itens_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_venda_itens_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_venda_itens_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_venda_itens_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pos_venda_itens_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "pos_vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_vendas: {
        Row: {
          created_at: string
          desconto_centavos: number
          id: string
          membro_id: string | null
          metodo_pagamento: string | null
          numero: number | null
          observacoes: string | null
          org_id: string
          pago_centavos: number
          serie: string | null
          subtotal_centavos: number
          terreiro_id: string
          total_centavos: number
          troco_centavos: number
          usuario_operacao: string | null
        }
        Insert: {
          created_at?: string
          desconto_centavos?: number
          id?: string
          membro_id?: string | null
          metodo_pagamento?: string | null
          numero?: number | null
          observacoes?: string | null
          org_id: string
          pago_centavos?: number
          serie?: string | null
          subtotal_centavos?: number
          terreiro_id: string
          total_centavos?: number
          troco_centavos?: number
          usuario_operacao?: string | null
        }
        Update: {
          created_at?: string
          desconto_centavos?: number
          id?: string
          membro_id?: string | null
          metodo_pagamento?: string | null
          numero?: number | null
          observacoes?: string | null
          org_id?: string
          pago_centavos?: number
          serie?: string | null
          subtotal_centavos?: number
          terreiro_id?: string
          total_centavos?: number
          troco_centavos?: number
          usuario_operacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_vendas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_membros_ativos_sem_assinatura"
            referencedColumns: ["membro_id"]
          },
          {
            foreignKeyName: "pos_vendas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_stage_pagdiv_com_membro"
            referencedColumns: ["resolved_membro_id"]
          },
          {
            foreignKeyName: "pos_vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pos_vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "pos_vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "pos_vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_vendas_numeracao: {
        Row: {
          org_id: string
          prox_num: number
        }
        Insert: {
          org_id: string
          prox_num?: number
        }
        Update: {
          org_id?: string
          prox_num?: number
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean | null
          categoria_id: string | null
          codigo_barras: string | null
          created_at: string | null
          descricao: string | null
          estoque: number | null
          estoque_atual: number | null
          id: string
          imagem_url: string | null
          nome: string
          org_id: string
          preco_centavos: number
          sku: string | null
          terreiro_id: string
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string | null
          descricao?: string | null
          estoque?: number | null
          estoque_atual?: number | null
          id?: string
          imagem_url?: string | null
          nome: string
          org_id: string
          preco_centavos: number
          sku?: string | null
          terreiro_id: string
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string | null
          descricao?: string | null
          estoque?: number | null
          estoque_atual?: number | null
          id?: string
          imagem_url?: string | null
          nome?: string
          org_id?: string
          preco_centavos?: number
          sku?: string | null
          terreiro_id?: string
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "produtos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "produtos_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean | null
          avatar_url: string | null
          created_at: string | null
          id: string
          membro_id: string | null
          must_reset_password: boolean | null
          nome: string | null
          org_id: string
          paused: boolean | null
          role: string | null
          user_id: string
        }
        Insert: {
          approved?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          membro_id?: string | null
          must_reset_password?: boolean | null
          nome?: string | null
          org_id: string
          paused?: boolean | null
          role?: string | null
          user_id: string
        }
        Update: {
          approved?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          membro_id?: string | null
          must_reset_password?: boolean | null
          nome?: string | null
          org_id?: string
          paused?: boolean | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_membros_ativos_sem_assinatura"
            referencedColumns: ["membro_id"]
          },
          {
            foreignKeyName: "profiles_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_stage_pagdiv_com_membro"
            referencedColumns: ["resolved_membro_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_org_contracts: {
        Row: {
          created_at: string | null
          fim: string | null
          id: string
          inicio: string
          org_id: string
          owner_email: string | null
          plan_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          org_id: string
          owner_email?: string | null
          plan_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          org_id?: string
          owner_email?: string | null
          plan_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_org_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "saas_org_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_org_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "saas_org_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "saas_org_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_org_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_org_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      saas_plan_features: {
        Row: {
          feature: string
          id: string
          plan_id: string
        }
        Insert: {
          feature: string
          id?: string
          plan_id: string
        }
        Update: {
          feature?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      saas_plans: {
        Row: {
          ativo: boolean
          descricao: string | null
          id: string
          nome: string
          preco_centavos: number
        }
        Insert: {
          ativo?: boolean
          descricao?: string | null
          id?: string
          nome: string
          preco_centavos: number
        }
        Update: {
          ativo?: boolean
          descricao?: string | null
          id?: string
          nome?: string
          preco_centavos?: number
        }
        Relationships: []
      }
      stage_pagdiv_antigo: {
        Row: {
          data_operacao: string | null
          data_pagamento: string | null
          forma_pagamento: string | null
          id_forma_pagamento: number | null
          id_pagamento_diverso: number | null
          id_pessoa_old: number | null
          matricula: string | null
          nome: string | null
          tipo_descricao: string | null
          usuario_operacao: string | null
          valor_reais: number | null
        }
        Insert: {
          data_operacao?: string | null
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id_forma_pagamento?: number | null
          id_pagamento_diverso?: number | null
          id_pessoa_old?: number | null
          matricula?: string | null
          nome?: string | null
          tipo_descricao?: string | null
          usuario_operacao?: string | null
          valor_reais?: number | null
        }
        Update: {
          data_operacao?: string | null
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id_forma_pagamento?: number | null
          id_pagamento_diverso?: number | null
          id_pessoa_old?: number | null
          matricula?: string | null
          nome?: string | null
          tipo_descricao?: string | null
          usuario_operacao?: string | null
          valor_reais?: number | null
        }
        Relationships: []
      }
      terreiros: {
        Row: {
          access_code: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          instagram: string | null
          join_code: string | null
          logo_bucket: string | null
          logo_path: string | null
          logo_url: string | null
          nome: string
          site: string | null
          telefone: string | null
          whatsapp: string | null
        }
        Insert: {
          access_code?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          join_code?: string | null
          logo_bucket?: string | null
          logo_path?: string | null
          logo_url?: string | null
          nome: string
          site?: string | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Update: {
          access_code?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          instagram?: string | null
          join_code?: string | null
          logo_bucket?: string | null
          logo_path?: string | null
          logo_url?: string | null
          nome?: string
          site?: string | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      tmp_assinaturas_stage: {
        Row: {
          fim: string | null
          inicio: string | null
          membro_matricula: string | null
          org_id: string | null
          plano_nome: string | null
          status: string | null
          terreiro_id: string | null
        }
        Insert: {
          fim?: string | null
          inicio?: string | null
          membro_matricula?: string | null
          org_id?: string | null
          plano_nome?: string | null
          status?: string | null
          terreiro_id?: string | null
        }
        Update: {
          fim?: string | null
          inicio?: string | null
          membro_matricula?: string | null
          org_id?: string | null
          plano_nome?: string | null
          status?: string | null
          terreiro_id?: string | null
        }
        Relationships: []
      }
      tmp_membros_stage: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          data_admissao_terreiro: string | null
          dt_nascimento: string | null
          email: string | null
          endereco: string | null
          matricula: string | null
          nome: string | null
          org_id: string | null
          profissao: string | null
          telefone: string | null
          terreiro_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          data_admissao_terreiro?: string | null
          dt_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          matricula?: string | null
          nome?: string | null
          org_id?: string | null
          profissao?: string | null
          telefone?: string | null
          terreiro_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          data_admissao_terreiro?: string | null
          dt_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          matricula?: string | null
          nome?: string | null
          org_id?: string | null
          profissao?: string | null
          telefone?: string | null
          terreiro_id?: string | null
        }
        Relationships: []
      }
      user_prefs: {
        Row: {
          created_at: string | null
          email_fin: boolean | null
          email_lem: boolean | null
          email_sys: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_fin?: boolean | null
          email_lem?: boolean | null
          email_sys?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_fin?: boolean | null
          email_lem?: boolean | null
          email_sys?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      venda_itens: {
        Row: {
          id: string
          preco_unit_centavos: number
          produto_id: string
          qtd: number
          subtotal_centavos: number
          venda_id: string
        }
        Insert: {
          id?: string
          preco_unit_centavos: number
          produto_id: string
          qtd: number
          subtotal_centavos: number
          venda_id: string
        }
        Update: {
          id?: string
          preco_unit_centavos?: number
          produto_id?: string
          qtd?: number
          subtotal_centavos?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          created_at: string | null
          desconto_centavos: number
          id: string
          membro_id: string | null
          metodo_pagamento: string | null
          observacoes: string | null
          org_id: string | null
          pago_centavos: number
          status: string
          subtotal_centavos: number
          terreiro_id: string
          total_centavos: number
          troco_centavos: number
          usuario_operacao: string | null
        }
        Insert: {
          created_at?: string | null
          desconto_centavos?: number
          id?: string
          membro_id?: string | null
          metodo_pagamento?: string | null
          observacoes?: string | null
          org_id?: string | null
          pago_centavos: number
          status?: string
          subtotal_centavos: number
          terreiro_id: string
          total_centavos: number
          troco_centavos?: number
          usuario_operacao?: string | null
        }
        Update: {
          created_at?: string | null
          desconto_centavos?: number
          id?: string
          membro_id?: string | null
          metodo_pagamento?: string | null
          observacoes?: string | null
          org_id?: string | null
          pago_centavos?: number
          status?: string
          subtotal_centavos?: number
          terreiro_id?: string
          total_centavos?: number
          troco_centavos?: number
          usuario_operacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_membros_ativos_sem_assinatura"
            referencedColumns: ["membro_id"]
          },
          {
            foreignKeyName: "vendas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_stage_pagdiv_com_membro"
            referencedColumns: ["resolved_membro_id"]
          },
          {
            foreignKeyName: "vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "vendas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "vendas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_user_permissions: {
        Row: {
          org_id: string | null
          permission: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      terreiro_metrics: {
        Row: {
          created_at: string | null
          faturas_abertas: number | null
          faturas_pagas: number | null
          nome: string | null
          org_id: string | null
          qtd_membros: number | null
          qtd_planos: number | null
        }
        Insert: {
          created_at?: string | null
          faturas_abertas?: never
          faturas_pagas?: never
          nome?: string | null
          org_id?: string | null
          qtd_membros?: never
          qtd_planos?: never
        }
        Update: {
          created_at?: string | null
          faturas_abertas?: never
          faturas_pagas?: never
          nome?: string | null
          org_id?: string | null
          qtd_membros?: never
          qtd_planos?: never
        }
        Relationships: []
      }
      v_current_org: {
        Row: {
          terreiro_id: string | null
          user_id: string | null
        }
        Insert: {
          terreiro_id?: string | null
          user_id?: string | null
        }
        Update: {
          terreiro_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_faturas_exibicao: {
        Row: {
          assinatura_id: string | null
          assinatura_status: string | null
          created_at: string | null
          data_vencimento: string | null
          dt_vencimento: string | null
          exibicao_status: string | null
          fatura_status: string | null
          id: string | null
          membro_ativo: boolean | null
          membro_id: string | null
          org_id: string | null
          plano_id: string | null
          terreiro_id: string | null
          updated_at: string | null
          valor: number | null
          valor_centavos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_membros_ativos_sem_assinatura"
            referencedColumns: ["membro_id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_stage_pagdiv_com_membro"
            referencedColumns: ["resolved_membro_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mensalidades: {
        Row: {
          assinatura_id: string | null
          assinatura_status: string | null
          created_at: string | null
          data_vencimento: string | null
          dt_vencimento: string | null
          fatura_status: string | null
          id: string | null
          membro_ativo: boolean | null
          membro_id: string | null
          org_id: string | null
          plano_id: string | null
          situacao: string | null
          terreiro_id: string | null
          updated_at: string | null
          valor: number | null
          valor_centavos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_membros_ativos_sem_assinatura"
            referencedColumns: ["membro_id"]
          },
          {
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "vw_stage_pagdiv_com_membro"
            referencedColumns: ["resolved_membro_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "faturas_terreiro_id_fkey"
            columns: ["terreiro_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_org_current_plan: {
        Row: {
          contract_id: string | null
          fim: string | null
          inicio: string | null
          org_id: string | null
          org_nome: string | null
          plan_id: string | null
          plan_nome: string | null
          preco_centavos: number | null
          status: string | null
        }
        Relationships: []
      }
      v_terreiros_com_contrato: {
        Row: {
          access_code: string | null
          cnpj: string | null
          contract_id: string | null
          contract_status: string | null
          email: string | null
          fim: string | null
          inicio: string | null
          join_code: string | null
          owner_email: string | null
          plan_id: string | null
          plano_saas_ativo: boolean | null
          plano_saas_nome: string | null
          plano_saas_preco_centavos: number | null
          telefone: string | null
          terreiro_created_at: string | null
          terreiro_id: string | null
          terreiro_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_org_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_org_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      v_terreiros_contratos: {
        Row: {
          access_code: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          contract_id: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          fim: string | null
          id: string | null
          inicio: string | null
          instagram: string | null
          join_code: string | null
          logo_bucket: string | null
          logo_path: string | null
          logo_url: string | null
          nome: string | null
          owner_email: string | null
          plan_id: string | null
          plano_ativo: boolean | null
          plano_nome: string | null
          preco_centavos: number | null
          site: string | null
          status: string | null
          telefone: string | null
          whatsapp: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_org_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_org_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      vw_membros_ativos_sem_assinatura: {
        Row: {
          matricula: string | null
          membro_id: string | null
          nome: string | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiro_metrics"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_org_current_plan"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_com_contrato"
            referencedColumns: ["terreiro_id"]
          },
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_terreiros_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_stage_pagdiv_com_membro: {
        Row: {
          data_operacao: string | null
          data_pagamento: string | null
          forma_pagamento: string | null
          id_forma_pagamento: number | null
          id_pagamento_diverso: number | null
          id_pessoa_old: number | null
          matricula: string | null
          nome: string | null
          resolved_membro_id: string | null
          tipo_descricao: string | null
          usuario_operacao: string | null
          valor_reais: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _clamp_dia: {
        Args: { ano: number; dia: number; mes: number }
        Returns: string
      }
      _column_exists: {
        Args: { p_column: string; p_schema: string; p_table: string }
        Returns: boolean
      }
      _compute_24_due_dates: {
        Args: { p_dia_venc: number; p_ref: string }
        Returns: string[]
      }
      _create_policy_if_not_exists: {
        Args: {
          p_check: string
          p_cmd: string
          p_policy_name: string
          p_table: unknown
          p_using: string
        }
        Returns: undefined
      }
      _ensure_rls_and_policies: {
        Args: {
          p_allow_auth_read?: boolean
          p_schema: string
          p_stage_only?: boolean
          p_table: string
        }
        Returns: undefined
      }
      _get_actor_user_id: { Args: { p_org_id: string }; Returns: string }
      _jwt_org_id: { Args: never; Returns: string }
      _last_day: { Args: { p_date: string }; Returns: string }
      _next_due_dates: {
        Args: { dia_venc: number; n?: number; start_date: string }
        Returns: {
          dt: string
        }[]
      }
      _rel_ident: {
        Args: { p_table: unknown }
        Returns: {
          relname: string
          schemaname: string
        }[]
      }
      _upsert_policy: {
        Args: {
          p_check: string
          p_cmd: string
          p_policy_name: string
          p_table: unknown
          p_using: string
        }
        Returns: undefined
      }
      apply_assinatura_to_open_faturas: {
        Args: { p_assinatura_id: string }
        Returns: number
      }
      apply_plano_to_open_faturas: {
        Args: {
          p_assinatura_id: string
          p_membro_id: string
          p_meses?: number
          p_org_id: string
          p_plano_id: string
        }
        Returns: undefined
      }
      brl_to_centavos: { Args: { v: number }; Returns: number }
      bulk_cria_assinaturas_faltantes: {
        Args: { p_org_id: string; p_plano_id: string }
        Returns: {
          assinatura_id: string
        }[]
      }
      cancel_member_open_invoices: {
        Args: { p_membro_id: string; p_org_id: string; p_user?: string }
        Returns: number
      }
      cleanup_and_generate_assinaturas_one_per_member: {
        Args: {
          p_gerar_faturas?: boolean
          p_org_id: string
          p_plano_id: string
          p_until?: string
          p_usuario?: string
        }
        Returns: {
          canceled_dups: number
          created_count: number
          skipped_inactive_members: number
          skipped_same_plan: number
          updated_count: number
        }[]
      }
      create_terreiro: { Args: { nome_terreiro: string }; Returns: string }
      current_org_id: { Args: never; Returns: string }
      debita_estoque_se_disponivel: {
        Args: { p_org: string; p_produto_id: string; p_qtd: number }
        Returns: boolean
      }
      debug_jwt: {
        Args: never
        Returns: {
          org_id_text: string
          org_id_uuid: string
          raw: Json
        }[]
      }
      dec_estoque: {
        Args: { p_org: string; p_produto: string; p_qtd: number }
        Returns: undefined
      }
      due_10_next_month: { Args: { p_competencia: string }; Returns: string }
      ensure_default_org: { Args: { p_nome?: string }; Returns: string }
      ensure_member_active_subscription: {
        Args: { p_membro_id: string; p_org_id: string }
        Returns: undefined
      }
      ensure_org_contract: {
        Args: { p_org_id: string; p_plan_id: string }
        Returns: string
      }
      ensure_org_contract_by_name: {
        Args: { p_org_id: string; p_plan_name: string }
        Returns: string
      }
      faturas_upsert: {
        Args: {
          p_assinatura_id: string
          p_dt_vencimento: string
          p_membro_id: string
          p_org_id: string
          p_plano_id: string
          p_terreiro_id: string
          p_valor_centavos: number
          p_vl_desconto_centavos: number
        }
        Returns: string
      }
      fn_safe_jwt_org_id: { Args: never; Returns: string }
      fp_resolve_id: { Args: { p_texto: string }; Returns: string }
      gen_faturas_for_assinatura:
        | {
            Args: { p_assinatura_id: string; p_meses?: number }
            Returns: undefined
          }
        | {
            Args: {
              p_assinatura_id: string
              p_meses?: number
              p_override_plano_id?: string
            }
            Returns: undefined
          }
      gen_short_code: { Args: never; Returns: string }
      generate_access_code: { Args: never; Returns: string }
      generate_missing_assinaturas_for_org: {
        Args: {
          p_gerar_fat?: boolean
          p_org_id: string
          p_plano_id: string
          p_until?: string
          p_usuario?: string
        }
        Returns: {
          created_count: number
          skipped_already_active: number
        }[]
      }
      generate_missing_faturas_for_assinatura: {
        Args: { p_assinatura_id: string; p_until?: string }
        Returns: number
      }
      generate_missing_faturas_for_member: {
        Args: { p_membro_id: string; p_org_id: string; p_until?: string }
        Returns: number
      }
      generate_missing_faturas_for_org: {
        Args: { p_org_id: string; p_until: string }
        Returns: {
          assinatura_id: string
          created_count: number
        }[]
      }
      generate_missing_faturas_for_org_with_user: {
        Args: { p_org_id: string; p_until: string; p_usuario?: string }
        Returns: {
          created_count: number
          membro_id: string
        }[]
      }
      generate_terreiro_code: { Args: never; Returns: string }
      gerar_faturas_mes: { Args: { ano: number; mes: number }; Returns: number }
      get_default_plano_id: { Args: { p_org_id: string }; Returns: string }
      get_terreiro_id_by_code: { Args: { p_code: string }; Returns: string }
      get_user_org_id: { Args: never; Returns: string }
      has_org_role: {
        Args: { allowed_roles: string[]; target_org: string }
        Returns: boolean
      }
      in_org: { Args: { target_org: string }; Returns: boolean }
      inc_estoque: {
        Args: { p_org: string; p_produto: string; p_qtd: number }
        Returns: undefined
      }
      is_org_admin: { Args: { target_org: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      jwt_org_id: { Args: never; Returns: string }
      membros_sem_assinatura_ativa: {
        Args: { p_org_id: string }
        Returns: {
          matricula: string
          membro_id: string
          nome: string
        }[]
      }
      membros_sem_assinatura_ativa_do_plano: {
        Args: { p_org_id: string; p_plano_id: string }
        Returns: {
          matricula: string
          membro_id: string
          nome: string
        }[]
      }
      my_org_id: { Args: never; Returns: string }
      next_matricula: { Args: { p_terreiro_id: string }; Returns: string }
      next_pos_num: { Args: { p_org: string }; Returns: number }
      next_pos_venda_num: { Args: { p_org?: string }; Returns: number }
      normalize_metodo: { Args: { m: string }; Returns: string }
      normalize_tipo: { Args: { t: string }; Returns: string }
      pos_next_number: { Args: { p_org: string }; Returns: number }
      regen_terreiro_code: { Args: { p_org_id: string }; Returns: string }
      reopen_future_canceled_invoices: {
        Args: { p_membro_id: string; p_org_id: string; p_user?: string }
        Returns: number
      }
      resolve_join_code: { Args: { p_code: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sql_increment_produto_estoque: {
        Args: { p_delta: number; p_org_id: string; p_produto_id: string }
        Returns: undefined
      }
      sync_faturas_valor_por_plano: {
        Args: { p_plano_id: string }
        Returns: number
      }
      sync_membro_status: {
        Args: { m_ativo: boolean; m_membro_id: string; m_org_id: string }
        Returns: undefined
      }
      toggle_membro_e_sincroniza: {
        Args: {
          p_ativar: boolean
          p_membro_id: string
          p_remover_futuras?: boolean
        }
        Returns: undefined
      }
      toggle_membro_status: {
        Args: {
          p_ativo: boolean
          p_membro_id: string
          p_org_id: string
          p_ref_date?: string
        }
        Returns: undefined
      }
      user_in_org: { Args: { member_org: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
