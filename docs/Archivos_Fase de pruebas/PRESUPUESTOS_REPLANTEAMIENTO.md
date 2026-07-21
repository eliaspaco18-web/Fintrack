# Replanteamiento del modulo de Presupuestos

## Diagnostico

El modulo ya resolvio una parte importante del PRD: permite crear presupuestos, calcular fecha fin por periodicidad, crear un nuevo periodo continuo y ver movimientos del periodo. El problema actual esta en el modelo mental y en el modelo de datos: una fila de `budgets` representa al mismo tiempo el presupuesto conceptual y un periodo especifico.

Esto hace que un presupuesto mensual como `Transporte` pueda terminar apareciendo 12 veces al ano. La lista principal se llena de filas repetidas, los totales cuentan periodos como si fueran presupuestos independientes y la busqueda obliga al usuario a distinguir clones por fechas. El resultado es correcto a nivel contable, pero poco legible como herramienta operativa.

La dinamica recomendada es separar tres conceptos:

1. **Presupuesto maestro**: la identidad estable. Ejemplo: `Transporte`.
2. **Periodo presupuestal**: cada rango generado por periodicidad. Ejemplo: `01 ene. - 31 ene.`.
3. **Movimientos del periodo**: egresos imputados al presupuesto dentro de ese rango.

## Objetivo del upgrade

Convertir Presupuestos en un modulo de control por series: una sola tarjeta o fila por presupuesto maestro, con periodos internos generados por periodicidad, importes editables por periodo y detalle de movimientos dentro de cada periodo.

La pantalla principal debe responder: "Que presupuestos tengo y como van ahora?". La vista interna debe responder: "Que paso en cada periodo y que movimientos explican la ejecucion?".

## Modelo funcional propuesto

### Presupuesto maestro

Representa la regla base y la identidad del control.

Campos sugeridos:

- `id`
- `user_id`
- `name`
- `description`
- `category_id`
- `currency`
- `period_type`
- `default_amount`
- `start_date`
- `end_date` opcional
- `is_active`
- `notes`
- `created_at`
- `updated_at`

Reglas:

- El nombre debe ser unico por usuario entre presupuestos maestros activos o historicos reutilizables.
- Categoria, moneda y periodicidad pertenecen al maestro.
- El importe base vive en `default_amount`, pero puede ser sobrescrito por periodo.
- Desactivar el maestro no elimina periodos historicos ni movimientos.

### Periodo presupuestal

Representa una instancia concreta del presupuesto en un rango.

Campos sugeridos:

- `id`
- `budget_id`
- `period_start`
- `period_end`
- `amount`
- `status`: `PLANNED`, `ACTIVE`, `CLOSED`, `SKIPPED`
- `notes`
- `created_at`
- `updated_at`

Reglas:

- Un periodo hereda el importe base al crearse, pero puede modificarse sin afectar otros periodos.
- No puede haber rangos solapados para el mismo `budget_id`.
- La continuidad debe calcular el siguiente rango desde el ultimo periodo existente.
- Se debe permitir crear periodos faltantes, saltar un periodo o cerrar un periodo.
- La eliminacion de un periodo con movimientos debe bloquearse o convertirse en archivado/cierre.

### Movimientos del periodo

La relacion ideal es que los egresos apunten al periodo, no solo al presupuesto maestro.

Campos sugeridos en `transactions`:

- Mantener temporalmente `budget_id` por compatibilidad.
- Agregar `budget_period_id` para imputacion exacta.

Reglas:

- Al registrar un egreso, el selector debe mostrar presupuestos maestros compatibles con categoria y fecha.
- Internamente, la app debe resolver o crear el periodo correspondiente y guardar `budget_period_id`.
- Si hay un presupuesto compatible pero el periodo aun no existe, la app puede ofrecer: "Crear periodo para esta fecha".
- El detalle de movimientos debe filtrarse por `budget_period_id`; durante la transicion puede caer a `budget_id + rango`.

## Arquitectura de datos recomendada

### Opcion recomendada: nuevas tablas explicitas

Crear:

- `budget_series` o `budget_templates`: presupuesto maestro.
- `budget_periods`: periodos concretos.

Mantener `budgets` durante una fase puente como tabla legacy o vista compatible.

Ventajas:

- El listado principal deja de duplicarse.
- Los movimientos quedan imputados al periodo exacto.
- Dashboard y alertas pueden calcular ejecucion por periodo sin ambiguedad.
- Se puede editar el importe de febrero sin alterar enero, marzo o el maestro.
- Facilita vista calendario/matriz por periodos.

Costo:

- Requiere migracion y ajustes de APIs, tipos, formularios, tests, dashboard y alertas.

### Opcion puente: agrupar por `series_id`

Sin cambiar schema de inmediato, el frontend y API podrian agrupar filas actuales por `series_id` y mostrar una sola fila por serie.

Ventajas:

- Menor riesgo inicial.
- Permite validar UX antes de migracion grande.
- Reutiliza lo ya implementado.

Limites:

- `budgets` seguiria mezclando maestro y periodo.
- `transactions.budget_id` seguiria apuntando a un periodo/fila concreta.
- Las metricas pueden seguir siendo fragiles si una serie tiene muchos periodos activos.

Recomendacion: usar esta opcion solo como fase 1, no como destino final.

## Propuesta de experiencia

### Vista principal: Presupuestos

Mostrar una fila/tarjeta por presupuesto maestro.

Contenido recomendado:

- Nombre, categoria, moneda y periodicidad.
- Periodo actual visible como chip o selector compacto.
- Importe del periodo actual.
- Gastado, disponible, porcentaje y estado.
- Indicador de continuidad: `12 periodos`, `2 faltantes`, `ultimo: dic. 2026`.
- Acciones: ver detalle, editar maestro, nuevo periodo, pausar, archivar.

Filtros:

- Estado del presupuesto maestro.
- Moneda.
- Periodicidad.
- Categoria.
- Periodo seleccionado: mes, trimestre, ano o rango.

Evitar que el listado principal muestre enero, febrero y marzo como filas separadas del mismo presupuesto. La fecha debe ser contexto, no identidad principal.

### Vista detalle del presupuesto

Al abrir `Transporte`, mostrar:

- Header del presupuesto maestro.
- Resumen del periodo seleccionado.
- Selector de periodo con timeline horizontal o tabla compacta.
- Lista de periodos generados.
- Movimientos del periodo seleccionado.

Secciones sugeridas:

- **Resumen**: importe, gastado, disponible, porcentaje, estado.
- **Periodos**: tabla con rango, importe, gastado, disponible, estado y acciones.
- **Movimientos**: fecha, portafolio, destinatario, descripcion e importe.
- **Configuracion**: categoria, moneda, periodicidad, importe base, notas.

Acciones por periodo:

- Editar importe.
- Ver movimientos.
- Crear siguiente periodo.
- Cerrar periodo.
- Saltar periodo.
- Reabrir si no esta bloqueado por reglas contables.

### Vista por periodos

Agregar una vista secundaria dentro del modulo: `Por periodo`.

Esta vista debe permitir leer, por ejemplo, `Marzo 2026` y ver todos los presupuestos existentes para ese periodo.

Columnas sugeridas:

- Presupuesto.
- Categoria.
- Importe del periodo.
- Gastado.
- Disponible.
- Ejecucion.
- Estado.
- Movimientos.

Comportamientos importantes:

- Mostrar presupuestos que existen en el periodo.
- Mostrar presupuestos que no existen pero podrian generarse desde una serie activa.
- Permitir crear los periodos faltantes en lote para el mes/trimestre seleccionado.
- Identificar claramente `Sin periodo creado`, `Sin movimientos`, `Excedido`, `Cerrado`.

Esta vista es valiosa porque un mes puede tener presupuestos distintos a otro: vacaciones en julio, utiles escolares en marzo, impuestos en fechas especificas, etc.

## Reglas de negocio sugeridas

- Un presupuesto maestro puede estar activo aunque algunos periodos esten cerrados.
- Un periodo cerrado no debe recibir nuevos movimientos sin confirmacion o reapertura.
- Si se cambia categoria/moneda del maestro, decidir si aplica solo a periodos futuros.
- Editar `default_amount` no debe modificar periodos historicos por defecto.
- Debe existir accion explicita: "Aplicar nuevo importe a periodos futuros".
- La periodicidad debe bloquearse si ya hay periodos historicos, o permitir cambio solo desde una fecha futura.
- Los presupuestos sin categoria pueden aplicar a todos los egresos, pero se recomienda exigir categoria para evitar imputaciones ambiguas.
- Las alertas deben evaluarse por periodo activo, no por maestro completo.
- El dashboard debe sumar presupuestos del periodo seleccionado, no todas las filas activas historicas.

## Impacto en modulos existentes

### Movimientos

El selector de presupuesto debe cambiar de "fila de presupuesto" a "presupuesto compatible para la fecha". Al guardar un egreso se debe resolver el periodo.

Flujo sugerido:

1. Usuario elige fecha y categoria.
2. La app carga presupuestos maestros compatibles.
3. Usuario elige `Transporte`.
4. La app encuentra el periodo que contiene la fecha.
5. Si no existe, ofrece crear periodo o guardar sin presupuesto.
6. Se guarda `budget_period_id`.

### Dashboard

El widget `Presupuestos del Mes` debe leer periodos, no presupuestos duplicados. Debe sumar `budget_periods.amount` y ejecucion por `budget_period_id`.

### Alertas

Las alertas del 80% o presupuesto excedido deben tener `source_record_id` apuntando idealmente al periodo. En el mensaje se puede mostrar: `Transporte - marzo 2026`.

### Importacion Excel

Si se importan movimientos con presupuesto, se debe resolver por nombre de maestro + fecha. Si el periodo no existe, el analizador debe reportar advertencia y ofrecer crear periodos faltantes.

### Release y QA

Actualizar `docs/PRODUCCION_LANZAMIENTO.md` para incluir:

- crear presupuesto maestro;
- crear periodo;
- editar importe de un periodo;
- crear egreso asociado a periodo;
- validar vista por periodo;
- validar alerta de presupuesto;
- validar dashboard de presupuestos del mes.

## Fases de implementacion

### Fase 0: Decision funcional y contratos

Objetivo: cerrar las reglas antes de tocar DB.

Decisiones iniciales para avanzar:

- Usar `budget_series` y `budget_periods` como nombres destino. `budget_series` representa el presupuesto maestro; `budget_periods` representa cada rango operativo.
- Mantener la categoria como recomendada en la fase puente y volverla obligatoria en la migracion destino, salvo que se defina un caso claro para presupuestos generales.
- Bloquear cambio de periodicidad cuando ya existan periodos historicos con movimientos. Si se necesita otra periodicidad, crear una nueva serie desde una fecha futura.
- Cambiar `default_amount` no modifica periodos existentes. Debe existir una accion explicita para aplicar el nuevo importe a periodos futuros.
- En la fase puente, `budgets` sigue siendo la tabla operativa; la UI agrupa por `series_id` para evitar duplicados visuales.

Entregables:

- Confirmar nombres finales: `budget_series` + `budget_periods` o `budget_templates` + `budget_periods`.
- Definir estados de periodo.
- Definir si la categoria es obligatoria.
- Definir comportamiento al cambiar importe base, categoria, moneda y periodicidad.
- Definir politica para periodos sin movimientos y periodos cerrados.

Criterio de salida:

- Documento de contrato aprobado.
- Lista de endpoints y tipos acordada.

### Fase 1: UX puente agrupando por `series_id`

Objetivo: resolver el dolor visual rapido sin migracion mayor.

Cambios:

- Modificar `/api/budgets` o crear endpoint agregado para devolver una entidad por `series_id`.
- En `BudgetsManager`, mostrar una fila por serie.
- Dentro del detalle, listar los periodos existentes de esa serie.
- Mantener el modal de movimientos por periodo.
- Ajustar contadores: activos, monto PEN/USD y excedidos deben contar periodo actual por serie, no todas las filas.

Criterio de salida:

- `Transporte` aparece una sola vez en la pantalla principal.
- Se puede abrir y ver enero/febrero/marzo dentro del detalle.
- No se rompen movimientos existentes porque siguen usando `transactions.budget_id`.

### Fase 2: Schema destino

Objetivo: separar maestro y periodos en la base de datos.

Migraciones sugeridas:

- Crear `budget_series`.
- Crear `budget_periods`.
- Agregar `transactions.budget_period_id`.
- Backfill desde `budgets`:
  - un registro maestro por `series_id`;
  - un periodo por cada fila actual de `budgets`;
  - mapear `transactions.budget_id` al `budget_period_id` creado.
- Agregar constraints:
  - unique `(user_id, lower(name))` en maestro;
  - no solapamiento por `budget_id` en periodos;
  - `period_end >= period_start`;
  - `amount > 0`.

Criterio de salida:

- Datos legacy migrados.
- Tipos de Supabase regenerados.
- Tests de integridad para no solapar periodos.

### Fase 3: APIs y servicios

Objetivo: mover la logica de negocio al modelo nuevo.

Endpoints sugeridos:

- `GET /api/budgets`: lista maestros enriquecidos con periodo actual.
- `POST /api/budgets`: crea maestro y primer periodo opcional.
- `GET /api/budgets/:id`: detalle maestro + periodos.
- `PATCH /api/budgets/:id`: edita maestro.
- `POST /api/budgets/:id/periods`: crea siguiente periodo o periodo especifico.
- `PATCH /api/budget-periods/:id`: edita importe/estado/notas.
- `GET /api/budget-periods/:id/transactions`: movimientos del periodo.
- `GET /api/budget-periods?period=YYYY-MM`: vista transversal por periodo.

Servicios:

- `resolveBudgetPeriodForTransaction(date, category_id, budget_id)`.
- `buildBudgetPeriodMetrics(period, transactions)`.
- `createNextBudgetPeriod(budget_id)`.
- `createMissingPeriodsForRange(budget_id, range)`.

Criterio de salida:

- Movimientos nuevos guardan `budget_period_id`.
- Metricas usan periodos.
- Endpoints legacy siguen funcionando temporalmente si aun hay componentes migrandose.

### Fase 4: UI final

Objetivo: consolidar la experiencia nueva.

Cambios:

- `BudgetsManager`: lista de maestros.
- `BudgetDetail`: convertirlo en panel completo con tabs `Resumen`, `Periodos`, `Movimientos`, `Configuracion`.
- Crear `BudgetPeriodsManager` para la tabla interna de periodos.
- Crear vista `Por periodo` como tab o toggle junto a `Listado`.
- Permitir editar importe por periodo desde inline edit o modal pequeno.
- Agregar estados vacios:
  - presupuesto sin periodos futuros;
  - periodo sin movimientos;
  - periodo faltante para rango seleccionado.

Criterio de salida:

- El usuario puede gestionar todo `Transporte` desde un solo detalle.
- Puede cambiar solo el importe de marzo.
- Puede ver todos los presupuestos de marzo desde `Por periodo`.

### Fase 5: Dashboard, alertas e importacion

Objetivo: cerrar dependencias transversales.

Cambios:

- Dashboard lee `budget_periods`.
- Alertas apuntan a periodos.
- TransactionForm filtra por maestro y resuelve periodo.
- Importacion Excel resuelve presupuestos por nombre + fecha.
- Actualizar rollback de importaciones para `budget_periods`.

Criterio de salida:

- Las cifras del dashboard coinciden con la vista por periodo.
- Las alertas no se duplican entre periodos de la misma serie.
- Una importacion no crea relaciones ambiguas.

### Fase 6: Limpieza legacy y QA de produccion

Objetivo: retirar ambiguedades y estabilizar.

Cambios:

- Deprecar endpoints o campos legacy.
- Decidir si `budgets` se elimina, se conserva como vista SQL o se mantiene solo para auditoria.
- Actualizar `types/database.types.ts`.
- Ampliar e2e:
  - crear presupuesto maestro;
  - crear siguiente periodo;
  - editar importe por periodo;
  - crear egreso y verificar imputacion;
  - vista por periodo;
  - alerta 80%;
  - dashboard presupuestos del mes.

Criterio de salida:

- No quedan componentes leyendo una fila de presupuesto como si fuera maestro y periodo a la vez.
- QA de produccion documentado y repetible.

## Riesgos y mitigaciones

- **Migracion de datos historicos**: crear tabla de mapeo temporal `legacy_budget_id -> budget_period_id` durante el backfill.
- **Movimientos ya asociados a `budget_id`**: mantener ambos campos hasta completar migracion y validar conteos.
- **Alertas duplicadas**: cambiar llave logica a `budget_period_id + threshold`.
- **Periodos faltantes**: ofrecer creacion asistida y no asumir que todos los meses deben existir.
- **Cambio de periodicidad**: permitir solo desde periodos futuros o crear nueva serie.
- **Performance**: indexar `budget_periods (budget_id, period_start, period_end)` y `transactions (user_id, budget_period_id, transaction_date)`.

## Recomendacion final

Implementaria primero la fase puente de agrupacion por `series_id` para aliviar la pantalla principal rapido. Luego haria la migracion real a `budget_series` + `budget_periods`, porque el modelo actual ya demostro el limite: funciona para continuidad, pero no para lectura operativa.

La meta no es tener "12 presupuestos de Transporte"; es tener un presupuesto `Transporte` con 12 periodos administrables, cada uno con su importe, ejecucion y movimientos.
