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
          ativo: boolean | null
          created_at: string | null
          data_inicio: string | null
          fim: string | null
          id: string
          inicio: string | null
          membro_id: string
          org_id: string | null
          plano_id: string
          status: string | null
          terreiro_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data_inicio?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          membro_id: string
          org_id?: string | null
          plano_id: string
          status?: string | null
          terreiro_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data_inicio?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          membro_id?: string
          org_id?: string | null
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
            foreignKeyName: "assinaturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          assinatura_id: string
          created_at: string | null
          data_operacao: string | null
          data_pagamento: string | null
          data_vencimento: string
          dt_pagamento: string | null
          dt_vencimento: string | null
          external_id: string | null
          forma_pagamento: string | null
          id: string
          membro_id: string
          org_id: string | null
          plano_id: string
          refer: string | null
          status: string | null
          terreiro_id: string
          updated_at: string | null
          usuario_operacao: string | null
          valor: number
          valor_centavos: number | null
          vl_desconto_centavos: number | null
          vl_pago_centavos: number | null
        }
        Insert: {
          assinatura_id: string
          created_at?: string | null
          data_operacao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          dt_pagamento?: string | null
          dt_vencimento?: string | null
          external_id?: string | null
          forma_pagamento?: string | null
          id?: string
          membro_id: string
          org_id?: string | null
          plano_id: string
          refer?: string | null
          status?: string | null
          terreiro_id: string
          updated_at?: string | null
          usuario_operacao?: string | null
          valor: number
          valor_centavos?: number | null
          vl_desconto_centavos?: number | null
          vl_pago_centavos?: number | null
        }
        Update: {
          assinatura_id?: string
          created_at?: string | null
          data_operacao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          dt_pagamento?: string | null
          dt_vencimento?: string | null
          external_id?: string | null
          forma_pagamento?: string | null
          id?: string
          membro_id?: string
          org_id?: string | null
          plano_id?: string
          refer?: string | null
          status?: string | null
          terreiro_id?: string
          updated_at?: string | null
          usuario_operacao?: string | null
          valor?: number
          valor_centavos?: number | null
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
            foreignKeyName: "faturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      membros: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          created_at: string | null
          data_admissao_terreiro: string | null
          data_cadastro: string | null
          data_nascimento: string | null
          dt_nascimento: string | null
          email: string | null
          endereco: string | null
          id: string
          matricula: string | null
          nome: string
          observacoes: string | null
          org_id: string | null
          telefone: string | null
          terreiro_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          created_at?: string | null
          data_admissao_terreiro?: string | null
          data_cadastro?: string | null
          data_nascimento?: string | null
          dt_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          matricula?: string | null
          nome: string
          observacoes?: string | null
          org_id?: string | null
          telefone?: string | null
          terreiro_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          created_at?: string | null
          data_admissao_terreiro?: string | null
          data_cadastro?: string | null
          data_nascimento?: string | null
          dt_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          observacoes?: string | null
          org_id?: string | null
          telefone?: string | null
          terreiro_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membros_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          fatura_id: string
          id: string
          metodo: string | null
          pago_em: string
          txn_id: string | null
          valor_centavos: number
        }
        Insert: {
          fatura_id: string
          id?: string
          metodo?: string | null
          pago_em?: string
          txn_id?: string | null
          valor_centavos: number
        }
        Update: {
          fatura_id?: string
          id?: string
          metodo?: string | null
          pago_em?: string
          txn_id?: string | null
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
        ]
      }
      planos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dia_vencimento: number
          id: string
          nome: string
          org_id: string | null
          terreiro_id: string
          updated_at: string | null
          valor: number
          valor_centavos: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dia_vencimento: number
          id?: string
          nome: string
          org_id?: string | null
          terreiro_id: string
          updated_at?: string | null
          valor: number
          valor_centavos?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dia_vencimento?: number
          id?: string
          nome?: string
          org_id?: string | null
          terreiro_id?: string
          updated_at?: string | null
          valor?: number
          valor_centavos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          nome: string | null
          org_id: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          nome?: string | null
          org_id?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          nome?: string | null
          org_id?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "terreiros"
            referencedColumns: ["id"]
          },
        ]
      }
      terreiros: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_terreiro: {
        Args: { nome_terreiro: string }
        Returns: string
      }
      gerar_faturas_mes: {
        Args: { ano: number; mes: number }
        Returns: number
      }
      get_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
