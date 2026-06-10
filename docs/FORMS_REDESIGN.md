# FinTrack Forms Redesign Audit

Fase 1: auditoria integral de formularios y modales.  
Alcance: documentacion solamente. No se modifica codigo de producto.

## Criterio de evaluacion

FinTrack ya tiene un lenguaje visual warm neutral profesional, tokens `--ft-*`, componentes financieros y `RecordModal` como base. La oportunidad no es "hacerlo bonito" desde cero, sino convertir los formularios en un sistema mas consistente, mas facil de llenar y con menor tasa de error.

Principios aplicados:

- Primero el flujo mental del usuario: que intenta registrar, pagar, cobrar, configurar o administrar.
- Campos obligatorios claros por ausencia de marca; campos opcionales marcados como `Opcional` en el label.
- Menos campos visibles al inicio; detalles avanzados en secciones progresivas.
- Acciones siempre en footer fijo del modal: secundaria a la izquierda, primaria a la derecha.
- Validacion inline cercana al campo, con resumen solo cuando el error bloquea todo el formulario.
- Modal dimensionado por complejidad real, no por un ancho global.

## Hallazgos Transversales

### Base modal actual

Fuente principal: `components/ui/RecordModal.tsx`.

Descripcion actual:

- `RecordModal` ofrece overlay, foco inicial, `FocusTrap`, cabecera con titulo/subtitulo/eyebrow y boton cerrar.
- Ancho por defecto: `max-w-[min(96vw,1320px)]`.
- Altura maxima con scroll interno: `max-h-[calc(100vh-2rem)]`.
- No tiene footer nativo para acciones.
- Cada formulario resuelve acciones, errores y estructura con patrones propios.

Problemas detectados:

- 🔴 Critico: ausencia de footer nativo genera acciones inconsistentes: algunas quedan izquierda, otras derecha, otras dentro de paneles internos.
- 🟡 Importante: el ancho por defecto de 1320px hace que formularios pequenos como monedas, categorias o tipos de activo se vean desproporcionados.
- 🟡 Importante: el scroll vive en el contenedor general, asi que en formularios largos las acciones pueden perderse.
- 🟢 Menor: la cabecera es solida, pero falta una convencion visual de secciones internas.

Propuesta:

- Extender `RecordModal` para aceptar `footer`, `size` y `bodyClassName`.
- Sizes recomendados: `sm 480px`, `md 560px`, `lg 720px`, `xl 920px`, `full-form 1080px`.
- Footer sticky dentro del modal, con borde superior sutil y fondo `--ft-surface`.
- Mantener header fijo cuando el formulario supere 70vh.

Referencia visual:

- Linear issue form para header compacto + acciones claras.
- Stripe modal patterns para footer estable y validacion cercana.

Impacto:

- Alta friccion actual en modales complejos; mejora esperada alta.

### Primitivas de formulario actuales

Fuentes principales:

- `components/forms/TransactionForm/FormFields.tsx`
- `components/settings/primitives.tsx`

Descripcion actual:

- Labels estaticos uppercase, 11px, con asterisco rojo para obligatorios.
- Inputs redondeados, altura aproximada 42px, fondo `--c-surface-2`.
- Error inline con icono rojo y animacion.
- Select custom mediante `AppSelect`.
- `CollapsibleSection` existe, pero no esta aplicado de forma sistematica.
- Settings usa otra familia visual: `settingsInputClassName`, radios/toggles/panels propios.

Problemas detectados:

- 🔴 Critico: no hay sistema unico de `FormField`, `FormSection` y `FormActions`; el usuario percibe productos distintos dentro de la misma app.
- 🟡 Importante: el asterisco obliga al usuario a buscar lo obligatorio. En SaaS financiero conviene marcar lo opcional, porque el default mental debe ser "esto es requerido para registrar bien".
- 🟡 Importante: `transition-all` aparece en controles; puede causar animaciones no intencionales y layout jitter.
- 🟢 Menor: labels uppercase funcionan para densidad, pero en formularios largos reducen legibilidad.

Propuesta:

- Crear componentes base: `FormField`, `FormSection`, `FormActions`, `FormSeparator`, `OptionalSection`.
- Labels estaticos, no flotantes. En finanzas, labels siempre visibles reducen errores.
- Altura de input estandar: 44px desktop, 46px touch/mobile.
- Separacion vertical: 16px entre campos relacionados, 24px entre secciones, 32px antes del footer.
- Campo opcional: `Notas Opcional`, `Comprobante Opcional`, `Alias Opcional`.
- Error: inline bajo el campo; resumen superior solo para errores de formulario o dependencia.

Referencia visual:

- Mercury transfer form para densidad tranquila y confianza.
- Brex expense form para evidencia/comprobante y campos opcionales.

Impacto:

- Alta friccion actual por inconsistencia; mejora esperada alta.

---

# Auditoria Modulo por Modulo

## 1. Modal de Nueva Transaccion

Incluye: Ingreso, Egreso, Transferencia, Compra de Activo, Por Cobrar y Por Pagar.

Fuentes principales:

- `components/transactions/TransactionsWorkspace.tsx`
- `components/transactions/OperationTypeSelector.tsx`
- `components/forms/TransactionForm/index.tsx`
- `components/forms/TransactionForm/FormFields.tsx`
- `components/forms/TransactionForm/sections/ModuleSections.tsx`

### Revision P1 post-implementacion

Esta revision reemplaza la recomendacion inicial de formularios de transaccion en una sola columna. La implementacion actual corrigio ruido visual con `OptionalSection`, footer estable y labels opcionales, pero llevo los modales a un carril vertical de 620-720px. En desktop, eso obliga a hacer scroll para registrar operaciones que podrian completarse en una sola pantalla.

Analisis visual actual:

- Selector: `max-w-[min(96vw,560px)]`, 2 columnas. Se siente proporcionado.
- Ingreso: `640px`, wrapper `flex-col`, monto/equivalencia/cuenta/categoria/descripcion/fecha/opciones apilados.
- Egreso: `680px`, wrapper `flex-col`, metodo de pago y campos condicionales consumen altura antes de llegar a descripcion/opciones.
- Transferencia: `620px`, cuentas en una columna, resumen, monto, equivalencia, descripcion y opciones apiladas.
- Compra de activo: `720px`, activo y pago siguen una secuencia vertical aunque naturalmente son dos grupos paralelos.
- Por pagar / por cobrar: `720px`, no usan la misma seccion opcional progresiva; acreedor/deudor aparecen despues de campos secundarios, lo que rompe la prioridad cognitiva.
- Footer: existe dentro del form como sticky local; visualmente funciona, pero no aprovecha el `footer` nativo de `RecordModal`.

Principio revisado para P1:

- En desktop, los modales de transaccion deben usar una grilla de dos zonas, no una columna angosta.
- La grilla no significa "dos columnas siempre iguales"; significa distribuir campos por decision financiera:
  - Zona izquierda: contexto de la operacion, origen/destino, contraparte, categoria.
  - Zona derecha: importe, moneda, fecha, descripcion, equivalencia.
- `Mas opciones` debe quedar cerrado por defecto y ocupar todo el ancho al final de la grilla, o una zona secundaria cuando el formulario sea muy corto.
- El footer debe estar fuera del scroll del cuerpo. Si el usuario no abre opciones avanzadas, el registro debe entrar completo en una pantalla desktop comun.
- En mobile se vuelve a una columna, porque ahi el ancho disponible si justifica scroll.

Propuesta de shell uniforme P1:

- Selector de tipo: 640px, 2 columnas.
- Formularios de transaccion: un ancho base uniforme de 920px.
- Compra de activo, cuenta por pagar y cuenta por cobrar pueden subir a 960px si incluyen vencimiento o una seccion de entidad mas rica.
- Body desktop: `grid-template-columns: minmax(0, 1.04fr) minmax(320px, 0.96fr)`, gap 20px.
- Body tablet: 2 columnas solo desde 860px; debajo de eso, 1 columna.
- Max-height: `calc(100dvh - 32px)`, con header y footer fuera del area scrolleable.
- Scroll aceptado solo cuando:
  - se abre `Mas opciones`;
  - aparece tipo de cambio mas validaciones inline;
  - no existen cuentas/categorias y aparecen feedback blocks;
  - viewport vertical es menor a 720px;
  - mobile.

Revision de craft y motion:

| Before | After | Why |
| --- | --- | --- |
| Formulario P1 como `flex-col` angosto | Shell P1 con grilla por zonas en desktop | Reduce scroll y aprovecha el espacio modal sin perder lectura |
| `max-w` distinto por tipo entre 620px y 720px | Ancho base uniforme 920px para transacciones | Los modales se sienten parte de la misma familia y la memoria muscular mejora |
| Cuentas de transferencia apiladas | Origen y destino en la misma zona, con resumen compacto debajo | La relacion entre cuentas es el centro del formulario |
| Activo y pago en una sola secuencia vertical | Dos secciones paralelas: `Activo` y `Pago` | Separa modelos mentales sin aumentar pasos |
| Acreedor/deudor despues de opciones secundarias | Acreedor/deudor como primer campo de contexto | Evita registrar una obligacion sin la contraparte visible |
| Condicionales que empujan todo el contenido | Reservar zonas estables y usar cambios de opacity/transform cuando aplique | Menos salto visual, mas sensacion de control |

Referencias visuales revisadas:

- Mercury transfer form: origen/destino/importe como composicion horizontal compacta.
- Stripe Payment Element: grupos claros, campos de importe y metadata en zonas previsibles.
- Linear issue form: densidad profesional, labels estaticos y acciones siempre disponibles.

### 1.1 Selector de tipo de operacion

Descripcion actual:

- Modal inicial `Nueva transaccion`, ancho aproximado 560px.
- Seis tarjetas: Ingreso, Egreso, Transferencia, Compra de Activo, Cuentas por pagar, Cuentas por cobrar.
- Layout 2 columnas en mobile amplio y 3 columnas en desktop pequeno.
- Cada opcion incluye icono, nombre y descripcion corta.
- No hay campos de informacion; es un paso de decision.

Problemas detectados:

- 🟡 Importante: "Cuentas por pagar" y "Cuentas por cobrar" suenan a modulo, no a accion. Para una transaccion, el usuario probablemente piensa "Registrar cuenta por pagar" o "Registrar cuenta por cobrar".
- 🟡 Importante: las seis opciones tienen el mismo peso visual, aunque Ingreso/Egreso/Transferencia suelen ser mas frecuentes.
- 🟢 Menor: las descripciones ayudan, pero ocupan espacio y hacen que las tarjetas parezcan mas complejas de lo necesario.

Propuesta de rediseno:

- Mantener selector previo, porque reduce la complejidad del formulario posterior.
- Orden recomendado:
  1. Ingreso
  2. Egreso
  3. Transferencia
  4. Compra de activo
  5. Registrar cuenta por cobrar
  6. Registrar cuenta por pagar
- Layout: 1 columna en mobile, 2 columnas en desktop; evitar 3 columnas para que la decision se lea en filas.
- Destacar las tres acciones principales con descripcion corta; las tres especializadas con una linea secundaria mas discreta.
- Tamano modal: 560px.

Referencia visual:

- Linear command menu / issue type picker.

Impacto estimado:

- Friccion actual media; mejora esperada media.

### 1.2 Ingreso

Descripcion actual:

- Modal de formulario con ancho aproximado 680px.
- Campos visibles principales:
  - Monto y moneda.
  - Tipo de cambio condicional si moneda es USD.
  - Equivalencia visible cuando aplica.
  - Cuenta destino.
  - Categoria.
  - Descripcion.
  - Fecha.
  - Remitente opcional.
  - Notas.
  - Recurrencia.
  - Comprobante.
- Layout mixto: monto/moneda en grid, descripcion/fecha en grid, resto una columna.
- Labels estaticos uppercase, asterisco para obligatorios.
- Placeholder parcial: monto `0.00`, tipo de cambio `3.750`.
- Botones del formulario viven dentro del contenido, no en footer nativo del modal.

Problemas detectados:

- 🔴 Critico: campos opcionales como remitente, notas, recurrencia y comprobante compiten con los campos minimos para registrar el ingreso.
- 🟡 Importante: el orden pone monto primero, pero en ingreso financiero suele ser mas natural: cuenta destino, monto, categoria, descripcion, fecha.
- 🟡 Importante: el tipo de cambio aparece/desaparece y empuja contenido; puede causar salto visual.
- 🟡 Importante: no queda claro que remitente es opcional desde el label.
- 🟢 Menor: descripcion requerida podria usar ejemplo real mas orientado.

Propuesta de rediseno:

- Layout optimo revisado: 2 zonas en desktop dentro de modal 920px; 1 columna solo en mobile/tablet angosto.
- Justificacion: Ingreso tiene pocos campos esenciales, pero apilarlos genera scroll artificial. Dos zonas permiten ver cuenta, categoria, monto, descripcion y fecha sin desplazamiento.
- Distribucion desktop:
  - Zona izquierda `Contexto`: Cuenta destino, Categoria.
  - Zona derecha `Registro`: Monto/Moneda, Tipo de cambio si aplica, Equivalencia compacta, Fecha, Descripcion.
  - Fila inferior full-width: `Mas opciones` cerrado por defecto.
- Orden recomendado:
  1. Cuenta destino
  2. Categoria
  3. Monto y moneda
  4. Tipo de cambio si aplica
  5. Equivalencia compacta
  6. Fecha
  7. Descripcion
  8. Mas opciones: Remitente Opcional, Notas Opcional, Recurrencia Opcional, Comprobante Opcional
- Placeholder:
  - Descripcion: `Ej: Pago de cliente ACME`
  - Remitente: `Ej: ACME SAC`
  - Notas: `Ej: Factura F001-238`
- Modal: 920px desktop, 640px max en tablet angosto, 96vw mobile.
- Botones: `Cancelar` izquierda; `Registrar ingreso` derecha en footer.

Referencia visual:

- Mercury transfer form para cuenta/monto/descripcion.
- Stripe Payment form para validacion de monto y moneda.

Impacto estimado:

- Friccion actual media; mejora esperada alta.

### 1.3 Egreso

Descripcion actual:

- Campos visibles principales:
  - Monto y moneda.
  - Tipo de cambio condicional.
  - Metodo de pago: Debito/Credito.
  - Si credito: seleccion de tarjeta de credito y enlace para crear credito.
  - Cuenta origen.
  - Categoria.
  - Descripcion.
  - Fecha.
  - Destinatario opcional.
  - Presupuesto opcional.
  - Notas.
  - Recurrencia.
  - Comprobante.
- Layout similar a Ingreso, con bloques condicionales para credito y presupuesto.

Problemas detectados:

- 🔴 Critico: el cambio Debito/Credito altera campos clave sin una transicion estructural clara; puede generar confusion sobre de donde saldra el dinero.
- 🔴 Critico: presupuesto, destinatario, notas, recurrencia y comprobante estan demasiado cerca del flujo primario.
- 🟡 Importante: el usuario deberia decidir primero metodo de pago y cuenta/tarjeta, antes del monto.
- 🟡 Importante: el enlace para crear credito dentro del formulario puede sacar al usuario del flujo principal.
- 🟢 Menor: el label `Destinatario` no explica si es comercio, persona o proveedor.

Propuesta de rediseno:

- Layout optimo revisado: 2 zonas en desktop dentro de modal 920px; 1 columna en mobile.
- Justificacion: Egreso es el caso mas frecuente y con mas condicionales. Si todo baja en una columna, metodo de pago, cuenta, monto y descripcion no entran juntos. La grilla permite decidir forma de pago y registrar importe sin perder el footer.
- Distribucion desktop:
  - Zona izquierda `Pago`: Metodo de pago, Cuenta origen o Tarjeta de credito, Categoria.
  - Zona derecha `Detalle`: Monto/Moneda, Tipo de cambio si aplica, Equivalencia compacta, Fecha, Descripcion.
  - Fila inferior full-width: `Mas opciones` cerrado por defecto con Destinatario, Presupuesto, Notas, Recurrencia y Comprobante.
- Orden recomendado:
  1. Metodo de pago
  2. Cuenta origen o tarjeta de credito
  3. Categoria
  4. Monto y moneda
  5. Tipo de cambio si aplica
  6. Equivalencia compacta
  7. Fecha
  8. Descripcion
  9. Mas opciones: Destinatario Opcional, Presupuesto Opcional, Notas Opcional, Recurrencia Opcional, Comprobante Opcional
- Si elige Credito:
  - Reemplazar `Cuenta origen` por `Tarjeta de credito`.
  - Mantener el area del campo con altura reservada para evitar salto fuerte.
  - Boton secundario pequeno: `Nueva tarjeta`.
- Placeholder:
  - Descripcion: `Ej: Alquiler enero`
  - Destinatario: `Ej: Inmobiliaria Norte`
- Modal: 920px desktop.
- Footer fijo: `Cancelar` izquierda; `Registrar egreso` derecha.

Referencia visual:

- Brex expense form para metodo de pago, categoria y comprobante.
- Mercury transfer form para origen/destino financiero.

Impacto estimado:

- Friccion actual alta; mejora esperada alta.

### 1.4 Transferencia

Descripcion actual:

- Campos visibles:
  - Monto y moneda.
  - Tipo de cambio condicional.
  - Cuenta origen.
  - Cuenta destino.
  - Descripcion autogenerada o editable segun logica.
  - Fecha.
  - Notas.
  - Comprobante.
- Layout una columna para cuentas, grid para descripcion/fecha.
- Categoria no aplica.
- Transferencia usa el mismo shell que otros tipos.

Problemas detectados:

- 🔴 Critico: origen/destino no son visualmente el centro del formulario, aunque definen la operacion.
- 🟡 Importante: monto aparece antes de seleccionar cuentas, pero el contexto de moneda y disponibilidad depende de las cuentas.
- 🟡 Importante: la descripcion autogenerada puede parecer campo requerido sin explicar su rol.
- 🟢 Menor: falta una confirmacion visual compacta `Origen -> Destino`.

Propuesta de rediseno:

- Layout optimo revisado: 2 zonas en desktop dentro de modal 920px, con composicion origen/destino como bloque principal.
- Justificacion: Transferencia tiene pocos campos, pero su tarea central es comparar origen y destino. Una columna hace que las cuentas parezcan pasos independientes; dos zonas muestran relacion, monto y fecha en una sola lectura.
- Distribucion desktop:
  - Zona izquierda `Ruta`: Cuenta origen, Cuenta destino, Resumen `origen -> destino` con moneda y saldo.
  - Zona derecha `Movimiento`: Monto/Moneda, Tipo de cambio si aplica, Equivalencia compacta, Fecha, Descripcion Opcional.
  - Fila inferior full-width: `Mas opciones` cerrado por defecto con Notas y Comprobante.
- Orden recomendado:
  1. Cuenta origen
  2. Cuenta destino
  3. Resumen de transferencia
  4. Monto y moneda
  5. Tipo de cambio si aplica
  6. Equivalencia compacta
  7. Fecha
  8. Descripcion Opcional, con valor sugerido visible
  9. Mas opciones: Notas Opcional, Comprobante Opcional
- Agregar mini-resumen no-card: `Cuenta A -> Cuenta B`, saldo disponible y moneda cuando existan datos.
- Placeholder:
  - Descripcion: `Ej: Transferencia a cuenta de ahorros`
- Modal: 920px desktop. En este caso no debe haber scroll con opciones cerradas.

Referencia visual:

- Mercury transfer form.

Impacto estimado:

- Friccion actual media; mejora esperada alta.

### 1.5 Compra de Activo

Descripcion actual:

- Campos visibles:
  - Monto y moneda.
  - Tipo de cambio condicional.
  - Cuenta origen.
  - Datos del activo: nombre, tipo, valor mostrado.
  - Descripcion.
  - Fecha.
  - Destinatario opcional.
  - Notas.
  - Comprobante.
- Layout mezcla campos de transaccion y campos de activo.

Problemas detectados:

- 🔴 Critico: se mezclan dos modelos mentales: pagar una compra y crear un activo.
- 🟡 Importante: `Valor del activo` derivado del monto aparece como dato, pero puede sentirse editable o redundante.
- 🟡 Importante: tipo de activo y nombre del activo deberian estar antes de descripcion contable.
- 🟢 Menor: destinatario deberia llamarse proveedor o vendedor para este caso.

Propuesta de rediseno:

- Layout optimo revisado: 2 secciones paralelas en desktop dentro de modal 960px.
- Justificacion: Compra de activo combina dos tareas reales: crear el activo y registrar el pago. En una columna se percibe como formulario largo; en dos zonas se completa sin scroll y se entiende la relacion entre valor del activo y monto pagado.
- Distribucion desktop:
  - Zona izquierda `Activo`: Nombre del activo, Tipo de activo, Valor del activo derivado del monto.
  - Zona derecha `Pago`: Cuenta origen, Monto/Moneda, Tipo de cambio si aplica, Equivalencia compacta, Fecha, Descripcion.
  - Fila inferior full-width: `Mas opciones` cerrado por defecto con Proveedor, Notas y Comprobante.
- Seccion `Activo`:
  1. Nombre del activo
  2. Tipo de activo
  3. Valor del activo derivado
- Seccion `Pago`:
  4. Cuenta origen
  5. Valor de compra y moneda
  6. Tipo de cambio si aplica
  7. Equivalencia compacta
  8. Fecha
  9. Descripcion
- Mas opciones:
  - Proveedor Opcional
  - Notas Opcional
  - Comprobante Opcional
- Placeholder:
  - Nombre: `Ej: MacBook Pro 14`
  - Descripcion: `Ej: Compra de equipo para operaciones`
  - Proveedor: `Ej: iShop Peru`
- Modal: 960px desktop, porque hay dos entidades semanticas en el mismo registro.

Referencia visual:

- Brex expense form para compra + comprobante.
- Stripe product/price creation para separar entidad y valor.

Impacto estimado:

- Friccion actual alta; mejora esperada alta.

### 1.6 Cuenta por Cobrar

Descripcion actual:

- Dentro de Nueva Transaccion, el flujo usa campos transaccionales y modulo:
  - Monto y moneda.
  - Cuenta/portafolio.
  - Deudor requerido.
  - Descripcion.
  - Fecha.
  - Posible fecha de vencimiento en secciones heredadas.
  - Notas, recurrencia, comprobante.
- Existen tambien formularios dedicados de cuentas por cobrar en `ReceivablesManager`.

Problemas detectados:

- 🔴 Critico: hay dos maneras de crear una cuenta por cobrar: desde transacciones y desde el modulo de cuentas por cobrar. Si sus campos no coinciden, el usuario aprende dos productos.
- 🔴 Critico: fecha de emision, fecha de vencimiento y deudor deben estar claramente juntos; hoy el flujo transaccional prioriza monto/cuenta.
- 🟡 Importante: `Cuenta por cobrar` no deberia sentirse como ingreso ya cobrado.
- 🟡 Importante: recurrencia y comprobante no deben competir con deudor/vencimiento.

Propuesta de rediseno:

- Reusar un unico componente conceptual `ReceivableFormCore`.
- Layout optimo revisado: 2 zonas en desktop dentro de modal 960px; no debe heredar el layout vertical actual de `TransactionForm`.
- Justificacion: cuenta por cobrar es una obligacion pendiente, no un egreso comun. Deudor, vencimiento e importe deben verse juntos sin quedar debajo de notas/recurrente/comprobante.
- Distribucion desktop:
  - Zona izquierda `Cobro`: Deudor, Cuenta/portafolio asociado, Fecha de emision, Fecha de vencimiento.
  - Zona derecha `Importe`: Monto/Moneda, Tipo de cambio si aplica, Equivalencia compacta, Descripcion.
  - Fila inferior full-width: `Mas opciones` cerrado por defecto con Notas, Recurrencia y Comprobante.
- Orden recomendado:
  1. Deudor
  2. Cuenta/portafolio asociado
  3. Fecha de emision
  4. Fecha de vencimiento Opcional, pero visible en flujo principal por importancia financiera
  5. Monto y moneda
  6. Tipo de cambio si aplica
  7. Equivalencia compacta
  8. Descripcion
  9. Mas opciones: Notas Opcional, Recurrencia Opcional, Comprobante Opcional
- Placeholder:
  - Descripcion: `Ej: Factura F001-184 pendiente`
  - Deudor: `Ej: Cliente Rivera`
- Modal: 960px desktop.

Referencia visual:

- Stripe invoice creation.
- Linear issue form para metadata esencial agrupada.

Impacto estimado:

- Friccion actual alta; mejora esperada alta.

### 1.7 Cuenta por Pagar

Descripcion actual:

- Dentro de Nueva Transaccion, el flujo usa:
  - Monto y moneda.
  - Cuenta/portafolio.
  - Acreedor requerido.
  - Descripcion.
  - Fecha.
  - Posible vencimiento.
  - Notas, recurrencia, comprobante.
- Existe tambien formulario dedicado en `PayablesManager`.

Problemas detectados:

- 🔴 Critico: igual que cuentas por cobrar, hay duplicacion de patrones entre transacciones y modulo dedicado.
- 🔴 Critico: vencimiento deberia estar en el flujo principal; es lo que convierte un registro en obligacion gestionable.
- 🟡 Importante: el campo cuenta puede ser ambiguo: cuenta que pagara luego vs cuenta donde se registra la obligacion.
- 🟢 Menor: el label acreedor deberia usar el mismo lenguaje en todo el producto.

Propuesta de rediseno:

- Reusar `PayableFormCore`.
- Layout optimo revisado: 2 zonas en desktop dentro de modal 960px; acreedor y vencimiento deben estar en el primer bloque visual.
- Justificacion: cuenta por pagar se usa para controlar riesgo operativo. Si el acreedor aparece debajo de campos opcionales, el formulario invita a registrar la obligacion sin su dato mas importante.
- Distribucion desktop:
  - Zona izquierda `Obligacion`: Acreedor, Cuenta/portafolio asociado, Fecha de emision, Fecha de vencimiento.
  - Zona derecha `Importe`: Monto/Moneda, Tipo de cambio si aplica, Equivalencia compacta, Descripcion.
  - Fila inferior full-width: `Mas opciones` cerrado por defecto con Notas, Recurrencia y Comprobante.
- Orden recomendado:
  1. Acreedor
  2. Cuenta/portafolio asociado
  3. Fecha de emision
  4. Fecha de vencimiento
  5. Monto y moneda
  6. Tipo de cambio si aplica
  7. Equivalencia compacta
  8. Descripcion
  9. Mas opciones: Notas Opcional, Recurrencia Opcional, Comprobante Opcional
- Placeholder:
  - Descripcion: `Ej: Servicio de internet mayo`
  - Acreedor: `Ej: Claro Empresas`
- Modal: 960px desktop.

Referencia visual:

- Brex bill pay form.
- Stripe invoice/payment schedule.

Impacto estimado:

- Friccion actual alta; mejora esperada alta.

---

## 2. Modal de Nuevo Portafolio / Editar Portafolio

Fuente principal: `components/management/PortfolioManager.tsx`.

Descripcion actual:

- Modal `Nueva cuenta del portafolio` / `Editar cuenta del portafolio`.
- Ancho aproximado 1120px.
- Preview superior con icono, nombre, banco/tipo/moneda y saldo inicial o saldo bloqueado.
- Campos:
  - Nombre.
  - Entidad financiera.
  - Tipo.
  - Moneda.
  - Saldo inicial, deshabilitado en edicion.
  - Color.
  - Icono.
  - Notas.
  - Checkbox `Incluir en patrimonio neto`.
- Layout 2 columnas, con varios campos full-width.
- Acciones al final, alineadas a la derecha: cancelar y crear/guardar.

Problemas detectados:

- 🔴 Critico: el modal es demasiado ancho para el volumen real de campos; parece mas complejo que la tarea.
- 🟡 Importante: personalizacion visual `color/icono` aparece al mismo nivel que datos financieros esenciales.
- 🟡 Importante: saldo inicial deshabilitado en edicion puede parecer error si no se explica por que queda bloqueado.
- 🟡 Importante: preview compite con el formulario; ayuda, pero ocupa demasiado espacio vertical.
- 🟢 Menor: notas e incluir en patrimonio no estan claramente marcados como opciones.

Propuesta de rediseno:

- Layout optimo revisado P4: ventana de trabajo de 1040px en desktop, con 2 columnas reales y footer fuera del scroll.
- Objetivo sin scroll: en desktop >= 1280x720, crear/editar portafolio debe entrar completo con la seccion `Apariencia` cerrada o compacta. Solo debe aparecer scroll si se abre un picker muy largo, hay errores inline multiples o el viewport es mobile.
- Distribucion desktop:
  - Columna izquierda `Datos de la cuenta` (58%): Nombre, Tipo, Entidad financiera, Moneda, Saldo inicial o Saldo actual.
  - Columna derecha `Configuracion` (42%): preview compacta, Incluir en patrimonio neto, Notas compactas, Apariencia.
  - Footer nativo: Cancelar izquierda, Crear/Guardar derecha.
- Orden recomendado:
  1. Nombre de la cuenta
  2. Tipo
  3. Entidad financiera
  4. Moneda
  5. Saldo inicial solo en creacion
  6. Incluir en patrimonio neto
  7. Notas Opcional
  8. Apariencia: Color Opcional, Icono Opcional
- En edicion, mostrar `Saldo actual` como texto informativo, no como input disabled.
- Preview reducido a una tarjeta horizontal de 64-72px en la columna derecha; no debe ocupar una franja superior full-width.
- Apariencia debe ser compacta: color como swatches en 2 filas maximo; iconos en grid 6x2 con opcion `Ver mas` si hay mas de 12.
- Placeholder:
  - Nombre: `Ej: Cuenta corriente BCP`
  - Notas: `Ej: Cuenta para gastos operativos`
- Modal: 1040px desktop, `min(96vw,1040px)`; 720px en tablet; 1 columna en mobile.
- Footer: cancelar izquierda, crear/guardar derecha.

Referencia visual:

- Mercury account creation.
- Linear project settings form.

Impacto estimado:

- Friccion actual media; mejora esperada alta.

---

## 3. Modal de Nuevo Credito / Editar Credito

Fuentes principales:

- `components/credits/CreditsWorkspace.tsx`
- `components/credits/CreditCardForm.tsx`
- `components/credits/BankLoanForm.tsx`

Nota de cobertura:

- Existe modal de nuevo credito con selector de tipo.
- La edicion de credito aparece como `Proximamente disponible`; no hay modal de editar credito implementado.

### 3.1 Selector de tipo de credito

Descripcion actual:

- Modal de ancho aproximado 480px.
- Dos opciones: tarjeta de credito y prestamo bancario.
- Luego se abre formulario especifico con boton para cambiar tipo.

Problemas detectados:

- 🟢 Menor: el selector funciona bien.
- 🟢 Menor: podria explicar mejor la diferencia operativa: tarjeta con ciclos vs prestamo con cronograma.

Propuesta de rediseno:

- Mantener selector.
- Agregar microcopy funcional:
  - Tarjeta: `Limite, consumo actual y ciclos de facturacion`.
  - Prestamo: `Desembolso, cuotas y cronograma de pagos`.
- Modal: 480px.

Referencia visual:

- Stripe product type selector.

Impacto estimado:

- Friccion actual baja; mejora esperada baja.

### 3.2 Nueva Tarjeta de Credito

Descripcion actual:

- Modal ancho aproximado 860px.
- Layout 2 paneles: formulario izquierdo y tabla de ciclos derecha.
- Campos principales:
  - Nombre.
  - Portafolio de tarjeta.
  - Banco automatico.
  - Limite de credito.
  - Monto usado.
- Tabla de ciclos:
  - Mes.
  - Anio.
  - Consumo desde.
  - Consumo hasta.
  - Fecha de pago.
  - Total a pagar.
  - Estado de cuenta.
  - Remover fila.
- Boton agregar ciclo.
- Acciones estan dentro del panel izquierdo, no en footer global.

Problemas detectados:

- 🔴 Critico: la tabla de ciclos editable dentro del modal convierte una creacion de tarjeta en una tarea de administracion pesada.
- 🔴 Critico: acciones quedan desconectadas visualmente de la tabla; un usuario puede editar ciclos a la derecha y no ver el boton guardar.
- 🟡 Importante: `Banco automatico` como input deshabilitado consume espacio sin accion.
- 🟡 Importante: el modal puede requerir scroll horizontal por `min-width` de tabla.
- 🟡 Importante: duplicados de ciclos se validan, pero el riesgo se descubre tarde.
- 🟢 Menor: `Monto usado` deberia aclarar si es consumo actual o deuda actual.

Propuesta de rediseno:

- Separar en dos niveles:
  - Creacion esencial de tarjeta.
  - Configuracion de ciclos como `Mas opciones` o paso posterior.
- Layout optimo: 680px para datos basicos; si se agregan ciclos, 920px maximo con tabla dedicada.
- Orden recomendado:
  1. Portafolio de tarjeta
  2. Nombre de la tarjeta
  3. Limite de credito
  4. Monto usado actual Opcional
  5. Mas opciones: Ciclos de facturacion
- Dentro de ciclos:
  - Mostrar una fila por defecto.
  - Usar columnas compactas solo para fechas/total.
  - Estado de cuenta como accion secundaria por fila.
- Placeholder:
  - Nombre: `Ej: Visa Signature BCP`
  - Limite: `Ej: 12000`
  - Monto usado: `Ej: 850.50`
- Footer fijo: cancelar izquierda, crear tarjeta derecha.

Referencia visual:

- Brex corporate card setup.
- Stripe Billing schedule editor para filas progresivas.

Impacto estimado:

- Friccion actual alta; mejora esperada alta.

### 3.3 Nuevo Prestamo Bancario

Descripcion actual:

- Modal ancho aproximado 860px.
- Layout 2 paneles: datos del prestamo a la izquierda y cronograma editable a la derecha.
- Campos principales:
  - Nombre.
  - Banco.
  - Cuenta destino.
  - Moneda automatico.
  - Fecha de desembolso.
  - Fecha de inicio.
  - Numero de cuotas.
  - Monto principal.
  - Descripcion.
- Tabla de cuotas:
  - Fecha de vencimiento.
  - Principal.
  - Interes.
  - Seguro.
  - Otros cargos.
  - Cuota calculada.
  - Comprobante.
- Acciones en panel izquierdo.

Problemas detectados:

- 🔴 Critico: se muestran demasiados campos editables simultaneamente; es el formulario con mayor sobrecarga cognitiva.
- 🔴 Critico: las acciones no cubren todo el formulario; la tabla de cuotas parece un producto aparte.
- 🔴 Critico: editar cuota por cuota dentro de la creacion aumenta muchisimo la probabilidad de error numerico.
- 🟡 Importante: `Moneda automatico` deberia ser informacion contextual, no input.
- 🟡 Importante: `Numero de cuotas` genera una tabla grande que puede cambiar la altura del modal drasticamente.
- 🟡 Importante: comprobante por cuota no pertenece al flujo de creacion inicial.

Propuesta de rediseno:

- Convertir a flujo progresivo de dos pasos dentro del modal, o una seccion avanzada colapsable:
  - Paso 1: Datos del prestamo.
  - Paso 2 opcional: Revisar/ajustar cronograma.
- Orden recomendado paso 1:
  1. Banco
  2. Cuenta destino
  3. Nombre del prestamo
  4. Monto principal
  5. Numero de cuotas
  6. Fecha de desembolso
  7. Fecha de primera cuota
  8. Descripcion Opcional
- Paso 2:
  - Vista resumen: total principal, total intereses, primera cuota, ultima cuota.
  - Tabla editable solo si el usuario activa `Ajustar cronograma manualmente`.
  - Comprobantes fuera del modal de creacion; se cargan al pagar cuotas.
- Modal: 720px para paso 1; 1080px solo si abre cronograma avanzado.
- Footer:
  - Paso 1: cancelar izquierda, continuar derecha.
  - Paso 2: atras izquierda, crear prestamo derecha.

Referencia visual:

- Stripe Billing schedule setup.
- Mercury loan/transfer style para datos financieros primarios.

Impacto estimado:

- Friccion actual alta; mejora esperada muy alta.

---

## Revision P5+ de ventanas pendientes

Esta revision aplica desde P5 en adelante y reemplaza cualquier recomendacion anterior que use modales angostos para formularios con mas de una familia de campos. La condicion es estricta: las ventanas no deben depender de scroll vertical para completar el registro en desktop. Si una ventana no cabe, la solucion no es agregar scroll; es redistribuir, compactar, colapsar detalles o dividir en pasos/tabs dentro de la misma ventana.

Regla P5+:

- Desktop objetivo: >= 1280x720.
- Ventana maxima: `min(96vw, 1080px)` o `min(96vw, 1120px)` si hay preview/regla/cronograma.
- Altura: `calc(100dvh - 32px)` como limite visual, pero el cuerpo debe estar disenado para no scrollear.
- Header compacto y footer nativo siempre visibles.
- Cuerpo con grid semantico:
  - Columna izquierda: entidad/contexto.
  - Columna derecha: importe/configuracion/estado.
  - Franja inferior compacta: opciones, evidencia o preview.
- Si hay demasiada informacion para una sola vista, usar pasos internos o tabs (`Datos`, `Programacion`, `Opciones`) sin scroll vertical.
- Mobile: no usar modal con scroll; convertir a pantalla/full-screen flow por pasos.

Patron de correccion:

| Before | After | Why |
| --- | --- | --- |
| Modal estrecho con campos apilados | Ventana 920-1120px con 2 o 3 zonas | Aprovecha pantalla y elimina scroll artificial |
| Opciones avanzadas debajo de todo | Franja inferior compacta o tab secundario | Mantiene el registro principal en una pantalla |
| Preview encima del formulario | Preview lateral o resumen horizontal bajo las columnas | Evita gastar altura antes de los campos |
| Formularios largos en una sola vista | Pasos internos sin scroll | La navegacion reemplaza el desplazamiento |
| Footer dentro del flujo | Footer nativo fijo | Las acciones siempre permanecen visibles |

Referencias visuales:

- Stripe Billing / subscription schedule: configuracion compleja por zonas y pasos.
- Mercury transfer/budget patterns: contexto e importe visibles al mismo tiempo.
- Linear settings forms: densidad clara, footer estable y decisiones agrupadas.

## 4. Modal de Nuevo Presupuesto / Editar Presupuesto / Nuevo Periodo

Fuente principal: `components/management/BudgetsManager.tsx`.

Descripcion actual:

- Modal ancho aproximado 1080px.
- Variantes:
  - Nuevo presupuesto.
  - Editar presupuesto.
  - Nuevo periodo continuo.
- En periodo continuo aparece una preview con periodo anterior y siguiente.
- Campos:
  - Nombre.
  - Descripcion.
  - Categoria.
  - Periodo.
  - Monto.
  - Moneda.
  - Fecha inicio.
  - Fecha fin.
  - Notas.
  - Activo.
- Layout 2 columnas.
- Algunas variantes deshabilitan campos.
- Acciones al final alineadas a la derecha.

Problemas detectados:

- 🔴 Critico: el mismo modal hace demasiados trabajos: crear presupuesto, editarlo y crear periodo continuo.
- 🟡 Importante: fecha fin se presenta como input aunque depende del periodo; deberia sentirse calculada.
- 🟡 Importante: en nuevo periodo continuo, muchos campos disabled pueden dar sensacion de formulario roto.
- 🟡 Importante: descripcion y notas aparecen visibles aunque no son necesarias para crear un presupuesto.
- 🟢 Menor: modal demasiado ancho para el contenido.

Propuesta de rediseno:

- Layout optimo revisado P5: ventana de 1040px para crear/editar presupuesto y 920px para nuevo periodo. No debe haber scroll vertical en desktop; si se agregan mas reglas presupuestarias, se usan tabs internos.
- Separar mentalmente:
  - Crear/editar presupuesto base.
  - Crear nuevo periodo.
- Distribucion desktop para crear/editar:
  - Columna izquierda `Presupuesto`: Nombre, Categoria, Periodo, Estado activo.
  - Columna derecha `Monto y fechas`: Monto/Moneda, Fecha inicio, Fecha fin calculada como lectura, preview compacta del periodo.
  - Franja inferior `Opciones`: Descripcion Opcional y Notas Opcional en dos columnas compactas, no como bloque vertical.
- Distribucion desktop para nuevo periodo:
  - Columna izquierda `Periodo anterior`: resumen readonly de monto, fechas y consumo si existe.
  - Columna derecha `Nuevo periodo`: periodo calculado, monto editable, fecha inicio si aplica.
  - Franja inferior: Notas Opcional compactas.
- Nuevo presupuesto:
  1. Nombre
  2. Categoria
  3. Monto y moneda
  4. Periodo
  5. Fecha de inicio
  6. Fecha fin calculada como texto informativo
  7. Mas opciones: Descripcion Opcional, Notas Opcional, Estado activo
- Nuevo periodo:
  1. Resumen del presupuesto actual
  2. Periodo siguiente calculado
  3. Monto editable
  4. Fecha inicio editable solo si se permite excepcion
  5. Notas Opcional
- Placeholder:
  - Nombre: `Ej: Marketing mensual`
  - Descripcion: `Ej: Presupuesto para pauta y herramientas`
- Modal: 1040px crear/editar; 920px nuevo periodo; 1 columna solo en mobile full-screen por pasos.
- Condicion estricta: no scroll vertical. Si se abre una configuracion avanzada futura, debe entrar como tab `Opciones`, no debajo del formulario.

Referencia visual:

- Linear cycle/project form.
- Brex budget controls.

Impacto estimado:

- Friccion actual media; mejora esperada alta.

---

## 5. Modal de Nuevo Activo / Editar Activo

Fuentes principales:

- `components/assets/AssetsWorkspace.tsx`
- `components/assets/AssetsForm.tsx`

Nota de cobertura:

- Existe modal de nuevo activo.
- La edicion de activo aparece como `Proximamente disponible`; no hay modal de editar activo implementado.

Descripcion actual:

- Modal ancho aproximado 600px.
- Campos:
  - Nombre.
  - Portafolio.
  - Moneda automatica.
  - Tipo de activo.
  - Fecha.
  - Monto.
  - Equivalencia.
  - Descripcion.
  - Destinatario.
  - Notas.
  - Comprobante.
- Layout 2 columnas en pantallas medianas.
- Acciones al fondo: guardar y cancelar, con primaria antes que secundaria.

Problemas detectados:

- 🔴 Critico: acciones aparecen en orden contrario al patron recomendado; primaria queda a la izquierda.
- 🟡 Importante: nombre del activo aparece antes de contexto financiero; para registro de compra, portafolio/monto/tipo importan primero.
- 🟡 Importante: moneda automatica como input disabled ocupa espacio de decision.
- 🟡 Importante: destinatario no es el mejor label para compra de activo; `Proveedor` o `Vendedor` orienta mejor.
- 🟢 Menor: comprobante y notas deberian estar en opciones.

Propuesta de rediseno:

- Layout optimo revisado P5: ventana de 960px en desktop con dos columnas paralelas. Un activo tiene dos familias de informacion: la entidad que se crea y la compra que la origina; apilarlas genera scroll innecesario.
- Objetivo sin scroll: nombre, tipo, portafolio, monto, fecha, descripcion y evidencia compacta deben verse en una pantalla.
- Distribucion desktop:
  - Columna izquierda `Activo`: Nombre, Tipo de activo, preview compacta del activo, Notas Opcional compactas.
  - Columna derecha `Compra`: Portafolio, Monto con moneda contextual, Fecha, Descripcion, Proveedor Opcional.
  - Franja inferior `Comprobante`: upload compacto horizontal, estado de archivo y regla de auto-subida.
- Orden recomendado:
  - Seccion Activo:
    1. Nombre
    2. Tipo de activo
  - Seccion Compra:
    3. Portafolio
    4. Monto y moneda contextual
    5. Fecha
    6. Descripcion
  - Mas opciones:
    7. Proveedor Opcional
    8. Notas Opcional
    9. Comprobante Opcional
- Placeholder:
  - Nombre: `Ej: Laptop operaciones`
  - Descripcion: `Ej: Compra de equipo para soporte`
  - Proveedor: `Ej: Memory Kings`
- Modal: 960px desktop; 1 columna solo en mobile full-screen por pasos.
- Condicion estricta: no scroll vertical. Si el comprobante necesita preview grande, abrirlo en un visor aparte, no dentro del formulario.
- Footer: cancelar izquierda, crear activo derecha.

Referencia visual:

- Brex expense form.
- Stripe product creation.

Impacto estimado:

- Friccion actual media; mejora esperada alta.

---

## 6. Modal de Nuevo Deudor / Nueva Cuenta por Cobrar

Fuentes principales:

- `components/receivables/ReceivablesManager.tsx`
- `components/receivables/DebtorForm.tsx`
- `components/receivables/ReceivableForm.tsx`
- `components/receivables/DebtorDetail.tsx`

### 6.1 Nuevo Deudor / Editar Deudor

Descripcion actual:

- Modal ancho aproximado 520px.
- Campos:
  - Nombre del deudor.
  - Deuda inicial.
  - Relacion.
- Una columna.
- Error global.
- Acciones alineadas a la derecha: cancelar y crear/actualizar.

Problemas detectados:

- 🟡 Importante: `Deuda inicial` puede confundirse con crear una cuenta por cobrar concreta.
- 🟡 Importante: relacion no esta marcada como opcional.
- 🟢 Menor: faltan ejemplos de placeholder.

Propuesta de rediseno:

- Layout optimo: 1 columna.
- Orden recomendado:
  1. Nombre del deudor
  2. Relacion Opcional
  3. Saldo inicial Opcional
- Microcopy bajo saldo inicial: `Usalo solo si ya existe una deuda previa sin documento asociado`.
- Placeholder:
  - Nombre: `Ej: Cliente Rivera`
  - Relacion: `Ej: Cliente frecuente`
  - Saldo inicial: `Ej: 1500`
- Modal: 480px.

Referencia visual:

- Linear lightweight entity form.

Impacto estimado:

- Friccion actual media; mejora esperada media.

### 6.2 Nueva Cuenta por Cobrar / Editar Cuenta por Cobrar

Descripcion actual:

- Modal ancho aproximado 760px.
- Campos:
  - Portafolio/cuenta, solo en creacion.
  - Fecha de emision.
  - Deudor.
  - Descripcion.
  - Moneda readonly.
  - Monto.
  - Equivalencia.
  - Notas.
  - Comprobante.
  - Guardar como recurrente.
  - Nombre de recurrencia condicional.
- Layout 2 columnas.
- Acciones al fondo.

Problemas detectados:

- 🔴 Critico: no se ve fecha de vencimiento en el formulario dedicado, aunque es central para gestionar cobros. El flujo transaccional si contempla vencimiento en algunas secciones, lo que crea inconsistencia.
- 🔴 Critico: `Guardar como recurrente` muestra un campo condicional que puede agregar complejidad antes de registrar la cuenta.
- 🟡 Importante: moneda readonly como input deshabilitado ocupa espacio de decision.
- 🟡 Importante: portafolio desaparece en edicion; debe mostrarse como dato contextual no editable.
- 🟡 Importante: acciones y validacion no estan en un footer sistematico.

Propuesta de rediseno:

- Layout optimo: 1 columna con grid de 2 columnas solo para fechas y monto/moneda.
- Orden recomendado:
  1. Deudor
  2. Portafolio asociado
  3. Monto y moneda contextual
  4. Fecha de emision
  5. Fecha de vencimiento Opcional, pero visible por importancia operativa
  6. Descripcion
  7. Mas opciones: Notas Opcional, Comprobante Opcional, Recurrencia Opcional
- Si activa recurrencia:
  - Mostrar `Nombre de recurrencia` como obligatorio dentro de la seccion expandida.
- Placeholder:
  - Descripcion: `Ej: Factura F001-184`
  - Nombre recurrencia: `Ej: Cobro mensual soporte`
- Modal: 720px.

Referencia visual:

- Stripe invoice form.
- Mercury request/payment form.

Impacto estimado:

- Friccion actual alta; mejora esperada alta.

---

## 7. Modal de Nuevo Acreedor / Nueva Cuenta por Pagar

Fuentes principales:

- `components/payables/PayablesWorkspace.tsx`
- `components/payables/CreditorForm.tsx`
- `components/payables/PayableForm.tsx`
- `components/payables/CreditorDetail.tsx`

### 7.1 Nuevo Acreedor / Editar Acreedor

Descripcion actual:

- Modal ancho aproximado 520px.
- Campos:
  - Nombre del acreedor.
  - Deuda inicial.
  - Relacion.
- Una columna.
- Error global.
- Acciones alineadas a la derecha.

Problemas detectados:

- 🟡 Importante: `Deuda inicial` puede confundirse con una cuenta por pagar formal.
- 🟡 Importante: relacion no esta marcada como opcional.
- 🟢 Menor: falta ejemplo de placeholder.

Propuesta de rediseno:

- Orden recomendado:
  1. Nombre del acreedor
  2. Relacion Opcional
  3. Saldo inicial Opcional
- Microcopy bajo saldo inicial: `Para deudas previas sin comprobante registrado`.
- Placeholder:
  - Nombre: `Ej: Proveedor Lima SAC`
  - Relacion: `Ej: Proveedor de internet`
- Modal: 480px.

Referencia visual:

- Linear lightweight entity form.

Impacto estimado:

- Friccion actual media; mejora esperada media.

### 7.2 Nueva Cuenta por Pagar / Editar Cuenta por Pagar

Descripcion actual:

- Modal ancho aproximado 760px.
- Campos:
  - Portafolio/cuenta, solo en creacion.
  - Fecha de emision.
  - Fecha de vencimiento.
  - Acreedor.
  - Descripcion.
  - Moneda readonly.
  - Monto.
  - Equivalencia.
  - Notas.
  - Comprobante.
  - Guardar como recurrente.
  - Nombre de recurrencia condicional.
- Layout 2 columnas.

Problemas detectados:

- 🔴 Critico: recurrencia aparece como decision secundaria pero introduce campo condicional relevante; deberia estar aislada.
- 🟡 Importante: cuenta/portafolio se oculta en edicion en lugar de mostrarse como contexto.
- 🟡 Importante: moneda readonly debe ser metadata, no campo.
- 🟡 Importante: vencimiento es esencial y deberia estar agrupado con fecha de emision.
- 🟢 Menor: labels opcionales no son consistentes.

Propuesta de rediseno:

- Layout optimo: 1 columna con pares en 2 columnas.
- Orden recomendado:
  1. Acreedor
  2. Portafolio asociado
  3. Monto y moneda contextual
  4. Fecha de emision
  5. Fecha de vencimiento
  6. Descripcion
  7. Mas opciones: Notas Opcional, Comprobante Opcional, Recurrencia Opcional
- Placeholder:
  - Descripcion: `Ej: Factura de internet mayo`
  - Nombre recurrencia: `Ej: Internet mensual oficina`
- Modal: 720px.

Referencia visual:

- Brex bill pay.
- Stripe invoice payment schedule.

Impacto estimado:

- Friccion actual alta; mejora esperada alta.

---

## 8. Modal de Nueva Recurrencia / Editar Recurrencia

Fuentes principales:

- `components/recurring/RecurringWorkspace.tsx`
- `components/recurring/RecurringForm.tsx`

Nota de cobertura:

- No existe modal standalone para nueva recurrencia.
- La creacion de recurrencias sucede desde transacciones, cuentas por cobrar o cuentas por pagar.
- Existe modal de editar recurrencia.

Descripcion actual:

- Modal `Editar plantilla recurrente`, ancho aproximado 560px.
- Summary card superior con tipo, estado, monto, cuenta y categoria.
- Campos editables:
  - Nombre operativo.
  - Descripcion.
  - Notas.
- Error global.
- Acciones cancelar y guardar alineadas a la derecha.

Problemas detectados:

- 🔴 Critico: ausencia de `Nueva recurrencia` standalone limita a usuarios que quieren programar algo sin registrar primero una transaccion/base.
- 🟡 Importante: editar solo metadata puede ser correcto, pero el formulario no explica que monto, cuenta y categoria son de solo lectura por diseno.
- 🟡 Importante: descripcion y notas no estan marcadas como opcionales.
- 🟢 Menor: summary card funciona, pero puede integrarse mejor como contexto fijo.

Propuesta de rediseno:

- Layout optimo revisado P5:
  - Editar recurrencia: ventana de 860px con dos columnas.
  - Nueva recurrencia standalone: ventana de 1080px con 3 zonas o 2 pasos internos, sin scroll.
- Objetivo sin scroll: contexto, frecuencia, proxima fecha, importe y metadata deben ser visibles sin desplazamiento. Si el tipo de recurrencia cambia y agrega campos de contraparte, se muestra en una zona reservada, no debajo.
- Distribucion desktop para editar:
  - Columna izquierda `Contexto readonly`: tipo, monto, cuenta, categoria, estado.
  - Columna derecha `Edicion`: Nombre, Descripcion Opcional, Notas Opcional, Estado si aplica.
  - Footer nativo: Cancelar izquierda, Guardar recurrencia derecha.
- Distribucion desktop para nueva recurrencia:
  - Zona 1 `Tipo y cuenta`: tipo, cuenta, categoria/contraparte condicional.
  - Zona 2 `Importe`: monto, moneda, equivalencia si aplica, descripcion.
  - Zona 3 `Programacion`: frecuencia, proxima fecha, fin opcional, estado inicial.
  - Franja inferior compacta: Notas Opcional, Comprobante modelo Opcional.
- Editar recurrencia:
  1. Contexto compacto readonly: tipo, monto, cuenta, categoria.
  2. Nombre
  3. Descripcion Opcional
  4. Notas Opcional
  5. Estado si el negocio permite activar/pausar desde aqui
- Nueva recurrencia standalone futura:
  1. Tipo: ingreso, egreso, cuenta por cobrar, cuenta por pagar
  2. Cuenta
  3. Monto y moneda
  4. Frecuencia
  5. Proxima fecha
  6. Descripcion
  7. Mas opciones: categoria, contraparte, notas, comprobante modelo
- Modal: 860px edicion, 1080px nueva recurrencia.
- Condicion estricta: no scroll vertical. Si la recurrencia futura requiere cronograma o muchas excepciones, moverlo a tab `Excepciones`, no a contenido apilado.

Referencia visual:

- Stripe subscription schedule.
- Linear recurring issue pattern.

Impacto estimado:

- Friccion actual media; mejora esperada media-alta si se crea flujo standalone.

---

## 9. Modal de Nueva Alerta

Fuente principal: `components/alerts/AlertsWorkspace.tsx`.

Nota de cobertura:

- No se encontro modal de `Nueva alerta`.
- El modulo actual funciona como inbox de alertas generadas: actualizar, filtrar, marcar como leida, eliminar.

Descripcion actual:

- No hay formulario de usuario para crear alertas.
- Hay acciones de gestion de inbox y filtros de lectura/severidad.

Problemas detectados:

- 🔴 Critico: si el producto promete alertas configurables, falta el flujo completo de creacion.
- 🟡 Importante: no existe punto de entrada para definir umbrales, cuentas, categorias o frecuencia.
- 🟢 Menor: el inbox actual es claro para consumo, no para configuracion.

Propuesta de rediseno:

- Crear ventana `Nueva alerta`, 980px desktop, sin scroll vertical.
- Layout optimo revisado P6: dos columnas con constructor de regla a la izquierda y entrega/preview a la derecha.
- Objetivo sin scroll: tipo, objeto, condicion, umbral, frecuencia, canal y nombre deben entrar completos. Si se agregan canales o condiciones avanzadas, se muestran como tabs internos.
- Distribucion desktop:
  - Columna izquierda `Regla`: Tipo de alerta, Objeto monitoreado, Condicion, Valor/umbral.
  - Columna derecha `Entrega`: Frecuencia de evaluacion, Canal de notificacion, Nombre Opcional, preview de frase humana.
  - Footer nativo: Cancelar izquierda, Crear alerta derecha.
- Orden recomendado:
  1. Tipo de alerta: saldo bajo, presupuesto excedido, pago por vencer, cobro por vencer, movimiento inusual
  2. Objeto monitoreado: cuenta, presupuesto, credito, acreedor/deudor
  3. Condicion: `menor que`, `mayor que`, `vence en`, `sin movimiento`
  4. Valor/umbral
  5. Frecuencia de evaluacion
  6. Canal de notificacion
  7. Nombre Opcional
- Placeholder:
  - Nombre: `Ej: Saldo bajo en cuenta operativa`
  - Umbral: `Ej: 1000`
- Usar preview lateral: `Avisar cuando Cuenta operativa sea menor a S/ 1000`.
- Modal: 980px desktop; mobile full-screen por pasos `Regla` y `Entrega`.
- Condicion estricta: no scroll vertical. Las condiciones avanzadas deben entrar en tab `Avanzado`, no bajo el formulario.

Referencia visual:

- Linear notification settings.
- Stripe radar/rules style for condition builder.

Impacto estimado:

- Friccion actual alta si se espera creacion de alertas; mejora esperada alta.

---

## 10. Managers de Administracion

Fuentes principales:

- `components/management/BankEntitiesManager.tsx`
- `components/management/CurrenciesManager.tsx`
- `components/management/CategoriesManager.tsx`
- `components/management/AssetTypesManager.tsx`

### Revision P4 de ventanas administrativas

La propuesta anterior reducia varias ventanas administrativas a 440-520px. Eso elimina ancho, pero no necesariamente elimina scroll: cuando existen pickers de color, icono, icono personalizado, notas o mensajes de validacion, el contenido se apila y obliga a bajar. Para P4, la regla debe cambiar: no hacer ventanas pequenas por defecto, sino ventanas de trabajo que usen el ancho disponible con grupos paralelos.

Objetivo P4:

- Sin scroll en desktop >= 1280x720 para el estado normal del formulario.
- Header y footer fuera del area scrolleable.
- Cuerpo distribuido en dos zonas cuando haya datos + apariencia/configuracion.
- Una columna solo para mobile o ventanas con menos de cuatro decisiones reales.
- Pickers visuales compactos: mostrar 8-12 opciones iniciales y usar `Ver mas` o seccion expandible para el resto.
- Notas, icono personalizado y configuracion secundaria no deben empujar los campos principales hacia abajo.

Patron recomendado:

| Before | After | Why |
| --- | --- | --- |
| Ventana pequena con campos apilados | Ventana 760-1040px con dos zonas semanticas | Aprovecha pantalla y evita scroll artificial |
| Color/icono debajo de datos esenciales | Apariencia en columna derecha o panel compacto | Mantiene la tarea principal visible |
| Preview superior full-width | Preview lateral compacta | Reduce altura consumida antes del formulario |
| Acciones dentro del contenido | Footer nativo fijo de `RecordModal` | El usuario siempre ve cancelar/guardar |
| Pickers completos siempre visibles | 8-12 opciones + `Ver mas` | Mantiene densidad sin ocultar capacidad avanzada |

Referencias visuales:

- Linear settings/entity forms: formularios densos, dos zonas, acciones siempre disponibles.
- Mercury account setup: datos financieros a la izquierda, configuracion/contexto a la derecha.
- Stripe dashboard create forms: contenido administrativo compacto con preview lateral y footer estable.

### 10.1 Bancos

Descripcion actual:

- Modal ancho aproximado 1040px.
- Campos:
  - Nombre del banco.
  - Nombre corto.
  - Pais.
  - Color.
  - Icono.
  - Icono personalizado por archivo.
- Layout ancho con campos y personalizacion visual.
- Acciones al final con primaria antes de cancelar.

Problemas detectados:

- 🔴 Critico: acciones en orden inverso al patron de seguridad; crear/guardar queda antes que cancelar.
- 🟡 Importante: modal demasiado ancho para una entidad administrativa.
- 🟡 Importante: color, icono y carga personalizada estan al mismo nivel que nombre/pais.
- 🟡 Importante: si el modelo interno usa `code`, el formulario no lo expone de forma clara.
- 🟢 Menor: falta marca `Opcional` en nombre corto e icono personalizado.

Propuesta de rediseno:

- Layout optimo revisado P4: ventana de 960px en desktop con 2 columnas; no usar 520px porque los pickers de apariencia y archivo empujan el formulario hacia abajo.
- Objetivo sin scroll: todos los campos visibles en desktop con apariencia compacta; scroll solo si se abre `Ver mas iconos` o hay errores extensos.
- Distribucion desktop:
  - Columna izquierda `Banco`: Nombre del banco, Nombre corto Opcional, Pais, Codigo Opcional si aplica.
  - Columna derecha `Apariencia`: preview compacta, Color, Icono, Icono personalizado Opcional.
  - Footer nativo: Cancelar izquierda, Guardar banco derecha.
- Orden recomendado:
  1. Nombre del banco
  2. Nombre corto Opcional
  3. Pais
  4. Codigo Opcional, si aplica al modelo
  5. Apariencia: Color Opcional, Icono Opcional, Icono personalizado Opcional
- Color debe ocupar maximo 2 filas de swatches.
- Icono debe mostrar 12 opciones iniciales en grid 6x2; el resto en `Ver mas`.
- Icono personalizado debe ser una fila compacta, no un bloque alto de carga.
- Placeholder:
  - Nombre: `Ej: Banco de Credito del Peru`
  - Nombre corto: `Ej: BCP`
- Modal: 960px desktop, `min(96vw,960px)`; 1 columna bajo 760px.
- Footer estandar.

Referencia visual:

- Mercury institution setup.

Impacto estimado:

- Friccion actual media; mejora esperada media-alta.

### 10.2 Monedas

Descripcion actual:

- Usa `RecordModal` sin ancho especifico, por lo que hereda hasta 1320px.
- Campos:
  - Pais.
  - Codigo.
  - Nombre.
  - Simbolo.
  - Moneda predeterminada.
- Layout 2 columnas.
- Acciones con primaria antes de cancelar.

Problemas detectados:

- 🔴 Critico: modal enorme para cinco campos; comunica complejidad innecesaria.
- 🟡 Importante: no hay catalogo/preset visible para monedas comunes.
- 🟡 Importante: `Moneda predeterminada` puede tener impacto global y necesita microcopy.
- 🟢 Menor: `Simbolo` deberia ser opcional si puede derivarse del codigo.

Propuesta de rediseno:

- Layout optimo revisado P4: ventana de 760px en desktop con 2 zonas. Aunque tiene pocos campos, el uso correcto del espacio permite agregar presets sin generar scroll ni una ventana visualmente pobre.
- Objetivo sin scroll: formulario completo + presets principales visibles en una sola pantalla.
- Distribucion desktop:
  - Columna izquierda `Moneda`: Codigo, Nombre, Simbolo Opcional, Pais Opcional.
  - Columna derecha `Uso`: Moneda predeterminada, microcopy de impacto, presets rapidos `PEN`, `USD`, `EUR`, `MXN`, `COP`, `CLP`.
  - Footer nativo: Cancelar izquierda, Guardar moneda derecha.
- Orden recomendado:
  1. Codigo
  2. Nombre
  3. Simbolo Opcional
  4. Pais Opcional
  5. Moneda predeterminada
- Microcopy: `La moneda predeterminada se usara para reportes y equivalencias.`
- Placeholder:
  - Codigo: `Ej: PEN`
  - Nombre: `Ej: Sol peruano`
  - Simbolo: `Ej: S/`
- Presets visibles como botones compactos en la columna derecha, no como lista vertical.
- Modal: 760px desktop, `min(96vw,760px)`; 1 columna bajo 700px.

Referencia visual:

- Stripe currency selector.

Impacto estimado:

- Friccion actual media; mejora esperada media.

### 10.3 Categorias

Descripcion actual:

- Usa ancho por defecto de `RecordModal`.
- Campos:
  - Nombre.
  - Alcance/tipo.
  - Color.
  - Icono.
  - Icono personalizado.
- Acciones primaria/cancelar a la izquierda.

Problemas detectados:

- 🔴 Critico: ancho por defecto hace que una tarea pequena parezca pesada.
- 🟡 Importante: la personalizacion visual domina el formulario.
- 🟡 Importante: el alcance debe explicar si la categoria aplica a ingresos, egresos o ambos.
- 🟡 Importante: hay inconsistencia con el modal anidado de categoria, que contempla alcance `BOTH`.
- 🟢 Menor: icono personalizado deberia estar oculto hasta abrir apariencia avanzada.

Propuesta de rediseno:

- Layout optimo revisado P4: ventana de 900px en desktop con 2 columnas; 520px genera scroll cuando aparecen iconos, color e icono personalizado.
- Objetivo sin scroll: nombre, uso y apariencia visibles sin desplazamiento en desktop.
- Distribucion desktop:
  - Columna izquierda `Categoria`: Nombre, Uso segmentado, descripcion contextual del alcance.
  - Columna derecha `Apariencia`: preview de etiqueta/categoria, Color, Icono, Icono personalizado Opcional.
  - Footer nativo: Cancelar izquierda, Guardar categoria derecha.
- Orden recomendado:
  1. Nombre
  2. Uso: Ingresos, Egresos, Ambos
  3. Mas opciones: Color Opcional, Icono Opcional, Icono personalizado Opcional
- Color debe ocupar maximo 2 filas.
- Icono debe mostrar 12 opciones iniciales; `Ver mas` abre el resto sin aumentar altura inicial.
- Icono personalizado debe estar en una fila compacta bajo los iconos.
- Placeholder:
  - Nombre: `Ej: Publicidad`
- Usar segmented control para uso, no select si son tres opciones.
- Modal: 900px desktop, `min(96vw,900px)`; 1 columna bajo 760px.

Referencia visual:

- Linear label/category form.

Impacto estimado:

- Friccion actual media; mejora esperada media-alta.

### 10.4 Tipos de Activo

Descripcion actual:

- Usa ancho por defecto de `RecordModal`.
- Campos:
  - Nombre.
  - Icono.
  - Color.
- Acciones primaria/cancelar.

Problemas detectados:

- 🔴 Critico: modal excesivamente grande para tres campos.
- 🟡 Importante: icono/color aparecen como obligatorios visuales aunque son decorativos.
- 🟡 Importante: si existe estado activo/inactivo en el modelo, no queda claro en el formulario.
- 🟢 Menor: falta placeholder.

Propuesta de rediseno:

- Layout optimo revisado P4: ventana de 720px en desktop con 2 zonas compactas. Aunque tiene pocos campos, el picker de icono/color no debe forzar un scroll vertical.
- Objetivo sin scroll: nombre, estado y apariencia visibles en una sola pantalla.
- Distribucion desktop:
  - Columna izquierda `Tipo`: Nombre, Estado activo si aplica.
  - Columna derecha `Apariencia`: preview compacta, Icono, Color.
  - Footer nativo: Cancelar izquierda, Guardar tipo derecha.
- Orden recomendado:
  1. Nombre
  2. Apariencia Opcional: Icono, Color
  3. Estado activo si aplica
- Icono/color deben estar visibles como grids compactos, no como bloques verticales separados.
- Placeholder:
  - Nombre: `Ej: Equipo tecnologico`
- Modal: 720px desktop, `min(96vw,720px)`; 1 columna bajo 680px.
- Footer estandar.

Referencia visual:

- Linear label form.

Impacto estimado:

- Friccion actual baja-media; mejora esperada media.

---

## 11. Formularios de Configuracion y Perfil

Fuentes principales:

- `components/settings/ProfileSettingsForm.tsx`
- `components/settings/PreferencesPanel.tsx`
- `components/settings/NotificationsPanel.tsx`
- `components/settings/SecuritySettingsPanel.tsx`
- `components/settings/primitives.tsx`

### Revision P6 de configuracion y ventanas sensibles

Configuracion y perfil viven hoy como paneles, no siempre como modales. Si alguna de estas experiencias pasa a ventana emergente, la misma condicion aplica: no debe haber scroll vertical dentro de la ventana. Para formularios largos de configuracion, usar layout de dos zonas o tabs internos; para acciones destructivas, usar una ventana compacta y estricta.

Regla P6:

- Perfil/preferencias/notificaciones: si son ventanas, usar 960-1040px con dos columnas.
- Seguridad/cambio de contrasena: 860px con reglas a la derecha, campos a la izquierda.
- Eliminar cuenta: 640px maximo, sin scroll, copy compacto y confirmacion visible.
- Si una configuracion crece, dividir en tabs (`Cuenta`, `Preferencias`, `Notificaciones`, `Seguridad`) en vez de permitir scroll.
- Footer/action row siempre visible.

### 11.1 Perfil

Descripcion actual:

- Formulario en panel, no modal.
- Bloque izquierdo de avatar:
  - Imagen.
  - Subir avatar.
  - Quitar avatar.
  - Presets.
- Bloque derecho:
  - Nombre visible.
  - Email readonly.
  - Moneda base.
  - Metricas de usuario.
  - Texto de criterio visual.
  - Guardar perfil.

Problemas detectados:

- 🟡 Importante: avatar y datos de perfil parecen una sola unidad, pero tienen acciones/persistencia distintas.
- 🟡 Importante: email readonly deberia indicarse como `No editable`.
- 🟡 Importante: boton guardar queda dentro del flujo, no como accion clara de seccion.
- 🟢 Menor: presets de avatar ocupan bastante atencion para una tarea secundaria.

Propuesta de rediseno:

- Layout optimo revisado P6: si Perfil se presenta como ventana, usar 960px en desktop con 2 columnas y sin scroll.
- Distribucion desktop:
  - Columna izquierda `Identidad`: avatar, subir/quitar, presets compactos maximo 8 visibles.
  - Columna derecha `Datos`: nombre visible, email no editable, moneda base, metricas compactas.
  - Footer nativo: Cancelar izquierda, Guardar perfil derecha.
- Presets de avatar deben estar en grid compacto 4x2; si hay mas, usar `Ver mas`.
- Placeholder:
  - Nombre visible: `Ej: Elias Gustavo`
- Label email: `Email No editable`.
- Modal si aplica: 960px desktop; mobile full-screen por pasos `Identidad` y `Datos`.
- Condicion estricta: no scroll vertical. Las metricas deben ser chips compactos, no tarjetas apiladas.

Referencia visual:

- Mercury profile settings.
- Linear account settings.

Impacto estimado:

- Friccion actual media; mejora esperada media.

### 11.2 Preferencias

Descripcion actual:

- Panel de configuracion, no modal.
- Opciones:
  - Tema con tarjetas.
  - Modo privado toggle.
  - Moneda predeterminada.
  - Zona horaria.
  - Guardar preferencias.
- Usa primitives de settings.

Problemas detectados:

- 🟡 Importante: varias opciones parecen persistirse juntas, pero algunas pueden depender de estado local o endpoints distintos.
- 🟡 Importante: zona horaria se muestra como decision importante pero no queda claro su impacto.
- 🟢 Menor: guardar al final puede quedar lejos si el panel crece.

Propuesta de rediseno:

- Layout optimo revisado P6: si Preferencias se presenta como ventana, usar 960px con 2 columnas.
- Distribucion desktop:
  - Columna izquierda `Apariencia y privacidad`: tema, modo privado.
  - Columna derecha `Localizacion financiera`: moneda predeterminada, zona horaria, microcopy de impacto.
  - Footer nativo/action row: Cancelar izquierda, Guardar preferencias derecha.
- Agrupar:
  1. Apariencia: tema.
  2. Privacidad: modo privado.
  3. Finanzas: moneda predeterminada.
  4. Localizacion: zona horaria.
- Validar que todas las opciones del panel se guarden con el mismo patron o mostrar estado independiente por seccion.
- Modal si aplica: 960px desktop.
- Condicion estricta: no scroll vertical. Si aparecen mas preferencias, convertirlas en tabs, no en filas apiladas.

Referencia visual:

- Linear preferences.
- Mercury account preferences.

Impacto estimado:

- Friccion actual media; mejora esperada media.

### 11.3 Notificaciones

Descripcion actual:

- Panel con toggles agrupados:
  - Alertas criticas.
  - Gestion y seguimiento.
- Boton guardar.
- Indicador de cambios/configuracion.

Problemas detectados:

- 🟡 Importante: toggles son claros, pero faltan canales o frecuencia si el producto escala notificaciones.
- 🟡 Importante: boton guardar puede quedar desconectado de los cambios si hay muchas filas.
- 🟢 Menor: falta microcopy sobre que activa cada alerta en terminos financieros.

Propuesta de rediseno:

- Layout optimo revisado P6: si Notificaciones se presenta como ventana, usar 1040px con 2 columnas y grupos paralelos.
- Distribucion desktop:
  - Columna izquierda `Criticas`: saldos, vencimientos, seguridad.
  - Columna derecha `Gestion`: seguimiento, reportes, recordatorios.
  - Franja inferior compacta: canales/frecuencia si existen.
  - Footer nativo/action row: Cancelar izquierda, Guardar notificaciones derecha.
- Mantener grupos.
- Cada toggle debe tener titulo corto y descripcion concreta.
- Si se agregan canales: usar subfila colapsable por grupo, no mostrar todo siempre.
- Modal si aplica: 1040px desktop.
- Condicion estricta: no scroll vertical. Si hay mas de 8 toggles, agrupar en tabs `Criticas`, `Gestion`, `Canales`.

Referencia visual:

- Linear notification settings.

Impacto estimado:

- Friccion actual baja-media; mejora esperada media.

### 11.4 Seguridad

Descripcion actual:

- Panel de cambio de contrasena:
  - Nueva contrasena.
  - Confirmar contrasena.
  - Reglas de fortaleza.
  - Enviar email de restablecimiento.
  - Cerrar sesiones.
- Zona sensible con modal de eliminar cuenta.
- El modal de eliminar cuenta es un overlay custom, no `RecordModal`.
- Modal de eliminar:
  - Texto de advertencia.
  - Input para confirmar email.
  - Cancelar.
  - Confirmar eliminacion.

Problemas detectados:

- 🔴 Critico: el modal destructivo no usa `RecordModal`/`FocusTrap`, generando inconsistencia y posible riesgo de accesibilidad.
- 🔴 Critico: confirmacion por email no muestra suficiente feedback inline si no coincide.
- 🟡 Importante: acciones destructivas y de seguridad deben tener jerarquia extrema y copy preciso.
- 🟡 Importante: cambio de contrasena necesita footer/action row claro y validacion inmediata.
- 🟢 Menor: reglas de contrasena son utiles, pero deben mostrar progreso sin ocupar excesivo espacio.

Propuesta de rediseno:

- Layout optimo revisado P6:
  - Cambio de contrasena: ventana de 860px con 2 columnas.
  - Eliminar cuenta: ventana destructiva de 640px, compacta y sin scroll.
- Cambio de contrasena:
  - Columna izquierda `Credenciales`: nueva contrasena, confirmar contrasena.
  - Columna derecha `Requisitos`: checklist compacto, fuerza de contrasena, ayuda de restablecimiento.
  - Footer nativo: Cancelar izquierda, Guardar contrasena derecha.
- Migrar eliminar cuenta a `RecordModal` size custom 640px.
- Modal destructivo:
  1. Resumen de consecuencia.
  2. Campo `Email de confirmacion`.
  3. Validacion inline: `Debe coincidir con tu email actual`.
  4. Footer: cancelar izquierda, eliminar cuenta derecha con variante destructiva.
- Condicion estricta: no scroll vertical. La zona sensible no debe mezclar reset, cerrar sesiones y eliminar cuenta en una sola ventana; cada accion sensible abre su propia ventana compacta.

Referencia visual:

- Stripe destructive confirmation modal.
- Linear danger zone.

Impacto estimado:

- Friccion/riesgo actual alto; mejora esperada alta.

---

## 12. Modales Anidados de Creacion Rapida

Fuentes principales:

- `components/forms/TransactionForm/NestedRecordCreationModals.tsx`

### 12.1 Nuevo Portafolio dentro de Transaccion

Descripcion actual:

- Modal anidado ancho aproximado 1180px, z-index superior.
- Campos:
  - Nombre.
  - Banco.
  - Institucion.
  - Tipo.
  - Moneda.
  - Saldo inicial.
  - Color.
  - Icono.
  - Notas.
  - Incluir en patrimonio.
- Acciones primaria/cancelar dentro del contenido.

Problemas detectados:

- 🔴 Critico: crear una entidad auxiliar dentro de una transaccion no debe abrir un formulario tan grande.
- 🔴 Critico: modal anidado con z-index especial puede romper la continuidad del flujo principal.
- 🟡 Importante: apariencia y notas son demasiado avanzadas para creacion rapida.
- 🟡 Importante: acciones no siguen footer estandar.

Propuesta de rediseno:

- Convertir a quick-create compacto de 520px.
- Campos minimos:
  1. Nombre
  2. Tipo
  3. Banco Opcional
  4. Moneda
- Mas opciones:
  - Saldo inicial Opcional
  - Apariencia Opcional
  - Notas Opcional
- Al guardar, cerrar modal anidado y seleccionar automaticamente la nueva cuenta.

Referencia visual:

- Linear quick create.
- Mercury account quick add.

Impacto estimado:

- Friccion actual alta; mejora esperada alta.

### 12.2 Nueva Categoria dentro de Transaccion

Descripcion actual:

- Modal anidado ancho aproximado 980px.
- Campos:
  - Nombre.
  - Tipo/alcance.
  - Icono.
  - Color.
- Acciones primaria/cancelar.

Problemas detectados:

- 🔴 Critico: modal demasiado grande para quick-create.
- 🟡 Importante: icono/color no son necesarios para completar una transaccion.
- 🟡 Importante: acciones en orden no estandar.

Propuesta de rediseno:

- Modal 440px.
- Campos:
  1. Nombre
  2. Uso: ingreso, egreso, ambos
  3. Apariencia Opcional
- Placeholder:
  - Nombre: `Ej: Suscripciones`
- Seleccionar automaticamente al guardar.

Referencia visual:

- Linear label quick-create.

Impacto estimado:

- Friccion actual media-alta; mejora esperada alta.

---

## Sistema de Diseno de Formularios FinTrack

### Estructura base

Crear una capa de componentes especifica para formularios financieros:

- `FormField`: label, optional marker, hint, error, control slot.
- `FormSection`: titulo opcional, descripcion opcional, grid interno y spacing.
- `FormActions`: footer consistente con secundaria izquierda y primaria derecha.
- `FormSeparator`: linea sutil para separar grupos sin crear tarjetas anidadas.
- `OptionalSection`: disclosure controlado para campos avanzados.

### Espaciado estandar

- Entre label y control: `6px`.
- Entre campos dentro de una seccion: `16px`.
- Entre grupos semanticamente relacionados: `20px`.
- Entre secciones: `24px`.
- Antes del footer: `32px`.
- Padding modal `sm/md`: `24px`.
- Padding modal `lg/xl`: `28px`.

### Altura y densidad de inputs

- Input/select desktop: `44px`.
- Input/select touch/mobile: `46px`.
- Textarea compacta: `88px`.
- Amount input: `48px`, tipografia tabular.
- Icon buttons: `36px` minimo, `40px` en touch.

### Labels

- Usar labels estaticos, no flotantes.
- Formato recomendado: sentence case o small label semibold; evitar depender solo de uppercase.
- No marcar obligatorios con asterisco como patron principal.
- Marcar opcionales en el label:
  - `Notas Opcional`
  - `Comprobante Opcional`
  - `Proveedor Opcional`
- Mantener labels siempre visibles; placeholders solo como ejemplo, nunca como sustituto del label.

### Placeholders

Usar ejemplos reales, especificos y locales:

- `Ej: Alquiler enero`
- `Ej: Pago de cliente ACME`
- `Ej: Factura F001-184`
- `Ej: Cuenta corriente BCP`
- `Ej: Internet mensual oficina`

### Validacion inline

- Error debajo del campo, no solo banner global.
- Texto de error debe indicar accion correctiva:
  - `Ingresa un monto mayor a 0.`
  - `Selecciona una cuenta origen distinta a la cuenta destino.`
  - `La fecha de vencimiento no puede ser anterior a la emision.`
- Banner superior solo para errores de sistema, permisos o dependencias.
- Campos condicionales requeridos deben validar dentro de su seccion expandida.

### Secciones opcionales colapsables

Patron unificado:

- Titulo: `Mas opciones`.
- Resumen cerrado: mostrar chips de lo configurado, por ejemplo `Con comprobante`, `Recurrente`, `Notas`.
- Animacion: altura medida o transform/opacity controlados; evitar `transition-all`.
- No colapsar informacion que es financieramente critica, como vencimiento de cuentas por pagar.

### Layouts por complejidad

- Formularios simples: 440-520px, 1 columna.
- Formularios medios: 620-720px, 1 columna con pares controlados.
- Formularios transaccionales de alta frecuencia: 920-960px, 2 zonas semanticas en desktop y 1 columna en mobile. El objetivo es completar registros comunes sin scroll cuando las opciones avanzadas estan cerradas.
- Ventanas administrativas con pickers visuales: 720-1040px, 2 zonas semanticas en desktop. Aunque tengan pocos campos de texto, color/icono/preview/notas necesitan ancho para no convertirse en scroll vertical.
- Ventanas P5/P6 pendientes: 860-1120px, sin scroll vertical. Si no cabe, usar pasos/tabs internos o compactar preview/opciones; no apilar contenido hacia abajo.
- Formularios complejos: 920-1080px solo cuando hay tabla o revision secundaria.
- Evitar 2 columnas por defecto. Usarlas solo para pares naturales:
  - Monto/Moneda.
  - Fecha emision/Fecha vencimiento.
  - Fecha inicio/Fecha fin.
- Excepcion justificada: transacciones P1 usan 2 zonas completas porque el ancho reduce scroll y refuerza el modelo mental de contexto financiero + detalle del registro.
- Excepcion justificada: administracion P4 usa 2 zonas completas cuando existe una familia `datos + apariencia/configuracion`.
- Excepcion justificada: P5/P6 prohibe scroll vertical en ventanas; los formularios complejos deben resolverse con zonas paralelas o navegacion interna.
- Nunca usar modal 1320px para formularios administrativos pequenos.

### Acciones

Patron obligatorio:

- Footer fijo dentro del modal.
- Secundaria a la izquierda: `Cancelar`, `Atras`.
- Primaria a la derecha: `Registrar`, `Crear`, `Guardar`.
- Acciones destructivas: derecha, variante destructiva, con confirmacion explicita.
- Botones no deben flotar en medio del formulario ni pertenecer a un panel lateral.

### Tokens CSS propuestos

Mantener compatibilidad con `--ft-*` y agregar alias especificos de formularios:

```css
:root {
  --ft-form-field-gap: 16px;
  --ft-form-section-gap: 24px;
  --ft-form-label-gap: 6px;
  --ft-form-input-h: 44px;
  --ft-form-input-h-touch: 46px;
  --ft-form-radius: 10px;
  --ft-form-footer-h: 72px;
  --ft-form-focus-ring: 0 0 0 3px color-mix(in srgb, var(--ft-accent) 18%, transparent);
  --ft-form-error: var(--ft-danger, #b42318);
  --ft-form-muted: var(--ft-muted);
  --ft-form-border: var(--ft-border);
  --ft-form-surface: var(--ft-surface);
}
```

### Componentes base a crear

#### FormField

Responsabilidades:

- Renderizar label, optional marker, hint, error y control.
- Conectar `aria-describedby` con hint/error.
- Propagar `aria-invalid`.
- Soportar slots para prefix/suffix, como simbolo de moneda.

#### FormSection

Responsabilidades:

- Agrupar campos relacionados.
- Soportar titulo corto y descripcion opcional.
- Definir grid interno con props `columns="1 | 2 | auto"`.
- Evitar tarjetas anidadas; usar separadores y spacing.

#### FormActions

Responsabilidades:

- Footer sticky.
- Ubicacion estandar de acciones.
- Estado loading, disabled y destructive.
- Mensaje de guardado si aplica.

#### FormSeparator

Responsabilidades:

- Separacion visual de baja friccion.
- No crear cajas dentro de cajas.

#### OptionalSection

Responsabilidades:

- Disclosure accesible.
- Animacion controlada.
- Resumen de valores configurados cuando esta cerrada.
- Mantener errores visibles si hay errores dentro de la seccion.

---

## Orden de Implementacion

Priorizado por impacto en usuario, frecuencia de uso y riesgo tecnico.

### P0 - Fundacion del sistema

1. Extender `RecordModal` con footer, sizes y layout estable.
2. Crear `FormField`, `FormSection`, `FormActions`, `FormSeparator`, `OptionalSection`.
3. Definir tokens `--ft-form-*`.
4. Normalizar acciones: secundaria izquierda, primaria derecha.
5. Cambiar patron de opcionalidad: labels con `Opcional`, eliminar dependencia del asterisco como unica senal.

Impacto: alto. Riesgo tecnico: medio. Es la base para no redisenar cada modal a mano.

### P1 - Formularios de mayor frecuencia

1. Rehacer shell visual de Nueva Transaccion con modal 920-960px, body en 2 zonas desktop y footer nativo de `RecordModal`.
2. Nueva Transaccion: Ingreso, Egreso y Transferencia, verificando que entren sin scroll con `Mas opciones` cerrado en desktop.
3. Nueva Transaccion: Compra de Activo, con zonas paralelas `Activo` y `Pago`.
4. Nueva Transaccion: Por Pagar y Por Cobrar, corrigiendo prioridad de acreedor/deudor y vencimiento antes de opciones.
5. Modales anidados de Portafolio y Categoria dentro de transacciones.

Impacto: muy alto. Riesgo tecnico: medio-alto por condicionales existentes.

### P2 - Obligaciones financieras

1. Nueva Cuenta por Pagar / Editar Cuenta por Pagar.
2. Nueva Cuenta por Cobrar / Editar Cuenta por Cobrar.
3. Nuevo Acreedor / Nuevo Deudor.
4. Unificar cores con los flujos equivalentes dentro de Nueva Transaccion.

Impacto: alto. Riesgo tecnico: medio.

### P3 - Creditos

1. Nuevo prestamo bancario: separar datos esenciales y cronograma.
2. Nueva tarjeta de credito: mover ciclos a seccion progresiva.
3. Definir modal futuro de editar credito.

Impacto: alto. Riesgo tecnico: alto por tablas, archivos y calculos.

### P4 - Administracion

1. Definir shell P4 de ventanas administrativas: footer nativo, header compacto, body sin scroll en desktop y grillas de 2 zonas.
2. Nuevo/editar portafolio: 1040px, datos financieros izquierda, configuracion/apariencia derecha.
3. Bancos: 960px, datos institucionales izquierda, apariencia derecha.
4. Categorias: 900px, nombre/uso izquierda, apariencia derecha.
5. Monedas: 760px, datos izquierda, presets/impacto derecha.
6. Tipos de activo: 720px, datos izquierda, apariencia derecha.

Impacto: medio-alto. Riesgo tecnico: bajo-medio.

### P5 - Presupuestos, activos y recurrencias

1. Definir shell P5 sin scroll: ventanas 920-1080px, header/footer fijos, body en 2-3 zonas o pasos internos.
2. Nuevo/editar presupuesto: 1040px, presupuesto izquierda, monto/fechas derecha, opciones en franja inferior compacta.
3. Nuevo periodo: 920px, periodo anterior izquierda, nuevo periodo derecha.
4. Nuevo activo / futuro editar activo: 960px, activo izquierda, compra/evidencia derecha e inferior.
5. Editar recurrencia: 860px, contexto readonly izquierda, metadata editable derecha.
6. Nueva recurrencia standalone: 1080px, zonas `Tipo y cuenta`, `Importe`, `Programacion`.

Impacto: medio. Riesgo tecnico: medio.

### P6 - Configuracion, perfil y alertas

1. Definir shell P6 sin scroll: configuracion en ventanas 960-1040px o tabs internos; acciones sensibles en ventanas compactas.
2. Crear modal de nueva alerta: 980px, regla izquierda, entrega/preview derecha.
3. Perfil si se presenta como ventana: 960px, identidad izquierda, datos derecha.
4. Preferencias si se presenta como ventana: 960px, apariencia/privacidad izquierda, localizacion financiera derecha.
5. Notificaciones si se presenta como ventana: 1040px, criticas izquierda, gestion derecha, canales en franja inferior.
6. Seguridad: cambio de contrasena 860px en 2 columnas; eliminar cuenta 640px destructivo sin scroll.

Impacto: medio. Riesgo tecnico: bajo-medio.

---

## Gaps de Producto Detectados

- `Editar credito` no esta implementado; aparece como funcionalidad futura.
- `Editar activo` no esta implementado; aparece como funcionalidad futura.
- `Nueva recurrencia` standalone no esta implementada; las recurrencias nacen desde otros formularios.
- `Nueva alerta` no esta implementada; el modulo actual es un inbox de alertas generadas.
- Cuentas por cobrar tienen divergencia entre flujo transaccional y formulario dedicado, especialmente alrededor de vencimiento.
- Quick-create de portafolio/categoria dentro de transacciones usa formularios demasiado completos para el contexto.

## Nota sobre Linear

Se reviso la solicitud con el flujo de trabajo de Linear en mente, pero esta fase solo pide generar el informe local. No se creo ni actualizo ningun issue porque no se proporciono equipo, proyecto o ticket objetivo. El orden de implementacion anterior esta listo para convertirse en epicas/tareas de Linear en la siguiente fase.
