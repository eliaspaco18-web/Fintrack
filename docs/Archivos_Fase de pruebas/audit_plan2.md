# Auditoría: implementation_plan1.md — Estado Final

> [!NOTE]
> Build Next.js ejecutado tras la auditoría: **✅ Compilación exitosa** (0 errores TypeScript, 3 lint errors corregidos en esta sesión).

---

## ✅ Fixes Aplicados en Esta Sesión

| Archivo | Error | Corrección |
|---------|-------|-----------|
| `app/api/alerts/route.ts:48` | `@typescript-eslint/no-explicit-any` | Reemplazado `as any` por union type explícita |
| `components/credits/CreditCardForm.tsx:310` | `react/no-unescaped-entities` | Escapado `"` → `&quot;` |
| `components/recurring/RecurringWorkspace.tsx:461` | `react/no-unescaped-entities` | Escapado `"` → `&quot;` |

---

## Estado de Implementación por Módulo

| Módulo | Estado PRD | Estado Real | Notas |
|--------|-----------|-------------|-------|
| Fase 0 — Limpieza | ✅ | ✅ Completo | |
| Fase 1 — Admin | ✅ | ✅ Completo | |
| Fase 2 — Portafolio | ✅ | ✅ Completo | |
| Fase 3 — Transacciones | ✅ (con pendientes) | ⚠️ Incompleto | Ver detalles abajo |
| Fase 4 — Créditos | ✅ | ✅ Completo | |
| Fase 5 — Activos | ✅ | ✅ Completo | |
| Fase 6 — Presupuestos | ✅ (con pendientes) | ⚠️ Incompleto | Ver detalles abajo |
| Fase 7 — Cuentas por Cobrar | ✅ | ✅ Completo | |
| Fase 8 — Cuentas por Pagar | ✅ | ✅ Completo | |
| Fase 9 — Alertas | ✅ | ✅ Completo | |
| Fase 10 — Recurrentes | ✅ | ✅ Completo | |
| Fase 11 — Dashboard | ✅ | ✅ Completo | |

---

## 🔴 Pendientes Identificados

### Fase 3 — Transacciones

| Item | Estado en PRD | Estado Real |
|------|--------------|-------------|
| Campo **Remitente** (Ingreso) | `⏳ requiere columna DB` | ✅ **YA implementado** — `sender` existe en `transactions` y en el form |
| Campo **Destinatario** (Egreso) | `⏳ requiere columna DB` | ✅ **YA implementado** — `recipient` existe en DB y en el form |
| Campo **Presupuesto** en Egreso (dropdown filtrado) | `⏳ depende de Fase 6` | ❌ **PENDIENTE** — Fase 6 ya existe pero el campo no está conectado en `TransactionForm` |

### Fase 6 — Presupuestos

| Item | Estado en PRD | Estado Real |
|------|--------------|-------------|
| Campo **Descripción** en formulario de presupuesto | `⏳ campo no incluido` | ❌ **PENDIENTE** — El `BudgetForm` no tiene campo descripción |
| **Crear nuevos períodos** con continuidad automática | `⏳ pendiente` | ❌ **PENDIENTE** — No hay botón ni lógica para generar siguiente período |
| **Botón por período → ver transacciones** | `⏳ pendiente` | ❌ **PENDIENTE** — No hay drill-down de período |

### Fase 11 — Dashboard (notas del plan)

| Item | Estado en PRD | Estado Real |
|------|--------------|-------------|
| Verificar que números coinciden con módulos reales | `⏳ pendiente` | ⚠️ **REQUIERE VERIFICACIÓN** en entorno con datos reales |

---

## Plan de Implementación en 3 Fases

---

### 📋 Fase A — Presupuestos: Completar Módulo 6

> Implementar los 3 ítems pendientes del módulo Presupuestos (Fase 6 del plan original).
> **Orden recomendado**: 1 → 2 → 3 (hay dependencia: el drill-down necesita el campo descripción).

#### A.1 — Campo Descripción en formulario de Presupuesto

**Archivos a modificar:**
- `components/management/BudgetsManager.tsx`
  - Agregar `description: string` al tipo `BudgetForm`
  - Agregar campo `description` al `EMPTY_FORM`
  - Renderizar campo de texto `Descripción` (opcional) en el formulario modal (entre Nombre y Categoría o al final antes de Notas)
  - Incluir `description` en el payload de POST/PATCH

- `app/api/budgets/route.ts` y `app/api/budgets/[id]/route.ts`
  - Verificar que la columna `description` existe en la tabla `budgets`
  - Si no existe, crear migración Supabase
  - Incluir `description` en INSERT/UPDATE

**Criterio de aceptación:**
- El campo aparece en el formulario de crear/editar presupuesto
- Se guarda y recupera correctamente

---

#### A.2 — Crear Nuevo Período con Continuidad Automática

**Descripción PRD:** Botón "Nuevo período" por presupuesto que genera un período nuevo con `start_date = end_date_anterior + 1 día` y `end_date` calculada automáticamente según la periodicidad.

**Archivos a modificar:**
- `components/management/BudgetsManager.tsx`
  - Agregar botón "Nuevo período" en cada fila/card de presupuesto activo
  - Al hacer click: pre-rellenar el formulario con `start_date = periodo_actual.end_date + 1 día`, el mismo `period_type`, `category_id`, `currency`, `amount`
  - La `end_date` se auto-calcula como siempre

**Criterio de aceptación:**
- Botón visible en lista y tarjetas de presupuesto activo
- Pre-rellena el form con los datos del período anterior
- Al guardar, crea un nuevo presupuesto separado con continuidad de fechas

---

#### A.3 — Drill-down de Período: Ver Transacciones del Presupuesto

**Descripción PRD:** Click en un período de presupuesto → ventana/panel con las transacciones que se imputaron a ese presupuesto en ese período.

**Archivos a crear/modificar:**
- `components/management/BudgetDetail.tsx` (nuevo)
  - Modal/panel lateral con lista de transacciones filtradas por `budget_id` + rango de fechas del período
  - Filtros internos: búsqueda por descripción, portafolio, fecha
  - Total gastado al final

- `app/api/budgets/[id]/transactions/route.ts` (nuevo o reusar `/api/transactions?budget_id=X`)
  - GET: transacciones con `budget_id = id` y `date BETWEEN period_start AND period_end`

**Criterio de aceptación:**
- Click en presupuesto muestra sus transacciones del período
- Total calculado coincide con `spent_amount` del presupuesto

---

### 📋 Fase B — Transacciones: Campo Presupuesto en Egreso ✅

> Conectar el campo Presupuesto en el formulario de Egreso (ya existe la Fase 6 con datos).

#### B.1 — Campo Presupuesto en TransactionForm (Egreso)

**Descripción PRD (línea 135):** Campo "Presupuesto" (desplegable filtrado por categoría) en el formulario de tipo Egreso.

**✅ Implementado:**

- `lib/contracts/ui.contracts.ts`
  - Agregado `budget_id?: string` a `TransactionFormValues`

- `lib/schemas/transaction.schemas.ts`
  - Agregado `budget_id?: zUUID.optional()` a `zCreateExpenseSchema`
  - También `sender` y `recipient` como opcionales en EXPENSE

- `modules/transactions/transaction.service.types.ts`
  - Agregado `budget_id?: string` a `CreateExpenseInput`
  - Agregado `p_budget_id: string | null` a `AtomicTransactionPayload`

- `modules/transactions/transaction.service.ts`
  - `buildAtomicPayload`: extrae `budget_id` del input EXPENSE
  - `callAtomicFunction`: pasa `p_budget_id` al RPC
  - `createTransactionFallback`: incluye `budget_id` en el INSERT directo

- `components/forms/TransactionForm/form.orchestrator.ts`
  - `buildPayload`: incluye `budget_id` en el branch EXPENSE

- `components/forms/TransactionForm/index.tsx`
  - `watch('budget_id')` para leer el valor del campo
  - `useEffect` que fetcha `/api/budgets?is_active=true` al montar cuando `type === 'EXPENSE'`
  - `filteredBudgets`: memo que filtra por `category_id` si hay categoría seleccionada
  - `useEffect` que resetea `budget_id` si el presupuesto elegido desaparece del filtro
  - Selector JSX visible solo cuando `operationType === 'expense'` y hay ≥ 1 presupuesto

**Criterios de aceptación cumplidos:**
- ✅ El campo aparece solo cuando el tipo de operación es "Egreso" (EXPENSE)
- ✅ Se filtra dinámicamente al cambiar la categoría
- ✅ Al guardar, la transacción queda vinculada al presupuesto (`budget_id` en la tabla `transactions`)
- ✅ Build TypeScript: 0 errores

---

### 📋 Fase C — Validación e Integración Final ✅

> Verificaciones transversales que aseguran la integridad de los datos entre módulos.

#### C.1 — Soporte para `?is_active` en `GET /api/budgets` ✅

- `app/api/budgets/route.ts`
  - ✅ Agregado soporte para `?is_active=true/false` como param de primer nivel
  - El param `is_active` toma precedencia sobre `include_inactive`/`status` (compatibilidad hacia atrás preservada)
  - ✅ El `TransactionForm` ya usaba `?is_active=true` — ahora la API responde correctamente
  - ✅ `?category_id=X` ya existía desde antes — confirmado activo

#### C.2 — Integridad del `spent_amount` con `budget_id` ✅

- `app/api/budgets/route.ts`
  - ✅ El SELECT de transacciones ahora incluye `id` y `budget_id`
  - ✅ `buildBudgetMetrics` tiene lógica de 2 prioridades:
    - **Prioridad 1**: la transacción tiene `budget_id = budget.id` → siempre cuenta
    - **Prioridad 2**: la transacción no tiene `budget_id` pero coincide en `category_id` → cuenta como fallback de categoría
  - Esto evita dobles conteos y refleja con precisión lo gastado por presupuesto

#### C.3 — Dashboard: Verificar números con datos reales

- Ejecutar la app con datos de prueba reales
- Confirmar que `balance_consolidado`, `resultado_mensual`, `patrimonio_neto` son correctos
- Confirmar que `KpiCards` muestra alertas pendientes correctas y navega a `/alerts`

**🔔 Nota:** C.3 es verificación manual en entorno con datos reales — no requiere cambios de código.

---

## Resumen de Archivos Afectados

```
Fase A (Presupuestos):
  components/management/BudgetsManager.tsx         (modificar)
  components/management/BudgetDetail.tsx            (crear)
  app/api/budgets/route.ts                          (modificar)
  app/api/budgets/[id]/route.ts                     (modificar)
  app/api/budgets/[id]/transactions/route.ts        (crear)
  supabase/migrations/...                           (si falta columna description)

Fase B (Transacciones → Presupuesto):
  lib/contracts/ui.contracts.ts                     (modificar)
  components/forms/TransactionForm/index.tsx        (modificar)
  components/forms/TransactionForm/form.orchestrator.ts (modificar)
  app/api/transactions/route.ts                     (verificar)
  app/api/budgets/route.ts                          (agregar filtros)

Fase C (Validación):
  app/api/budgets/route.ts                          (ajustar queries)
  Pruebas manuales / e2e
```

---

> [!IMPORTANT]
> Las Fases A y B son independientes entre sí y pueden implementarse en paralelo.
> La Fase C depende de que A y B estén completas.
> Orden recomendado: **A.1 → A.2 → A.3 → B.1 → C.1 → C.2 → C.3**
