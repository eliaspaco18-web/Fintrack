# Auditoría cruzada PRD v3 vs Plan de Implementación

Fuente funcional: `docs/fintrack-prd-v3.md`  
Fuente de estado: `docs/implementation_plan1.md`  
Fecha de auditoría: 2026-05-18

> Criterio de lectura: se consideran pendientes todos los ítems marcados como `[ ]`, `⏳`, con nota explícita de pendiente, fases con estado visual `🔲` aunque tengan subfases completadas, funcionalidades descritas en el PRD que no aparecen en el plan, y todas las secciones del PRD marcadas como `Mejora propuesta` o `Mejora – Nuevo` no implementadas en el plan.

---

## Módulo 1 — Dashboard

**Pendientes del plan:**
- `DashboardWorkspace`: el plan conserva un bloque `[ ] Panel central (de arriba a abajo)` aunque inmediatamente después aparece el mismo bloque como `[x]`. Requiere limpieza/verificación para confirmar estado real.
- `DashboardWorkspace`: el plan conserva un bloque `[ ] Panel derecho (de arriba a abajo)` aunque inmediatamente después aparece el mismo bloque como `[x]`. Requiere limpieza/verificación para confirmar estado real.
- Validación final pendiente: verificar que todos los números del Dashboard coinciden con los datos reales de los módulos ya implementados.
- La fase aparece como `🔲 Fase 11: Dashboard` aunque el progreso general y sus subfases figuran como completadas. Hay inconsistencia de estado documental.

**Pendientes del PRD no contemplados en el plan:**
- El encabezado del panel central debe ser estático y siempre visible independientemente del período seleccionado. El plan lista el `DashboardHeader`, pero no contempla explícitamente comportamiento sticky/estático ni su independencia frente a filtros de período.
- `Vencimientos Próximos` debe mostrar vencimientos dentro de los próximos 30 días. El plan implementa backend/sidebar como próximos 7 días y badges de urgencia hasta 7 días.
- `Vencimientos Próximos` debe mostrar un mensaje informativo cuando no hay vencimientos próximos. El plan no lo declara explícitamente en el widget.

**Mejoras propuestas del PRD sin implementar:**
- `Saldos Bancarios`: indicador de variación mensual debajo del total consolidado, mostrando diferencial contra el mes anterior.
- `Por Cobrar vs Por Pagar`: mini-listado de los 3 deudores o acreedores con mayor monto pendiente, con enlace directo a su ficha.
- `Egresos por Categoría`: toggle para alternar entre egresos por categoría e ingresos por categoría dentro de la misma tarjeta.
- Nueva tarjeta `Presupuestos del Mes`: estado de presupuestos activos del mes, monto definido, monto ejecutado, barra de progreso, porcentaje y navegación a Presupuestos.
- Nueva tarjeta `Créditos: Uso Rápido`: resumen de tarjetas y créditos bancarios para evaluar endeudamiento sin entrar al módulo Créditos.

**Dependencias bloqueantes** (si las hay):
- Corregir/confirmar fuente de datos de vencimientos a 30 días para créditos bancarios, ciclos de tarjeta y cuentas por pagar.
- Para `Presupuestos del Mes`, se necesita que la lógica de períodos de Presupuestos esté completa y que exista una consulta confiable de ejecución por categoría/rango.
- Para el toggle de ingresos/egresos por categoría, se necesita ampliar el endpoint de sidebar o crear un endpoint de categorías que devuelva ambas series.
- Para top deudores/acreedores con enlace directo, se necesita navegación estable a ficha/detalle en Cuentas por Cobrar y Cuentas por Pagar.
- Antes de implementar mejoras visuales, se debe resolver la validación numérica final del Dashboard para no decorar métricas incorrectas.

---

## Módulo 2 — Portafolio

**Pendientes del plan:**
- No se detectan ítems `[ ]`, `⏳` ni notas pendientes para este módulo.

**Pendientes del PRD no contemplados en el plan:**
- No se detectan brechas funcionales claras entre el PRD y el plan para este módulo.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Sin bloqueantes detectados en la documentación auditada.

---

## Módulo 3 — Transacciones

**Pendientes del plan:**
- `Ingreso`: campo `Remitente` sigue marcado `[ ]` y `⏳`; requiere columna de base de datos.
- `Egreso`: campo `Presupuesto` sigue marcado `[ ]` y `⏳`; depende de la lógica de Presupuestos.
- `Egreso`: campo `Destinatario` sigue marcado `[ ]` y `⏳`; requiere columna de base de datos.

**Pendientes del PRD no contemplados en el plan:**
- `Transferencia`: el PRD exige descripción automática con formato `Transferencia de [Portafolio Desde] / [Moneda Desde] a [Portafolio Hacia] / [Moneda Hacia]`; el plan la marca como texto libre.
- `Compra de Activo`: el PRD la define como tipo de operación dentro del modal de nueva transacción; el plan la registra como activada vía módulo `Activo` en formulario de egreso, no como operación completa desde el selector de Transacciones.
- `Compra de Activo`: el PRD incluye campo `Destinatario`; el plan resume campos y omite este campo en ese tipo de operación.
- `Cuentas por pagar`: el PRD exige campo `Acreedor` desde módulo POR PAGAR; el plan resume los campos y no lo contempla explícitamente en el tipo de operación de Transacciones.
- `Cuentas por cobrar`: el PRD exige campo `Deudor` desde POR COBRAR; el plan resume los campos y no lo contempla explícitamente en el tipo de operación de Transacciones.
- Guardar como transacción recurrente debe solicitar un nombre con el que se guardará; el plan marca el botón, pero no explicita la captura obligatoria del nombre desde el flujo de Transacciones.
- Filtro `Tipo de operación`: el PRD pide lista desplegable; el plan lo implementa como quick filter pills. Puede ser aceptable UX, pero no es concordancia estricta con el PRD.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Migración DB para `sender/remitente` y `recipient/destinatario`, más actualización de tipos, APIs, formularios y persistencia.
- Finalizar o validar la lógica de Presupuestos para filtrar presupuestos por misma categoría, rango de fechas y estado activo.
- Definir si Compra de Activo, Cuentas por Pagar y Cuentas por Cobrar deben abrirse desde el modal principal de Transacciones, desde sus módulos, o desde ambos, porque el PRD favorece el modal principal.
- Integración con Transacciones Recurrentes para exigir nombre y persistir plantilla con todos los campos necesarios.

---

## Módulo 4 — Créditos

**Pendientes del plan:**
- No se detectan ítems `[ ]`, `⏳` ni notas pendientes para este módulo.

**Pendientes del PRD no contemplados en el plan:**
- `Ciclos de Facturación`: el PRD indica que el año de facturación debe ir de 2016 a 2027 y ser extensible anualmente sin alterar registros. El plan contempla el rango, pero no explicita la extensibilidad anual segura.
- La vista de créditos puede identificarse por secciones según tipo de crédito. El plan contempla lista/tarjetas, pero no declara explícitamente separación visual por tipo.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Si se implementa extensibilidad anual real, conviene centralizar la generación de años para evitar cambios manuales posteriores.

---

## Módulo 5 — Activos

**Pendientes del plan:**
- No se detectan ítems `[ ]`, `⏳` ni notas pendientes para este módulo.

**Pendientes del PRD no contemplados en el plan:**
- No se detectan brechas funcionales claras entre el PRD y el plan para este módulo.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Sin bloqueantes detectados en la documentación auditada.

---

## Módulo 6 — Presupuestos

**Pendientes del plan:**
- Campo `Descripción` sigue marcado `[ ]` y `⏳`; el formulario actual no lo incluye.
- Crear nuevos períodos respetando la periodicidad original y habilitando continuidad automática sigue marcado `[ ]` y `⏳`.
- Botón por período para ver transacciones dentro de ese período sigue marcado `[ ]` y `⏳`.

**Pendientes del PRD no contemplados en el plan:**
- El PRD especifica que el detalle de transacciones por período debe mostrar `fecha`, `portafolio`, `destinatario`, `descripción` e `importe`. El plan solo menciona el botón para ver transacciones, pero no detalla esos campos de salida.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Se necesita persistir/editar `Descripción` si la base de datos o el tipo actual de presupuesto no lo soporta.
- La continuidad de períodos requiere definir modelo de períodos o reglas derivadas para no duplicar rangos ni romper presupuestos existentes.
- El detalle por período depende de que las transacciones de egreso tengan presupuesto asociado y destinatario disponible.

---

## Módulo 7 — Cuentas por Cobrar

**Pendientes del plan:**
- No se detectan ítems `[ ]`, `⏳` ni notas pendientes para este módulo.

**Pendientes del PRD no contemplados en el plan:**
- No se detectan brechas funcionales claras entre el PRD y el plan para este módulo.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Sin bloqueantes propios detectados, pero Dashboard depende de este módulo para top deudores y posición neta.

---

## Módulo 8 — Cuentas por Pagar

**Pendientes del plan:**
- La fase aparece como `🔲 Fase 8: Cuentas por Pagar` y mantiene una nota de implementación por subfases, aunque todas las subfases 8.1 a 8.4 figuran como `[x]`. Hay inconsistencia de estado documental que debe cerrarse.

**Pendientes del PRD no contemplados en el plan:**
- No se detectan brechas funcionales claras entre el PRD y el plan para este módulo.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Confirmar que el estado documental `🔲` no refleja una deuda real de QA o integración antes de usar este módulo como fuente para Dashboard y Alertas.

---

## Módulo 9 — Alertas

**Pendientes del plan:**
- La fase aparece como `🔲 Fase 9: Alertas` y mantiene una nota de implementación por subfases, aunque todas las subfases 9.1 a 9.4 figuran como `[x]`. Hay inconsistencia de estado documental que debe cerrarse.

**Pendientes del PRD no contemplados en el plan:**
- No se detectan brechas funcionales claras entre el PRD y el plan para este módulo.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Confirmar generación real de alertas con datos de Créditos, Presupuestos, Cuentas por Cobrar, Cuentas por Pagar y Transacciones Recurrentes.
- La alerta de presupuesto al 80% o excedido depende de que Presupuestos calcule correctamente ejecución por período.

---

## Módulo 10 — Administración

**Pendientes del plan:**
- No se detectan ítems `[ ]`, `⏳` ni notas pendientes para este módulo.

**Pendientes del PRD no contemplados en el plan:**
- No se detectan brechas funcionales claras entre el PRD y el plan para este módulo.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- Sin bloqueantes detectados en la documentación auditada.

---

## Módulo 11 — Transacciones Recurrentes

**Pendientes del plan:**
- No se detectan ítems `[ ]`, `⏳` ni notas pendientes para este módulo.

**Pendientes del PRD no contemplados en el plan:**
- No se detectan brechas funcionales claras entre el PRD y el plan para este módulo.

**Mejoras propuestas del PRD sin implementar:**
- No hay mejoras propuestas específicas en el PRD para este módulo.

**Dependencias bloqueantes** (si las hay):
- La acción `Usar` depende de que el formulario de Transacciones pueda prellenar todos los tipos de operación, incluyendo campos todavía pendientes como remitente, destinatario, presupuesto, acreedor y deudor.

---

## Resumen ejecutivo

### Total de items pendientes por módulo

| Módulo | Pendientes del plan | PRD no contemplado | Mejoras propuestas sin implementar | Total |
|---|---:|---:|---:|---:|
| 1. Dashboard | 4 | 3 | 5 | 12 |
| 2. Portafolio | 0 | 0 | 0 | 0 |
| 3. Transacciones | 3 | 7 | 0 | 10 |
| 4. Créditos | 0 | 2 | 0 | 2 |
| 5. Activos | 0 | 0 | 0 | 0 |
| 6. Presupuestos | 3 | 1 | 0 | 4 |
| 7. Cuentas por Cobrar | 0 | 0 | 0 | 0 |
| 8. Cuentas por Pagar | 1 | 0 | 0 | 1 |
| 9. Alertas | 1 | 0 | 0 | 1 |
| 10. Administración | 0 | 0 | 0 | 0 |
| 11. Transacciones Recurrentes | 0 | 0 | 0 | 0 |
| **Total general** | **12** | **13** | **5** | **30** |

### Orden de implementación recomendado por prioridad e impacto

1. **Transacciones — campos y concordancia estricta del modal**: alta prioridad porque impacta presupuesto, recurrentes, cuentas por cobrar/pagar, activos y consistencia de datos.
2. **Presupuestos — descripción, períodos y detalle de transacciones**: alta prioridad porque desbloquea filtro de presupuesto en egresos, alertas de presupuesto y widget `Presupuestos del Mes`.
3. **Dashboard — corrección de datos base y vencimientos a 30 días**: alta prioridad porque el Dashboard consolida todos los módulos y hoy tiene una validación numérica pendiente.
4. **Dashboard — mejoras propuestas de alto valor**: prioridad media-alta; agregan lectura financiera real, especialmente variación mensual, presupuestos del mes y créditos rápidos.
5. **Alertas y Cuentas por Pagar — saneamiento documental/QA**: prioridad media; no parece requerir gran implementación, pero conviene cerrar la inconsistencia `🔲` antes de depender de estos módulos.
6. **Créditos — extensibilidad anual y separación visual por tipo**: prioridad baja-media; son ajustes acotados, útiles para mantener concordancia estricta con el PRD.

### Estimación de complejidad por grupo

| Grupo | Complejidad | Motivo |
|---|---|---|
| Transacciones: remitente/destinatario, presupuesto, acreedor/deudor, descripción automática y recurrente con nombre | **L** | Requiere migración DB, tipos, APIs, formularios, validaciones y posible cambio de flujo principal. |
| Presupuestos: descripción, períodos continuos y detalle de transacciones | **L** | Toca modelo de período, consultas por rango/categoría, relación con transacciones y UI de detalle. |
| Dashboard: validación numérica, vencimientos a 30 días y limpieza de `[ ]` duplicados | **M** | Requiere ajustar queries y QA cruzado, pero no necesariamente cambia modelo de datos. |
| Dashboard: variación mensual, top deudores/acreedores, toggle ingresos/egresos, presupuestos del mes y créditos rápidos | **L** | Son varios widgets/queries nuevos y dependen de datos confiables de otros módulos. |
| Cuentas por Pagar y Alertas: cerrar inconsistencia documental `🔲` | **XS** | Probablemente es actualización de documentación/QA si la implementación está realmente completa. |
| Créditos: años extensibles y separación visual por tipo | **S** | Ajustes localizados de UI/utilidades, con bajo riesgo funcional. |

### Recomendación de arranque

El mejor primer paso es implementar o verificar **Transacciones + Presupuestos** antes de seguir puliendo Dashboard. Son la raíz de varias métricas y alertas; si los datos base quedan incompletos, el Dashboard puede verse terminado pero contar una historia incorrecta.
