export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          color: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
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
          color?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
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
          color?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
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
          concept: string | null
          created_at: string
          creditor_name: string
          currency: Database["public"]["Enums"]["currency_code"]
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
          concept?: string | null
          created_at?: string
          creditor_name: string
          currency?: Database["public"]["Enums"]["currency_code"]
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
          concept?: string | null
          created_at?: string
          creditor_name?: string
          currency?: Database["public"]["Enums"]["currency_code"]
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
          collected_amount: number
          collected_date: string | null
          concept: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
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
          collected_amount?: number
          collected_date?: string | null
          concept?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
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
          collected_amount?: number
          collected_date?: string | null
          concept?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
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
      assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_value: number
          depreciation_rate: number | null
          id: string
          location: string | null
          name: string
          notes: string | null
          purchase_date: string
          purchase_value: number
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_value: number
          depreciation_rate?: number | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          purchase_date: string
          purchase_value: number
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_value?: number
          depreciation_rate?: number | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string
          purchase_value?: number
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          period_type: Database["public"]["Enums"]["budget_period"]
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["budget_period"]
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          period_type?: Database["public"]["Enums"]["budget_period"]
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
      credits: {
        Row: {
          account_id: string | null
          available_amount: number | null
          closing_day: number | null
          created_at: string
          credit_limit: number
          credit_type: Database["public"]["Enums"]["credit_type"]
          currency: Database["public"]["Enums"]["currency_code"]
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
          closing_day?: number | null
          created_at?: string
          credit_limit: number
          credit_type?: Database["public"]["Enums"]["credit_type"]
          currency?: Database["public"]["Enums"]["currency_code"]
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
          closing_day?: number | null
          created_at?: string
          credit_limit?: number
          credit_type?: Database["public"]["Enums"]["credit_type"]
          currency?: Database["public"]["Enums"]["currency_code"]
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
      exchange_rates: {
        Row: {
          fetched_at: string
          from_currency: Database["public"]["Enums"]["currency_code"]
          id: string
          rate: number
          source: string
          to_currency: Database["public"]["Enums"]["currency_code"]
        }
        Insert: {
          fetched_at?: string
          from_currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          rate: number
          source?: string
          to_currency: Database["public"]["Enums"]["currency_code"]
        }
        Update: {
          fetched_at?: string
          from_currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          rate?: number
          source?: string
          to_currency?: Database["public"]["Enums"]["currency_code"]
        }
        Relationships: []
      }
      goals: {
        Row: {
          account_id: string | null
          achieved_date: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_amount: number
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          achieved_date?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_amount?: number
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          achieved_date?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_amount?: number
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          created_at: string
          due_date: string
          id: string
          installment_number: number
          interest_amount: number
          loan_id: string
          paid_amount: number | null
          paid_date: string | null
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
          interest_amount?: number
          loan_id: string
          paid_amount?: number | null
          paid_date?: string | null
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
          interest_amount?: number
          loan_id?: string
          paid_amount?: number | null
          paid_date?: string | null
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
          created_at: string
          credit_id: string | null
          creditor_name: string
          currency: Database["public"]["Enums"]["currency_code"]
          end_date: string
          id: string
          interest_rate: number
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
          created_at?: string
          credit_id?: string | null
          creditor_name: string
          currency?: Database["public"]["Enums"]["currency_code"]
          end_date: string
          id?: string
          interest_rate?: number
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
          created_at?: string
          credit_id?: string | null
          creditor_name?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          end_date?: string
          id?: string
          interest_rate?: number
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
          default_currency: Database["public"]["Enums"]["currency_code"]
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"]
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"]
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          affects_reports: boolean
          amount: number
          amount_pen: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          destination_account_id: string | null
          exchange_rate: number
          id: string
          is_recurring: boolean
          notes: string | null
          source_account_id: string
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          affects_reports?: boolean
          amount: number
          amount_pen: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description: string
          destination_account_id?: string | null
          exchange_rate?: number
          id?: string
          is_recurring?: boolean
          notes?: string | null
          source_account_id: string
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          affects_reports?: boolean
          amount?: number
          amount_pen?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          destination_account_id?: string | null
          exchange_rate?: number
          id?: string
          is_recurring?: boolean
          notes?: string | null
          source_account_id?: string
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      v_account_balances: {
        Row: {
          balance: number | null
          balance_pen: number | null
          color: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
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
          currency?: Database["public"]["Enums"]["currency_code"] | null
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
          currency?: Database["public"]["Enums"]["currency_code"] | null
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
          currency: Database["public"]["Enums"]["currency_code"] | null
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
          currency?: Database["public"]["Enums"]["currency_code"] | null
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
          currency?: Database["public"]["Enums"]["currency_code"] | null
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
          currency: Database["public"]["Enums"]["currency_code"] | null
          days_until_due: number | null
          due_date: string | null
          id: string | null
          paid_amount: number | null
          pending_amount: number | null
          status: Database["public"]["Enums"]["payable_status"] | null
          urgency: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          concept?: string | null
          creditor_name?: string | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          days_until_due?: never
          due_date?: string | null
          id?: string | null
          paid_amount?: number | null
          pending_amount?: never
          status?: Database["public"]["Enums"]["payable_status"] | null
          urgency?: never
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          concept?: string | null
          creditor_name?: string | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          days_until_due?: never
          due_date?: string | null
          id?: string | null
          paid_amount?: number | null
          pending_amount?: never
          status?: Database["public"]["Enums"]["payable_status"] | null
          urgency?: never
          user_id?: string | null
        }
        Relationships: [
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
          currency: Database["public"]["Enums"]["currency_code"] | null
          days_until_due: number | null
          debtor_name: string | null
          due_date: string | null
          id: string | null
          pending_amount: number | null
          status: Database["public"]["Enums"]["receivable_status"] | null
          urgency: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          collected_amount?: number | null
          concept?: string | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          days_until_due?: never
          debtor_name?: string | null
          due_date?: string | null
          id?: string | null
          pending_amount?: never
          status?: Database["public"]["Enums"]["receivable_status"] | null
          urgency?: never
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          collected_amount?: number | null
          concept?: string | null
          currency?: Database["public"]["Enums"]["currency_code"] | null
          days_until_due?: never
          debtor_name?: string | null
          due_date?: string | null
          id?: string | null
          pending_amount?: never
          status?: Database["public"]["Enums"]["receivable_status"] | null
          urgency?: never
          user_id?: string | null
        }
        Relationships: [
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
          currency: Database["public"]["Enums"]["currency_code"] | null
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
        Args: {
          p_from: Database["public"]["Enums"]["currency_code"]
          p_to: Database["public"]["Enums"]["currency_code"]
        }
        Returns: number
      }
      fn_mark_overdue_installments: { Args: never; Returns: undefined }
      fn_mark_overdue_payables_receivables: { Args: never; Returns: undefined }
      create_transaction_atomic: {
        Args: {
          p_user_id:                string
          p_source_account_id:      string
          p_destination_account_id: string | null
          p_category_id:            string | null
          p_type:                   Database["public"]["Enums"]["transaction_type"]
          p_amount:                 number
          p_currency:               Database["public"]["Enums"]["currency_code"]
          p_exchange_rate:          number
          p_description:            string
          p_transaction_date:       string
          p_notes:                  string | null
          p_is_recurring:           boolean
          p_asset:                  Json | null
          p_credit:                 Json | null
          p_loan:                   Json | null
          p_receivable:             Json | null
          p_payable:                Json | null
        }
        Returns: Json
      }
    }
    Enums: {
      account_type:
        | "CHECKING"
        | "SAVINGS"
        | "CASH"
        | "INVESTMENT"
        | "CREDIT_CARD"
        | "OTHER"
      asset_status: "ACTIVE" | "SOLD" | "DEPRECIATED"
      asset_type:
        | "REAL_ESTATE"
        | "VEHICLE"
        | "EQUIPMENT"
        | "INVESTMENT"
        | "OTHER"
      budget_period: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
      category_scope: "INCOME" | "EXPENSE" | "BOTH"
      credit_status: "ACTIVE" | "CLOSED" | "BLOCKED"
      credit_type: "CREDIT_CARD" | "LINE_OF_CREDIT"
      currency_code: "PEN" | "USD"
      goal_status: "ACTIVE" | "ACHIEVED" | "CANCELLED" | "PAUSED"
      installment_status: "PENDING" | "PAID" | "OVERDUE" | "PARTIAL"
      loan_status: "ACTIVE" | "PAID" | "DEFAULTED" | "REFINANCED"
      payable_status: "PENDING" | "PARTIAL" | "PAID" | "DISPUTED"
      receivable_status: "PENDING" | "PARTIAL" | "COLLECTED" | "WRITTEN_OFF"
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
      ],
      asset_status: ["ACTIVE", "SOLD", "DEPRECIATED"],
      asset_type: [
        "REAL_ESTATE",
        "VEHICLE",
        "EQUIPMENT",
        "INVESTMENT",
        "OTHER",
      ],
      budget_period: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"],
      category_scope: ["INCOME", "EXPENSE", "BOTH"],
      credit_status: ["ACTIVE", "CLOSED", "BLOCKED"],
      credit_type: ["CREDIT_CARD", "LINE_OF_CREDIT"],
      currency_code: ["PEN", "USD"],
      goal_status: ["ACTIVE", "ACHIEVED", "CANCELLED", "PAUSED"],
      installment_status: ["PENDING", "PAID", "OVERDUE", "PARTIAL"],
      loan_status: ["ACTIVE", "PAID", "DEFAULTED", "REFINANCED"],
      payable_status: ["PENDING", "PARTIAL", "PAID", "DISPUTED"],
      receivable_status: ["PENDING", "PARTIAL", "COLLECTED", "WRITTEN_OFF"],
      transaction_type: ["INCOME", "EXPENSE", "TRANSFER"],
    },
  },
} as const

// =============================================================================
// Named type aliases — convenience exports used throughout the codebase.
// These are derived from Database["public"] so they stay in sync automatically.
// =============================================================================

// ─── Enums ────────────────────────────────────────────────────────────────────
export type TransactionType  = Database["public"]["Enums"]["transaction_type"]
export type CurrencyCode     = Database["public"]["Enums"]["currency_code"]
export type AccountType      = Database["public"]["Enums"]["account_type"]
export type AssetType        = Database["public"]["Enums"]["asset_type"]
export type CreditType       = Database["public"]["Enums"]["credit_type"]
export type CreditStatus     = Database["public"]["Enums"]["credit_status"]
export type AssetStatus      = Database["public"]["Enums"]["asset_status"]
export type ReceivableStatus = Database["public"]["Enums"]["receivable_status"]
export type PayableStatus    = Database["public"]["Enums"]["payable_status"]

// ─── Table rows ───────────────────────────────────────────────────────────────
export type Account           = Tables<"accounts">
export type Transaction       = Tables<"transactions">
export type Asset             = Tables<"assets">
export type Credit            = Tables<"credits">
export type Loan              = Tables<"loans">
export type Installment       = Tables<"installments">
export type AccountReceivable = Tables<"accounts_receivable">
export type AccountPayable    = Tables<"accounts_payable">

// ─── Composite type (no Row en la DB — se define manualmente) ─────────────────
export type TransactionWithRelations = Tables<"transactions"> & {
  source_account:      Pick<Tables<"accounts">, "id" | "name" | "color" | "icon"> | null
  destination_account: Pick<Tables<"accounts">, "id" | "name" | "color" | "icon"> | null
  category:            { id: string; name: string; icon: string; color: string } | null
  asset:               Tables<"assets">               | null
  credit:              Tables<"credits">              | null
  loan:                Tables<"loans">                | null
  receivable:          Tables<"accounts_receivable">  | null
  payable:             Tables<"accounts_payable">     | null
}
