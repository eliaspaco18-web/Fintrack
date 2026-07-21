# FinTrack Credits Redesign Plan

Alcance: replanteamiento total del modulo de Creditos.  
Estado: documentacion solamente, listo para ejecutar tras aprobacion.  
Base visual: `docs/FORMS_REDESIGN.md`, `RecordModal`, `FormSection`, `FormField`, `FormActions`, tokens `--ft-*` y footer nativo de `RecordModal`.

Principios obligatorios:

- Los cronogramas viven en ventanas separadas: segundo modal dedicado, nunca como zona derecha del modal principal.
- Los modales principales no tienen zona derecha. Usan una sola columna con secciones apiladas y un resumen compacto del cronograma.
- Meses siempre en espanol completo: `Enero`, `Febrero`, `Marzo`, `Abril`, `Mayo`, `Junio`, `Julio`, `Agosto`, `Setiembre`, `Octubre`, `Noviembre`, `Diciembre`.
- Fechas nunca cortadas: todo input `type="date"` dentro de tablas debe tener ancho minimo suficiente.
- Todos los modales usan footer nativo de `RecordModal`; no hay acciones dentro del body salvo acciones contextuales como `Ver/editar →` o `Agregar ciclo`.
- Motion y estados interactivos: transiciones maximo 150-200ms, solo `transform`, `opacity`, `border-color`, `background-color` y `color`; nada de `transition-all` en controles nuevos.

## PASO 1 — Replanteamiento de modales principales

Objetivo: convertir el alta de tarjeta y prestamo en formularios principales compactos, lineales y faciles de revisar. El cronograma se resume con stats compactas y se edita en una segunda ventana.

### CreditCardForm

Nuevo diseno:

- Modal principal: `RecordModal` con `widthClassName="max-w-[min(96vw,720px)]"` y `bodyClassName="py-5"`.
- Body: una sola columna, `gap-5`, sin `grid-cols-[38%_62%]`, sin panel lateral.
- Footer: `RecordModalFooter` con `FormActions`; `Cancelar` a la izquierda y `Crear tarjeta` a la derecha.
- Densidad: secciones con `p-4`, radio `--ft-form-radius`, borde `--ft-form-border`, fondo `--ft-form-surface`.
- Numeros: siempre con `tabular-nums`.

Orden de secciones y campos:

1. `Datos esenciales`
2. `Portafolio de tarjeta`
3. `Nombre de la tarjeta`
4. Bloque informativo compacto en 2 columnas: `Entidad bancaria` y `Moneda`
5. `Saldo inicial`
6. `Limite de credito`
7. `Monto usado actual Opcional`
8. Stat de capacidad: `Disponible inicial`, `Uso actual`, barra de utilizacion y microcopy `Consumo actual: X de Y`
9. `Cronograma`
10. Stats compactas en 4 columnas responsivas: `Total registrado`, `Ciclos`, `Primer pago`, `Ultimo pago`
11. Boton secundario ancho contenido: `Ver/editar →`
12. Error de ciclos duplicados bajo el boton, si aplica

Resumen de cronograma:

- El resumen reemplaza el panel lateral actual.
- Las stats deben ocupar una grilla compacta: `grid-cols-2` desde mobile amplio y `grid-cols-4` desde `640px`.
- Cada stat usa label de 11px, valor de 14-16px, `tabular-nums` cuando sea numerico.
- El boton debe decir exactamente `Ver/editar →`.
- El boton abre `CreditCardScheduleModal`.

### BankLoanForm

Nuevo diseno:

- Modal principal: `RecordModal` con `widthClassName="max-w-[min(96vw,760px)]"` y `bodyClassName="py-5"`.
- Body: una sola columna, `gap-5`, sin zona derecha.
- Footer: `RecordModalFooter` con `FormActions`; `Cancelar` a la izquierda y `Crear prestamo` a la derecha.
- La moneda del desembolso se muestra como informacion contextual, no como input.
- La descripcion sigue siendo opcional y queda al final de condiciones.

Orden de secciones y campos:

1. `Datos del prestamo`
2. `Entidad bancaria`
3. `Cuenta destino del desembolso`
4. `Nombre del prestamo`
5. Bloque informativo compacto: `Moneda del desembolso`
6. `Condiciones iniciales`
7. `Capital prestado`
8. `Numero de cuotas`
9. `Fecha de desembolso`
10. `Fecha de primera cuota`
11. `Descripcion Opcional`
12. `Cronograma`
13. Stats compactas en 4 columnas responsivas: `Capital total`, `Cuotas`, `Primera cuota`, `Ultima cuota`
14. Linea de resumen secundaria: `Total estimado` y `Seguro + otros`
15. Boton secundario: `Ver/editar →`
16. Nota discreta: `Los comprobantes se adjuntan al registrar pagos de cuotas.`

Resumen de cronograma:

- El resumen reemplaza el panel lateral actual.
- Las stats deben estar dentro del flujo del formulario, despues de condiciones iniciales.
- `Primera cuota` y `Ultima cuota` deben mostrar fechas completas sin truncamiento visual.
- El boton debe decir exactamente `Ver/editar →`.
- El boton abre `BankLoanScheduleModal`.

Archivos a tocar:

- `components/credits/CreditsWorkspace.tsx`
- `components/credits/CreditCardForm.tsx`
- `components/credits/BankLoanForm.tsx`
- `components/forms/primitives.tsx` solo si hace falta ajustar clases compartidas sin romper otros formularios.

Criterios de aceptacion visual:

- Los modales principales de tarjeta y prestamo no muestran tabla ni panel derecho de cronograma.
- En desktop, el formulario principal entra como una columna clara; el footer nativo permanece visible fuera del scroll.
- En mobile, el formulario conserva el mismo orden y no introduce scroll horizontal.
- Las acciones principales solo aparecen en el footer nativo de `RecordModal`.
- `Banco`, `moneda`, `entidad` y otros datos derivados se ven como informacion contextual, no como inputs deshabilitados.
- Los botones `Ver/editar →` son secundarios, visibles y no compiten con `Crear tarjeta` o `Crear prestamo`.
- Los errores de validacion se muestran cerca del contexto que bloquean: errores generales arriba del formulario, duplicados de cronograma dentro de la seccion `Cronograma`.
- El lenguaje visual conserva la base warm neutral de `FORMS_REDESIGN.md`: bordes sutiles, superficies tranquilas, datos financieros con `tabular-nums`, y jerarquia compacta tipo fintech.

## PASO 2 — Replanteamiento de ventanas de cronograma

Objetivo: mover la complejidad editable a modales dedicados de ancho completo, con tablas legibles, columnas estables y footer nativo. Estos modales se abren sobre el modal principal y devuelven al usuario al formulario sin perder datos.

### CreditCardScheduleModal

Nuevo diseno:

- Modal dedicado: `RecordModal` con `size="full-form"` y `widthClassName="w-[calc(100vw-2rem)] max-w-[1180px]"`.
- Overlay superior al modal principal: mantener una capa por encima del alta, por ejemplo `z-[132]`.
- Body: `overflow-hidden py-4`, layout `flex min-h-0 flex-col gap-4`.
- Header interno: titulo corto `Ciclos de facturacion`, descripcion de 1 linea y toolbar derecha con stat `Ciclos` + boton `Agregar ciclo`.
- Footer nativo: `Cerrar` como secundario a la izquierda y `Aplicar cambios` o `Listo` como primario a la derecha. Si no se separa confirmacion local, usar `Listo`.
- Selector de mes: `select` con nombres completos en espanol. No usar `shortLabel`, `Jan`, `Feb`, `Mar`, ni abreviaturas.

Tabla con columnas y anchos exactos:

| Columna | Ancho exacto | Contenido |
| --- | ---: | --- |
| `Periodo` | `220px` | Mes completo + anio, controles en una misma fila |
| `Consumo desde` | `150px` | Input fecha con `min-width: 132px` |
| `Consumo hasta` | `150px` | Input fecha con `min-width: 132px` |
| `Fecha de pago` | `150px` | Input fecha con `min-width: 132px` |
| `Total a pagar` | `150px` | `NumericInput`, alineado a la derecha |
| `Estado de cuenta` | `160px` | Boton/label de archivo, texto truncado solo para nombre de archivo |
| `Acciones` | `96px` | Eliminar fila, con `aria-label` |

Reglas de tabla:

- Usar `table-fixed` con `min-width: 1076px`; el contenedor puede tener `overflow-x-auto` solo en pantallas menores.
- Header sticky arriba y tfoot sticky abajo.
- Filas con altura minima `56px`.
- Duplicados de periodo se marcan en la celda `Periodo` y con mensaje debajo de la tabla.
- El total registrado vive en tfoot, alineado con `Total a pagar`.
- El selector de mes debe tener ancho minimo `128px` para mostrar `Setiembre` completo.
- El selector de anio debe tener ancho minimo `84px`.

### BankLoanScheduleModal

Nuevo diseno:

- Modal dedicado: `RecordModal` con `size="full-form"` y `widthClassName="w-[calc(100vw-2rem)] max-w-[1240px]"`.
- Overlay superior al modal principal: mantener una capa por encima del alta, por ejemplo `z-[132]`.
- Body: `overflow-hidden py-4`, layout `flex min-h-0 flex-col gap-4`.
- Header interno: titulo `Editor completo de cuotas`, descripcion de 1 linea y resumen de metricas arriba de la tabla.
- Footer nativo: `Cerrar` como secundario a la izquierda y `Listo` como primario a la derecha.
- No incluir comprobantes por cuota en este modal de creacion; se adjuntan al registrar pagos.

Resumen de metricas:

- Grilla compacta de 5 stats antes de la tabla.
- Stats: `Capital`, `Intereses`, `Seguro`, `Otros`, `Total estimado`.
- Valores con `tabular-nums`, labels de 10-11px y valores de 14-16px.
- `Total estimado` debe tener mayor peso visual que las otras stats, pero sin usar otro color de acento.

Tabla con columnas y anchos exactos:

| Columna | Ancho exacto | Contenido |
| --- | ---: | --- |
| `#` | `64px` | Numero de cuota |
| `Vencimiento` | `160px` | Input fecha con `min-width: 136px` |
| `Capital` | `150px` | `NumericInput`, alineado a la derecha |
| `Intereses` | `150px` | `NumericInput`, alineado a la derecha |
| `Seguro` | `150px` | `NumericInput`, alineado a la derecha |
| `Otros` | `150px` | `NumericInput`, alineado a la derecha |
| `Cuota` | `170px` | Total calculado, `tabular-nums`, alineado a la derecha |

Reglas de tabla:

- Usar `table-fixed` con `min-width: 994px`; el contenedor puede tener `overflow-x-auto` solo en pantallas menores.
- Header sticky arriba y tfoot sticky abajo.
- Filas con altura minima `52px`.
- Inputs de fecha no pueden comprimirse por debajo de `136px`; la fecha debe verse completa.
- Totales en tfoot alineados columna por columna: capital, intereses, seguro, otros y cuota.
- Si `Numero de cuotas` es invalido o cero, mostrar empty state en una fila completa: `Ingresa el numero de cuotas para generar el cronograma.`

Archivos a tocar:

- `components/credits/CreditCardForm.tsx`
- `components/credits/BankLoanForm.tsx`
- `components/credits/CreditCardScheduleModal.tsx` nuevo archivo recomendado para extraer la ventana dedicada.
- `components/credits/BankLoanScheduleModal.tsx` nuevo archivo recomendado para extraer la ventana dedicada.
- `components/credits/credits-schedule.constants.ts` nuevo archivo opcional para `MONTHS`, anchos de tabla y helpers compartidos.
- `lib/credits/billing-cycle-years.ts` solo si hace falta normalizar opciones de anio.

Criterios de aceptacion visual:

- Los cronogramas se abren como segundo modal independiente y no deforman el modal principal.
- Todas las tablas tienen columnas con anchos exactos y lectura estable; no hay columnas que cambien de ancho al editar.
- Ningun mes aparece abreviado o en ingles; todos los meses se muestran en espanol completo.
- Ningun input de fecha se corta visualmente, incluyendo `Setiembre` en periodo y fechas con controles nativos del navegador.
- El footer nativo de `RecordModal` esta presente en ambos modales de cronograma.
- La tabla puede scrollear horizontalmente en viewport pequeno, pero nunca comprime inputs hasta cortar fechas.
- Header y footer de tabla permanecen visibles durante scroll vertical.
- El foco queda atrapado en el modal activo; al cerrar el cronograma, el usuario vuelve al modal principal sin perder datos.
- Las acciones de archivo y eliminar tienen labels accesibles y estados hover/focus visibles.
- El modal de prestamo no muestra carga de comprobantes por cuota durante la creacion.

## Nota sobre FORMS_REDESIGN.md

- El P3 de `FORMS_REDESIGN.md` queda en stand by hasta que `CREDITS_REDESIGN.md` este implementado y aprobado.
- Tras aprobacion de `CREDITS_REDESIGN`, continuar con P4 de `FORMS_REDESIGN.md`.
