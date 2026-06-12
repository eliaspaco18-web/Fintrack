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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          bank_entity_id: string | null
          color: string
          created_at: string
          currency: string
          icon: string
          id: string
          include_in_net_worth: boolean
          initial_balance: number
          institution: string | null
          is_active: boolean
          name: string
          notes: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bank_entity_id?: string | null
          color?: string
          created_at?: string
          currency?: string
          icon?: string
          id?: string
          include_in_net_worth?: boolean
          initial_balance?: number
          institution?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bank_entity_id?: string | null
          color?: string
          created_at?: string
          currency?: string
          icon?: string
          id?: string
          include_in_net_worth?: boolean
          initial_balance?: number
          institution?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable: {
        Row: {
          amount: number
          attachment_url: string | null
          concept: string | null
          created_at: string
          creditor_id: string | null
          creditor_name: string
          currency: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          paid_amount: number
          paid_date: string | null
          status: Database["public"]["Enums"]["payable_status"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          concept?: string | null
          created_at?: string
          creditor_id?: string | null
          creditor_name: string
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          paid_amount?: number
          paid_date?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          concept?: string | null
          created_at?: string
          creditor_id?: string | null
          creditor_name?: string
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          paid_amount?: number
          paid_date?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_creditor_id_fkey"
            columns: ["creditor_id"]
            isOneToOne: false
            referencedRelation: "creditors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          amount: number
          attachment_url: string | null
          collected_amount: number
          collected_date: string | null
          concept: string | null
          created_at: string
          currency: string
          debtor_id: string | null
          debtor_name: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          status: Database["public"]["Enums"]["receivable_status"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          collected_amount?: number
          collected_date?: string | null
          concept?: string | null
          created_at?: string
          currency?: string
          debtor_id?: string | null
          debtor_name: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          collected_amount?: number
          collected_date?: string | null
          concept?: string | null
          created_at?: string
          currency?: string
          debtor_id?: string | null
          debtor_name?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_severity"]
          category: string
          context: Json
          created_at: string
          event: string
          href: string | null
          id: string
          is_read: boolean
          message: string | null
          read_at: string | null
          source_module: string | null
          source_record_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type?: Database["public"]["Enums"]["alert_severity"]
          category?: string
          context?: Json
          created_at?: string
          event: string
          href?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          source_module?: string | null
          source_record_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_severity"]
          category?: string
          context?: Json
          created_at?: string
          event?: string
          href?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          source_module?: string | null
          source_record_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_releases: {
        Row: {
          build_number: number
          commit_sha: string | null
          created_at: string
          deployed_at: string
          email_sent_at: string | null
          highlights: Json
          id: string
          series: string
          summary: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          build_number: number
          commit_sha?: string | null
          created_at?: string
          deployed_at?: string
          email_sent_at?: string | null
          highlights?: Json
          id?: string
          series: string
          summary: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          build_number?: number
          commit_sha?: string | null
          created_at?: string
          deployed_at?: string
          email_sent_at?: string | null
          highlights?: Json
          id?: string
          series?: string
          summary?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      app_release_user_state: {
        Row: {
          created_at: string
          email_sent_at: string | null
          id: string
          in_app_seen_at: string | null
          release_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_sent_at?: string | null
          id?: string
          in_app_seen_at?: string | null
          release_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_sent_at?: string | null
          id?: string
          in_app_seen_at?: string | null
          release_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_release_user_state_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "app_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_release_user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          asset_type_id: string | null
          attachment_url: string | null
          created_at: string
          currency: string
          current_value: number
          depreciation_rate: number | null
          id: string
          location: string | null
          name: string
          notes: string | null
          purchase_date: string
          purchase_value: number
          recipient: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          asset_type_id?: string | null
          attachment_url?: string | null
          created_at?: string
          currency?: string
          current_value: number
          depreciation_rate?: number | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          purchase_date: string
          purchase_value: number
          recipient?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          asset_type_id?: string | null
          attachment_url?: string | null
          created_at?: string
          currency?: string
          current_value?: number
          depreciation_rate?: number | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string
          purchase_value?: number
          recipient?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_entities: {
        Row: {
          code: string | null
          color: string
          country: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          short_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          color?: string
          country?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          short_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string | null
          color?: string
          country?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          short_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_entities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          billing_month: number
          billing_year: number
          consumption_from: string
          consumption_to: string
          created_at: string
          credit_id: string
          id: string
          notes: string | null
          payment_date: string
          statement_url: string | null
          total_to_pay: number
          updated_at: string
        }
        Insert: {
          billing_month: number
          billing_year: number
          consumption_from: string
          consumption_to: string
          created_at?: string
          credit_id: string
          id?: string
          notes?: string | null
          payment_date: string
          statement_url?: string | null
          total_to_pay?: number
          updated_at?: string
        }
        Update: {
          billing_month?: number
          billing_year?: number
          consumption_from?: string
          consumption_to?: string
          created_at?: string
          credit_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          statement_url?: string | null
          total_to_pay?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_cycles_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "v_credit_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          period_type: Database["public"]["Enums"]["budget_period"]
          series_id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["budget_period"]
          series_id?: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["budget_period"]
          series_id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_series: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          default_amount: number
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          legacy_series_id: string | null
          name: string
          notes: string | null
          period_type: Database["public"]["Enums"]["budget_period"]
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string
          default_amount: number
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          legacy_series_id?: string | null
          name: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["budget_period"]
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          default_amount?: number
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          legacy_series_id?: string | null
          name?: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["budget_period"]
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_series_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_periods: {
        Row: {
          amount: number
          budget_id: string
          created_at: string
          id: string
          legacy_budget_id: string | null
          notes: string | null
          period_end: string
          period_start: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          budget_id: string
          created_at?: string
          id?: string
          legacy_budget_id?: string | null
          notes?: string | null
          period_end: string
          period_start: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_id?: string
          created_at?: string
          id?: string
          legacy_budget_id?: string | null
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_periods_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budget_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_periods_legacy_budget_id_fkey"
            columns: ["legacy_budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_system: boolean
          name: string
          scope: Database["public"]["Enums"]["category_scope"]
          sort_order: number
          system_key: string | null
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name: string
          scope?: Database["public"]["Enums"]["category_scope"]
          sort_order?: number
          system_key?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_system?: boolean
          name?: string
          scope?: Database["public"]["Enums"]["category_scope"]
          sort_order?: number
          system_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creditors: {
        Row: {
          created_at: string
          id: string
          initial_debt: number
          is_active: boolean
          name: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          initial_debt?: number
          is_active?: boolean
          name: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          initial_debt?: number
          is_active?: boolean
          name?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creditors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          account_id: string | null
          available_amount: number | null
          bank_entity_id: string | null
          closing_day: number | null
          created_at: string
          credit_limit: number
          credit_type: Database["public"]["Enums"]["credit_type"]
          currency: string
          id: string
          interest_rate: number
          name: string
          notes: string | null
          payment_day: number | null
          status: Database["public"]["Enums"]["credit_status"]
          transaction_id: string | null
          updated_at: string
          used_amount: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          available_amount?: number | null
          bank_entity_id?: string | null
          closing_day?: number | null
          created_at?: string
          credit_limit: number
          credit_type?: Database["public"]["Enums"]["credit_type"]
          currency?: string
          id?: string
          interest_rate?: number
          name: string
          notes?: string | null
          payment_day?: number | null
          status?: Database["public"]["Enums"]["credit_status"]
          transaction_id?: string | null
          updated_at?: string
          used_amount?: number
          user_id: string
        }
        Update: {
          account_id?: string | null
          available_amount?: number | null
          bank_entity_id?: string | null
          closing_day?: number | null
          created_at?: string
          credit_limit?: number
          credit_type?: Database["public"]["Enums"]["credit_type"]
          currency?: string
          id?: string
          interest_rate?: number
          name?: string
          notes?: string | null
          payment_day?: number | null
          status?: Database["public"]["Enums"]["credit_status"]
          transaction_id?: string | null
          updated_at?: string
          used_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_bank_entity_id_fkey"
            columns: ["bank_entity_id"]
            isOneToOne: false
            referencedRelation: "bank_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debtors: {
        Row: {
          created_at: string
          id: string
          initial_debt: number
          is_active: boolean
          name: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          initial_debt?: number
          is_active?: boolean
          name: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          initial_debt?: number
          is_active?: boolean
          name?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          fetched_at: string
          from_currency: string
          id: string
          rate: number
          source: string
          to_currency: string
        }
        Insert: {
          fetched_at?: string
          from_currency: string
          id?: string
          rate: number
          source?: string
          to_currency: string
        }
        Update: {
          fetched_at?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string
          to_currency?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          created_at: string
          due_date: string
          id: string
          installment_number: number
          insurance_amount: number
          interest_amount: number
          loan_id: string
          other_charges: number
          paid_amount: number | null
          paid_date: string | null
          payment_proof_url: string | null
          principal_amount: number
          status: Database["public"]["Enums"]["installment_status"]
          total_amount: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          insurance_amount?: number
          interest_amount?: number
          loan_id: string
          other_charges?: number
          paid_amount?: number | null
          paid_date?: string | null
          payment_proof_url?: string | null
          principal_amount: number
          status?: Database["public"]["Enums"]["installment_status"]
          total_amount: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          insurance_amount?: number
          interest_amount?: number
          loan_id?: string
          other_charges?: number
          paid_amount?: number | null
          paid_date?: string | null
          payment_proof_url?: string | null
          principal_amount?: number
          status?: Database["public"]["Enums"]["installment_status"]
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          bank_entity_id: string | null
          created_at: string
          credit_id: string | null
          creditor_name: string
          currency: string
          disbursement_account_id: string | null
          end_date: string
          id: string
          interest_rate: number
          name: string | null
          notes: string | null
          paid_installments: number
          principal_amount: number
          start_date: string
          status: Database["public"]["Enums"]["loan_status"]
          total_installments: number
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_entity_id?: string | null
          created_at?: string
          credit_id?: string | null
          creditor_name: string
          currency?: string
          disbursement_account_id?: string | null
          end_date: string
          id?: string
          interest_rate?: number
          name?: string | null
          notes?: string | null
          paid_installments?: number
          principal_amount: number
          start_date: string
          status?: Database["public"]["Enums"]["loan_status"]
          total_installments: number
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_entity_id?: string | null
          created_at?: string
          credit_id?: string | null
          creditor_name?: string
          currency?: string
          disbursement_account_id?: string | null
          end_date?: string
          id?: string
          interest_rate?: number
          name?: string | null
          notes?: string | null
          paid_installments?: number
          principal_amount?: number
          start_date?: string
          status?: Database["public"]["Enums"]["loan_status"]
          total_installments?: number
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_bank_entity_id_fkey"
            columns: ["bank_entity_id"]
            isOneToOne: false
            referencedRelation: "bank_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "v_credit_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_disbursement_account_id_fkey"
            columns: ["disbursement_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_disbursement_account_id_fkey"
            columns: ["disbursement_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: string
          email: string
          full_name: string | null
          id: string
          notification_prefs: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          email: string
          full_name?: string | null
          id: string
          notification_prefs?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          email?: string
          full_name?: string | null
          id?: string
          notification_prefs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          amount: number
          budget_id: string | null
          category_id: string | null
          created_at: string
          creditor_id: string | null
          currency: string
          debtor_id: string | null
          description: string | null
          destination_account_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          recipient: string | null
          sender: string | null
          source_account_id: string | null
          sub_type: Database["public"]["Enums"]["transaction_sub_type"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          budget_id?: string | null
          category_id?: string | null
          created_at?: string
          creditor_id?: string | null
          currency?: string
          debtor_id?: string | null
          description?: string | null
          destination_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          recipient?: string | null
          sender?: string | null
          source_account_id?: string | null
          sub_type?: Database["public"]["Enums"]["transaction_sub_type"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          budget_id?: string | null
          category_id?: string | null
          created_at?: string
          creditor_id?: string | null
          currency?: string
          debtor_id?: string | null
          description?: string | null
          destination_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          recipient?: string | null
          sender?: string | null
          source_account_id?: string | null
          sub_type?: Database["public"]["Enums"]["transaction_sub_type"] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_creditor_id_fkey"
            columns: ["creditor_id"]
            isOneToOne: false
            referencedRelation: "creditors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          affects_reports: boolean
          amount: number
          amount_pen: number
          attachment_url: string | null
          budget_id: string | null
          budget_period_id: string | null
          category_id: string | null
          created_at: string
          creditor_id: string | null
          currency: string
          debtor_id: string | null
          description: string
          destination_account_id: string | null
          exchange_rate: number
          id: string
          is_recurring: boolean
          notes: string | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          recipient: string | null
          recurring_transaction_id: string | null
          sender: string | null
          source_account_id: string
          sub_type: Database["public"]["Enums"]["transaction_sub_type"] | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          affects_reports?: boolean
          amount: number
          amount_pen: number
          attachment_url?: string | null
          budget_id?: string | null
          budget_period_id?: string | null
          category_id?: string | null
          created_at?: string
          creditor_id?: string | null
          currency?: string
          debtor_id?: string | null
          description: string
          destination_account_id?: string | null
          exchange_rate?: number
          id?: string
          is_recurring?: boolean
          notes?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          recipient?: string | null
          recurring_transaction_id?: string | null
          sender?: string | null
          source_account_id: string
          sub_type?: Database["public"]["Enums"]["transaction_sub_type"] | null
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          affects_reports?: boolean
          amount?: number
          amount_pen?: number
          attachment_url?: string | null
          budget_id?: string | null
          budget_period_id?: string | null
          category_id?: string | null
          created_at?: string
          creditor_id?: string | null
          currency?: string
          debtor_id?: string | null
          description?: string
          destination_account_id?: string | null
          exchange_rate?: number
          id?: string
          is_recurring?: boolean
          notes?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          recipient?: string | null
          recurring_transaction_id?: string | null
          sender?: string | null
          source_account_id?: string
          sub_type?: Database["public"]["Enums"]["transaction_sub_type"] | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_creditor_id_fkey"
            columns: ["creditor_id"]
            isOneToOne: false
            referencedRelation: "creditors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_debtor_id_fkey"
            columns: ["debtor_id"]
            isOneToOne: false
            referencedRelation: "debtors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_transaction_id_fkey"
            columns: ["recurring_transaction_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_currencies: {
        Row: {
          code: string
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          is_system: boolean
          name: string
          symbol: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          code: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_system?: boolean
          name: string
          symbol?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_system?: boolean
          name?: string
          symbol?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_currencies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_account_balances: {
        Row: {
          balance: number | null
          balance_pen: number | null
          color: string | null
          currency: string | null
          icon: string | null
          id: string | null
          include_in_net_worth: boolean | null
          institution: string | null
          is_active: boolean | null
          name: string | null
          type: Database["public"]["Enums"]["account_type"] | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          balance_pen?: never
          color?: string | null
          currency?: string | null
          icon?: string | null
          id?: string | null
          include_in_net_worth?: boolean | null
          institution?: string | null
          is_active?: boolean | null
          name?: string | null
          type?: Database["public"]["Enums"]["account_type"] | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          balance_pen?: never
          color?: string | null
          currency?: string | null
          icon?: string | null
          id?: string | null
          include_in_net_worth?: boolean | null
          institution?: string | null
          is_active?: boolean | null
          name?: string | null
          type?: Database["public"]["Enums"]["account_type"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_credit_summary: {
        Row: {
          available_amount: number | null
          closing_day: number | null
          credit_limit: number | null
          credit_type: Database["public"]["Enums"]["credit_type"] | null
          currency: string | null
          id: string | null
          interest_rate: number | null
          name: string | null
          next_closing_date: string | null
          payment_day: number | null
          used_amount: number | null
          user_id: string | null
          utilization_pct: number | null
        }
        Insert: {
          available_amount?: number | null
          closing_day?: number | null
          credit_limit?: number | null
          credit_type?: Database["public"]["Enums"]["credit_type"] | null
          currency?: string | null
          id?: string | null
          interest_rate?: number | null
          name?: string | null
          next_closing_date?: never
          payment_day?: number | null
          used_amount?: number | null
          user_id?: string | null
          utilization_pct?: never
        }
        Update: {
          available_amount?: number | null
          closing_day?: number | null
          credit_limit?: number | null
          credit_type?: Database["public"]["Enums"]["credit_type"] | null
          currency?: string | null
          id?: string | null
          interest_rate?: number | null
          name?: string | null
          next_closing_date?: never
          payment_day?: number | null
          used_amount?: number | null
          user_id?: string | null
          utilization_pct?: never
        }
        Relationships: [
          {
            foreignKeyName: "credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_expense_by_category: {
        Row: {
          category_color: string | null
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          percentage: number | null
          total_pen: number | null
          transaction_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_monthly_cash_flow: {
        Row: {
          expense_count: number | null
          expense_pen: number | null
          income_count: number | null
          income_pen: number | null
          month: string | null
          month_label: string | null
          net_pen: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_monthly_summary: {
        Row: {
          expense_count: number | null
          income_count: number | null
          month: string | null
          net_pen: number | null
          total_expense_pen: number | null
          total_income_pen: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_net_worth: {
        Row: {
          active_accounts: number | null
          net_worth_pen: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_payables_summary: {
        Row: {
          amount: number | null
          concept: string | null
          creditor_name: string | null
          currency: string | null
          days_until_due: number | null
          due_date: string | null
          id: string | null
          paid_amount: number | null
          pending_amount: number | null
          status: Database["public"]["Enums"]["payable_status"] | null
          transaction_id: string | null
          urgency: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          concept?: string | null
          creditor_name?: string | null
          currency?: string | null
          days_until_due?: never
          due_date?: string | null
          id?: string | null
          paid_amount?: number | null
          pending_amount?: never
          status?: Database["public"]["Enums"]["payable_status"] | null
          transaction_id?: string | null
          urgency?: never
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          concept?: string | null
          creditor_name?: string | null
          currency?: string | null
          days_until_due?: never
          due_date?: string | null
          id?: string | null
          paid_amount?: number | null
          pending_amount?: never
          status?: Database["public"]["Enums"]["payable_status"] | null
          transaction_id?: string | null
          urgency?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_receivables_summary: {
        Row: {
          amount: number | null
          collected_amount: number | null
          concept: string | null
          currency: string | null
          days_until_due: number | null
          debtor_name: string | null
          due_date: string | null
          id: string | null
          pending_amount: number | null
          status: Database["public"]["Enums"]["receivable_status"] | null
          transaction_id: string | null
          urgency: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          collected_amount?: number | null
          concept?: string | null
          currency?: string | null
          days_until_due?: never
          debtor_name?: string | null
          due_date?: string | null
          id?: string | null
          pending_amount?: never
          status?: Database["public"]["Enums"]["receivable_status"] | null
          transaction_id?: string | null
          urgency?: never
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          collected_amount?: number | null
          concept?: string | null
          currency?: string | null
          days_until_due?: never
          debtor_name?: string | null
          due_date?: string | null
          id?: string | null
          pending_amount?: never
          status?: Database["public"]["Enums"]["receivable_status"] | null
          transaction_id?: string | null
          urgency?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_upcoming_installments: {
        Row: {
          creditor_name: string | null
          currency: string | null
          days_until_due: number | null
          due_date: string | null
          id: string | null
          installment_number: number | null
          loan_id: string | null
          paid_installments: number | null
          status: Database["public"]["Enums"]["installment_status"] | null
          total_amount: number | null
          total_installments: number | null
          urgency: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_dashboard_summary: { Args: { p_user_id: string }; Returns: Json }
      fn_latest_exchange_rate: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      fn_mark_overdue_installments: { Args: never; Returns: undefined }
      fn_mark_overdue_payables_receivables: { Args: never; Returns: undefined }
    }
    Enums: {
      account_type:
        | "CHECKING"
        | "SAVINGS"
        | "CASH"
        | "INVESTMENT"
        | "CREDIT_CARD"
        | "OTHER"
        | "STOCKS"
        | "ETF"
        | "CRYPTO"
      alert_severity: "CRITICAL" | "OPERATIONAL" | "SUGGESTION"
      asset_status: "ACTIVE" | "SOLD" | "DEPRECIATED"
      asset_type:
        | "REAL_ESTATE"
        | "VEHICLE"
        | "EQUIPMENT"
        | "INVESTMENT"
        | "OTHER"
      budget_period: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
      category_scope: "INCOME" | "EXPENSE"
      credit_status: "ACTIVE" | "CLOSED" | "BLOCKED"
      credit_type: "CREDIT_CARD" | "LINE_OF_CREDIT"
      installment_status: "PENDING" | "PAID" | "OVERDUE" | "PARTIAL"
      loan_status: "ACTIVE" | "PAID" | "DEFAULTED" | "REFINANCED"
      payable_status: "PENDING" | "PARTIAL" | "PAID" | "DISPUTED"
      payment_method_type: "DEBIT" | "CREDIT"
      receivable_status: "PENDING" | "PARTIAL" | "COLLECTED" | "WRITTEN_OFF"
      transaction_sub_type:
        | "ASSET_PURCHASE"
        | "RECEIVABLE_LENDING"
        | "PAYABLE_PAYMENT"
      transaction_type: "INCOME" | "EXPENSE" | "TRANSFER"
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
    Enums: {
      account_type: [
        "CHECKING",
        "SAVINGS",
        "CASH",
        "INVESTMENT",
        "CREDIT_CARD",
        "OTHER",
        "STOCKS",
        "ETF",
        "CRYPTO",
      ],
      alert_severity: ["CRITICAL", "OPERATIONAL", "SUGGESTION"],
      asset_status: ["ACTIVE", "SOLD", "DEPRECIATED"],
      asset_type: [
        "REAL_ESTATE",
        "VEHICLE",
        "EQUIPMENT",
        "INVESTMENT",
        "OTHER",
      ],
      budget_period: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"],
      category_scope: ["INCOME", "EXPENSE"],
      credit_status: ["ACTIVE", "CLOSED", "BLOCKED"],
      credit_type: ["CREDIT_CARD", "LINE_OF_CREDIT"],
      installment_status: ["PENDING", "PAID", "OVERDUE", "PARTIAL"],
      loan_status: ["ACTIVE", "PAID", "DEFAULTED", "REFINANCED"],
      payable_status: ["PENDING", "PARTIAL", "PAID", "DISPUTED"],
      payment_method_type: ["DEBIT", "CREDIT"],
      receivable_status: ["PENDING", "PARTIAL", "COLLECTED", "WRITTEN_OFF"],
      transaction_sub_type: [
        "ASSET_PURCHASE",
        "RECEIVABLE_LENDING",
        "PAYABLE_PAYMENT",
      ],
      transaction_type: ["INCOME", "EXPENSE", "TRANSFER"],
    },
  },
} as const

// =============================================================================
// Legacy compatibility aliases
// Keep existing app imports stable after `supabase gen types`.
// =============================================================================

export type Account = Tables<'accounts'>
export type Asset = Tables<'assets'>
export type AssetTypeRow = Tables<'asset_types'>
export type Budget = Tables<'budgets'>
export type BudgetSeries = Tables<'budget_series'>
export type BudgetPeriodRow = Tables<'budget_periods'>
export type Credit = Tables<'credits'>
export type Installment = Tables<'installments'>
export type Loan = Tables<'loans'>
export type Transaction = Tables<'transactions'>
export type AccountReceivable = Tables<'accounts_receivable'>
export type AccountPayable = Tables<'accounts_payable'>
export type Debtor = Tables<'debtors'>
export type Creditor = Tables<'creditors'>
export type UserCurrency = Tables<'user_currencies'>

export type AccountType = Enums<'account_type'>
export type AssetType = Enums<'asset_type'>
export type AssetStatus = Enums<'asset_status'>
export type BudgetPeriod = Enums<'budget_period'>
export type CreditType = Enums<'credit_type'>
export type CreditStatus = Enums<'credit_status'>
export type CurrencyCode = string
export type PayableStatus = Enums<'payable_status'>
export type ReceivableStatus = Enums<'receivable_status'>
export type TransactionType = Enums<'transaction_type'>

export type TransactionWithRelations = Transaction & {
  source_account?: Pick<Account, 'id' | 'name' | 'color' | 'icon'> | null
  destination_account?: Pick<Account, 'id' | 'name' | 'color' | 'icon'> | null
  category?: Pick<Tables<'categories'>, 'id' | 'name' | 'icon' | 'color'> | null
}
