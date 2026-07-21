# FASE 2 — ESQUEMA DE BASE DE DATOS

## Resumen de Cambios

| Acción | Elementos |
|--------|-----------|
| **Tablas nuevas** | `user_currencies`, `asset_types`, `debtors`, `creditors`, `billing_cycles`, `recurring_transactions` |
| **Tablas alteradas** | `transactions`, `installments`, `loans`, `assets`, `accounts_receivable`, `accounts_payable`, `credits`, `app_notifications`, `budgets` |
| **Tabla eliminada** | `goals` |
| **ENUMs nuevos** | `transaction_sub_type`, `payment_method_type`, `alert_severity` |
| **ENUM eliminado** | `currency_code` (→ columnas `text`), `goal_status` |
| **ENUM expandido** | `account_type` (+STOCKS, ETF, CRYPTO) |
| **Storage** | Bucket `attachments` con RLS por usuario |

---

## Tablas Nuevas

### `user_currencies`
| Campo | Tipo | Nullable | Default | Referencia |
|-------|------|----------|---------|------------|
| id | uuid (PK) | NO | gen_random_uuid() | — |
| user_id | uuid | SÍ | — | profiles(id) |
| code | text | NO | — | — |
| name | text | NO | — | — |
| symbol | text | NO | '$' | — |
| country | text | SÍ | — | — |
| is_default | boolean | NO | false | — |
| is_system | boolean | NO | false | — |
| is_active | boolean | NO | true | — |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | — |

### `asset_types`
| Campo | Tipo | Nullable | Default | Referencia |
|-------|------|----------|---------|------------|
| id | uuid (PK) | NO | gen_random_uuid() | — |
| user_id | uuid | SÍ | — | profiles(id) |
| name | text | NO | — | — |
| icon | text | NO | 'package' | — |
| color | text | NO | '#6366f1' | — |
| is_system | boolean | NO | false | — |
| is_active | boolean | NO | true | — |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | — |

### `debtors`
| Campo | Tipo | Nullable | Default | Referencia |
|-------|------|----------|---------|------------|
| id | uuid (PK) | NO | gen_random_uuid() | — |
| user_id | uuid | NO | — | profiles(id) |
| name | text | NO | — | — |
| initial_debt | numeric(15,2) | NO | 0.00 | — |
| relationship | text | SÍ | — | — |
| is_active | boolean | NO | true | — |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | — |

### `creditors`
| Campo | Tipo | Nullable | Default | Referencia |
|-------|------|----------|---------|------------|
| id | uuid (PK) | NO | gen_random_uuid() | — |
| user_id | uuid | NO | — | profiles(id) |
| name | text | NO | — | — |
| initial_debt | numeric(15,2) | NO | 0.00 | — |
| relationship | text | SÍ | — | — |
| is_active | boolean | NO | true | — |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | — |

### `billing_cycles`
| Campo | Tipo | Nullable | Default | Referencia |
|-------|------|----------|---------|------------|
| id | uuid (PK) | NO | gen_random_uuid() | — |
| credit_id | uuid | NO | — | credits(id) |
| billing_month | integer | NO | — | — |
| billing_year | integer | NO | — | — |
| consumption_from | date | NO | — | — |
| consumption_to | date | NO | — | — |
| payment_date | date | NO | — | — |
| total_to_pay | numeric(15,2) | NO | 0.00 | — |
| statement_url | text | SÍ | — | — |
| notes | text | SÍ | — | — |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | — |

> UNIQUE(credit_id, billing_month, billing_year)

### `recurring_transactions`
| Campo | Tipo | Nullable | Default | Referencia |
|-------|------|----------|---------|------------|
| id | uuid (PK) | NO | gen_random_uuid() | — |
| user_id | uuid | NO | — | profiles(id) |
| name | text | NO | — | — |
| type | transaction_type | NO | — | — |
| sub_type | transaction_sub_type | SÍ | — | — |
| source_account_id | uuid | SÍ | — | accounts(id) |
| destination_account_id | uuid | SÍ | — | accounts(id) |
| category_id | uuid | SÍ | — | categories(id) |
| budget_id | uuid | SÍ | — | budgets(id) |
| debtor_id | uuid | SÍ | — | debtors(id) |
| creditor_id | uuid | SÍ | — | creditors(id) |
| amount | numeric(15,2) | NO | 0.00 | — |
| currency | text | NO | 'PEN' | — |
| description | text | SÍ | — | — |
| payment_method | payment_method_type | SÍ | — | — |
| recipient | text | SÍ | — | — |
| sender | text | SÍ | — | — |
| notes | text | SÍ | — | — |
| is_active | boolean | NO | true | — |
| created_at | timestamptz | NO | now() | — |
| updated_at | timestamptz | NO | now() | — |

---

## Columnas Agregadas a Tablas Existentes

### `transactions` (+9 columnas)
| Campo nuevo | Tipo | Nullable | Referencia |
|-------------|------|----------|------------|
| sub_type | transaction_sub_type | SÍ | — |
| payment_method | payment_method_type | SÍ | — |
| budget_id | uuid | SÍ | budgets(id) |
| debtor_id | uuid | SÍ | debtors(id) |
| creditor_id | uuid | SÍ | creditors(id) |
| recurring_transaction_id | uuid | SÍ | recurring_transactions(id) |
| recipient | text | SÍ | — |
| sender | text | SÍ | — |
| attachment_url | text | SÍ | — |

### `installments` (+3 columnas)
| Campo nuevo | Tipo | Nullable | Default |
|-------------|------|----------|---------|
| insurance_amount | numeric(15,2) | NO | 0.00 |
| other_charges | numeric(15,2) | NO | 0.00 |
| payment_proof_url | text | SÍ | — |

> Constraint actualizado: `total_amount = principal + interest + insurance + others`

### `loans` (+3 columnas)
| Campo nuevo | Tipo | Nullable | Referencia |
|-------------|------|----------|------------|
| name | text | SÍ | — |
| disbursement_account_id | uuid | SÍ | accounts(id) |
| bank_entity_id | uuid | SÍ | bank_entities(id) |

### `assets` (+3 columnas)
| Campo nuevo | Tipo | Nullable | Referencia |
|-------------|------|----------|------------|
| asset_type_id | uuid | SÍ | asset_types(id) |
| attachment_url | text | SÍ | — |
| recipient | text | SÍ | — |

### `accounts_receivable` (+2 columnas)
| Campo nuevo | Tipo | Nullable | Referencia |
|-------------|------|----------|------------|
| debtor_id | uuid | SÍ | debtors(id) |
| attachment_url | text | SÍ | — |

### `accounts_payable` (+2 columnas)
| Campo nuevo | Tipo | Nullable | Referencia |
|-------------|------|----------|------------|
| creditor_id | uuid | SÍ | creditors(id) |
| attachment_url | text | SÍ | — |

### `credits` (+1 columna)
| Campo nuevo | Tipo | Nullable | Referencia |
|-------------|------|----------|------------|
| bank_entity_id | uuid | SÍ | bank_entities(id) |

### `app_notifications` (+3 columnas)
| Campo nuevo | Tipo | Nullable | Default |
|-------------|------|----------|---------|
| alert_type | alert_severity | NO | 'OPERATIONAL' |
| source_module | text | SÍ | — |
| source_record_id | uuid | SÍ | — |

### `budgets` (+1 columna)
| Campo nuevo | Tipo | Nullable |
|-------------|------|----------|
| description | text | SÍ |

> Nuevo índice único: `(user_id, lower(name))`

---

## ENUMs

| Enum | Valores |
|------|---------|
| `transaction_sub_type` | ASSET_PURCHASE, RECEIVABLE_LENDING, PAYABLE_PAYMENT |
| `payment_method_type` | DEBIT, CREDIT |
| `alert_severity` | CRITICAL, OPERATIONAL, SUGGESTION |
| `account_type` *(expandido)* | ...existentes + STOCKS, ETF, CRYPTO |

---

## Supabase Storage

| Bucket | Privado | Límite | Tipos MIME |
|--------|---------|--------|------------|
| `attachments` | Sí | 10 MB | JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS, XLSX |

**Estructura de carpetas:** `{user_id}/{module}/{record_id}/{filename}`

**RLS:** Cada usuario solo puede leer/escribir en su propia carpeta (`foldername[1] = auth.uid()`).

---

## Índices Nuevos (17 total)

| Tabla | Índice | Tipo |
|-------|--------|------|
| user_currencies | (user_id, upper(code)) | UNIQUE |
| user_currencies | (user_id, is_active) | BTREE |
| asset_types | (user_id, lower(name)) | UNIQUE |
| asset_types | (user_id, is_active) | BTREE |
| debtors | (user_id, lower(name)) | UNIQUE |
| debtors | (user_id, is_active) | BTREE |
| creditors | (user_id, lower(name)) | UNIQUE |
| creditors | (user_id, is_active) | BTREE |
| billing_cycles | (credit_id) | BTREE |
| billing_cycles | (payment_date) | BTREE |
| recurring_transactions | (user_id) | BTREE |
| recurring_transactions | (user_id, is_active) | BTREE |
| recurring_transactions | (user_id, type) | BTREE |
| transactions | (budget_id), (debtor_id), (creditor_id), (sub_type), (recurring_id) | PARTIAL |
| loans | (disbursement_account_id), (bank_entity_id) | PARTIAL |
| assets | (asset_type_id) | PARTIAL |
| app_notifications | (user_id, alert_type, is_read), (source_module, source_record_id) | BTREE/PARTIAL |

---

> [!IMPORTANT]
> **Esperando tu aprobación para continuar con la Fase 3 (Plan de Implementación).**
> Revisa el SQL en `fase2_migration.sql` — está listo para ejecutar en el SQL Editor de Supabase.
