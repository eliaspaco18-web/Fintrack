# FUNCIONALIDADES DETALLADAS DE APP FINTRACK

**Redactado por:** Elias Gustavo Paco P.  
**Inicio de redacción:** 22/04/2026  
**Fin de redacción:** 27/04/2026  
**Nueva versión de aplicación:** 1.9.119.1.1

A continuación, se detallará los diferentes módulos de la aplicación, más sus diferentes funcionalidades (ya existentes y nuevas) de cada módulo, así como también la conexión que tendrá con otros módulos dentro de la aplicación FinTrack.

---

## TABLA DE CONTENIDO

1. [DASHBOARD](#1-dashboard)
2. [PORTAFOLIO](#2-portafolio)
3. [TRANSACCIONES](#3-transacciones)
4. [CRÉDITOS](#4-créditos)
5. [ACTIVOS](#5-activos)
6. [PRESUPUESTOS](#6-presupuestos)
7. [CUENTAS POR COBRAR](#7-cuentas-por-cobrar)
8. [CUENTAS POR PAGAR](#8-cuentas-por-pagar)
9. [ALERTAS](#9-alertas)
10. [ADMINISTRACIÓN](#10-administración)
11. [TRANSACCIONES RECURRENTES](#11-transacciones-recurrentes)

---

## 1. DASHBOARD

### Panel central – Encabezado

En la parte superior del panel central se muestra el Balance Consolidado de todos los portafolios activos en la moneda principal del usuario, con su equivalencia en dólares debajo. A la derecha del balance se ubica una tarjeta resaltada que muestra el Resultado Mensual (flujo neto del mes actual: Ingresos – Egresos). Si el resultado es positivo se muestra en color verde y si es negativo en color rojo. Este encabezado es estático y siempre visible independientemente del período seleccionado.

### Panel central – Gráfico Money Flow 6 Meses

Gráfico de línea que muestra la evolución del saldo acumulado a lo largo de los últimos 6 meses. El eje X representa los meses y el eje Y los montos en la moneda principal. El usuario puede activar o desactivar el toggle "Saldo acumulado" ubicado encima del gráfico para ver la vista acumulada o la vista de flujo mensual. El gráfico se actualiza automáticamente en base a todas las transacciones del usuario.

### Panel central – Cards de indicadores del mes

Tres tarjetas horizontales que muestran el resumen del mes en curso:

- **Ingresos:** Muestra el total de ingresos registrados en el mes actual con su equivalencia en dólares debajo. Color de texto: verde.
- **Egresos:** Muestra el total de egresos registrados en el mes actual con su equivalencia en dólares debajo. Color de texto: rojo.
- **Alertas:** Muestra el total de alertas pendientes (cuotas y pendientes sin atender). Al hacer clic, navega directamente al módulo ALERTAS.

### Panel central – Gráfico de Saldos por Día

Gráfico de línea que muestra el saldo acumulado por día dentro del período seleccionado. El eje X representa los días y el eje Y los montos en la moneda principal. El área bajo la línea se rellena con un gradiente para facilitar la lectura visual. Debajo del gráfico se muestran el total de ingresos y egresos del período seleccionado. El usuario puede seleccionar el rango de tiempo con los botones: 5D (últimos 5 días), 1M (último mes), 3M (últimos 3 meses), 6M (últimos 6 meses), 1A (último año). Por defecto se muestra el período 1M.

### Panel central – Métricas del período (4 tarjetas)

Cuatro tarjetas de métricas ubicadas debajo del gráfico de saldos por día. Siempre muestran datos del mes en curso:

- **Patrimonio Neto:** Suma total de todos los saldos de portafolios activos. Se muestra con equivalencia en dólares.
- **Ingresos del Mes:** Total de ingresos registrados en el mes actual. Se muestra con equivalencia en dólares.
- **Egresos del Mes:** Total de egresos registrados en el mes actual. Se muestra con equivalencia en dólares.
- **Balance del Mes:** Diferencia entre Ingresos del Mes y Egresos del Mes. Si es positivo muestra en verde; si es negativo en rojo. Se muestra con equivalencia en dólares.

### Panel central – Resumen de módulos (mini-tarjetas)

Cuatro mini-tarjetas con acceso rápido a los módulos clave de la aplicación:

- **Cuentas:** Muestra el número de portafolios activos. Incluye botón "Gestionar" que navega directamente al módulo PORTAFOLIO.
- **Créditos:** Muestra el número de créditos activos (tarjetas y bancarios). Al hacer clic navega al módulo CRÉDITOS.
- **Activos:** Muestra el número de bienes registrados. Al hacer clic navega al módulo ACTIVOS.
- **Por Cobrar/Pagar:** Muestra el número total de pendientes (suma de cuentas por cobrar y cuentas por pagar sin cancelar). Al hacer clic navega al módulo correspondiente según el tipo de pendiente.

### Panel central – Mini-resumen expandido por módulo

Debajo de las mini-tarjetas, cada módulo presenta una sección expandida con datos clave:

- **Cuentas:** Muestra el Total Consolidado de todos los portafolios activos en la moneda principal.
- **Créditos:** Muestra el Uso Total del crédito disponible: porcentaje consumido frente a la línea total, con barra de progreso. Botón "Ver todos" que navega al módulo CRÉDITOS.
- **Activos:** Muestra el valor total en soles de todos los bienes registrados. Botón "Ver todos" que navega al módulo ACTIVOS.
- **Posición Neta:** Muestra en dos columnas el total de Por Cobrar y Por Pagar, con flechas de navegación directa a cada módulo.

### Panel derecho – Saldos Bancarios

Tarjeta del panel lateral que muestra el saldo total consolidado de todos los portafolios activos. Debajo del total, presenta un desglose individual por portafolio con: nombre del portafolio, barra de progreso proporcional al peso del portafolio en el total consolidado, y saldo. Incluye un botón "SMART" que al activarse muestra una nota de contexto sobre la liquidez real del usuario. Esta sección permite entender la liquidez disponible sin necesidad de ingresar al módulo PORTAFOLIO.

> **Mejora propuesta:** Agregar un indicador de variación mensual debajo del total consolidado, mostrando el diferencial respecto al mes anterior (+/- S/ X.XX) para que el usuario evalúe de un vistazo si su liquidez mejoró o empeoró.

### Panel derecho – Por Cobrar vs Por Pagar

Tarjeta que muestra el flujo pendiente neto (diferencia entre lo que el usuario tiene por cobrar y por pagar). Se divide en dos bloques horizontales: Por Cobrar (total pendiente con número de movimientos y barra de progreso en verde) y Por Pagar (total pendiente con número de pendientes y barra de progreso en rojo). Debajo de ambos bloques, una nota calculada automáticamente indica si el flujo futuro favorece o perjudica al usuario. Incluye botón "SMART" con contexto adicional sobre la situación financiera.

> **Mejora propuesta:** Agregar un mini-listado de los 3 deudores o acreedores con mayor monto pendiente, con enlace directo a su ficha en el módulo correspondiente (POR COBRAR o POR PAGAR).

### Panel derecho – Egresos por Categoría

Tarjeta que muestra un gráfico de dona (donut) con la distribución de egresos del mes actual agrupados por categoría. Debajo del gráfico se muestra el total del mes y el número de categorías con movimiento. A continuación, una lista de cada categoría con su monto correspondiente y un punto de color identificador.

> **Mejora propuesta:** Agregar un toggle que permita alternar entre "Egresos por Categoría" e "Ingresos por Categoría" en la misma tarjeta, sin necesidad de tarjetas separadas.

### Panel derecho – Vencimientos Próximos

Tarjeta que muestra todos los vencimientos dentro de los próximos 30 días. Los vencimientos incluyen: cuotas de créditos bancarios, fechas de pago de tarjetas de crédito y cuentas por pagar con fecha límite definida. Cada vencimiento debe mostrar: nombre, módulo de origen (con icono), fecha de vencimiento y monto. Se ordena por fecha de vencimiento ascendente (el más próximo primero). Si no hay vencimientos próximos, muestra un mensaje informativo.

### Panel derecho – Presupuestos del Mes *(Mejora – Nuevo)*

Nueva tarjeta propuesta para el panel derecho. Muestra el estado de los presupuestos activos en el mes actual. Por cada presupuesto activo se muestra: nombre del presupuesto, categoría asociada, monto definido, monto ejecutado, barra de progreso en verde si está dentro del límite o en rojo si fue excedido, y porcentaje de ejecución. Al hacer clic navega directamente al módulo PRESUPUESTOS.

### Panel derecho – Créditos: Uso Rápido *(Mejora – Nuevo)*

Nueva tarjeta propuesta. Muestra el resumen de uso de créditos: para tarjetas de crédito muestra la línea total vs el consumo actual con barra de progreso; para créditos bancarios muestra el capital total vs el capital pendiente de pago. Permite al usuario evaluar de un vistazo el nivel de endeudamiento sin necesidad de ingresar al módulo CRÉDITOS.

---

## 2. PORTAFOLIO

### Parte superior

Dentro de este módulo en la parte superior debe haber un resumen de cuentas activas e inactivas, solo datos numéricos. Dentro de esta parte superior debe haber un botón que permita crear un nuevo portafolio, para la creación de un nuevo portafolio emergerá una ventana donde se completará los siguientes datos:

- **Nombre de portafolio:** Campo llenado por el usuario. *Campo obligatorio*
- **Entidad Bancaria:** Lista desplegable que viene de un pre-registro en el módulo de ADMINISTRACIÓN. *Campo obligatorio*
- **Tipo de Portafolio:** Lista desplegable predefinidas por el sistema: Cuenta corriente, Cuenta de ahorros, Cuenta de efectivo, Tarjeta de crédito, Acciones, ETF, Cripto-activos. *Campo obligatorio*
- **Moneda:** Lista desplegable que viene de un pre-registro en el módulo de ADMINISTRACIÓN. *Campo obligatorio*
- **Saldo Inicial:** Importe numérico (solo permite el registro de números), el formato debe ser: "#,000.00"
- **Color:** Ofrece al usuario un amplio catálogo de colores. Si el usuario no selecciona un color, por defecto asigna uno.
- **Icono:** Ofrece al usuario un amplio catálogo de iconos con referencia a los tipos de portafolio y más. Si el usuario no selecciona un icono, por defecto asigna uno.
- **Notas:** Campo llenado por el usuario de ser necesario.
- **Estado:** Por defecto cada vez que se cree un nuevo portafolio, el estado será "Activo".

### Después de parte superior

La barra de filtros será de una sola fila, el recuadro donde estarán los filtros no debe ser muy alto. Los filtros serán los siguientes:

- **Buscar portafolio:** Campo de texto, donde el usuario podrá filtrar por letras o palabras que vaya escribiendo.
- **Entidad Bancaria:** Lista desplegable
- **Tipo de Portafolio:** Lista desplegable
- **Moneda:** Lista desplegable
- **Estado:** Lista desplegable

A lado de la barra de filtros, habrá dos iconos que indicarán las dos vistas que tendrá este módulo de portafolio: vista tipo lista y vista tipo tarjetas de un tamaño pequeño-mediano.

### Parte intermedia – Después de barra de filtros

Aquí estarán todos los portafolios creados por el usuario, principalmente debe contener el nombre del portafolio y en menor tamaño e intensidad, el icono, entidad bancaria, tipo de portafolio, moneda, saldo y estado. El estado debe estar coloreado por:

- 🔴 Rojo – "Desactivado"
- 🟢 Verde – "Activo"

Dentro de la lista de portafolios, deben existir cuatro iconos:

- **Editar:** Permite al usuario modificar los datos llenados al momento de su creación.
- **Eliminar:** Permite al usuario eliminar el portafolio, no pudiendo eliminar aquel portafolio que tenga transacciones.
- **Desactivar:** Este icono aparecerá siempre y cuando el portafolio esté activo.
- **Activar:** Este icono aparecerá siempre y cuando el portafolio esté desactivado.

*Tener en cuenta las dos vistas que existen, ambas vistas deben tener lo mencionado en esta parte.*

---

## 3. TRANSACCIONES

### Parte superior

Dentro de este módulo en la parte superior debe haber un resumen de transacciones realizadas, tanto de egresos, ingresos o transferencia. Dentro de esta parte superior debe haber un botón que permita crear una nueva transacción, para la creación de una nueva transacción emergerá una ventana donde la aplicación preguntará qué tipo de operación quiere realizar el usuario:

#### Ingreso

- **Portafolio:** Lista desplegable que viene de un pre-registro en el módulo de PORTAFOLIO. *Campo obligatorio*
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Categoría:** Lista desplegable que viene de un pre-registro en el módulo de ADMINISTRACIÓN. *Campo obligatorio*
- **Descripción:** Campo llenado por el usuario.
- **Moneda:** Llenado automáticamente por el sistema según el portafolio seleccionado. No editable.
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Debajo debe haber equivalencia en dólares/soles.
- **Remitente:** Campo llenado por el usuario.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

> En la parte final habrá un botón que permita guardar la transacción como transacción recurrente, solicitando un nombre con el que se guardará.

#### Egreso

- **Forma de pago:** Débito o Crédito. *Campo obligatorio*
- **Portafolio:** Lista desplegable según la forma de pago. *Campo obligatorio*
  - Débito: Cuenta corriente, Cuenta de ahorros, Cuenta de efectivo, Acciones, ETF, Cripto-activos.
  - Crédito: Tarjeta de crédito.
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Categoría:** Lista desplegable desde ADMINISTRACIÓN. *Campo obligatorio*
- **Presupuesto:** Lista desplegable. Solo se muestran presupuestos que cumplan: misma categoría, fecha dentro del rango del presupuesto, y estado activo.
- **Descripción:** Campo llenado por el usuario.
- **Moneda:** Llenado automáticamente. No editable.
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Con equivalencia en dólares/soles debajo.
- **Destinatario:** Campo llenado por el usuario.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

> En la parte final habrá un botón que permita guardar la transacción como transacción recurrente.

#### Transferencia

- **Portafolio (Desde):** Lista desplegable desde PORTAFOLIO. *Campo obligatorio*
- **Portafolio (Hacia):** Lista desplegable desde PORTAFOLIO. *Campo obligatorio*
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Descripción:** Llenada automáticamente: "Transferencia de [Portafolio Desde] / [Moneda Desde] a [Portafolio Hacia] / [Moneda Hacia]"
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Con equivalencia en dólares/soles debajo.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

> En la parte final habrá un botón que permita guardar la transacción como transacción recurrente.

#### Compra de Activo

Esta ventana estará relacionada con el módulo ACTIVOS. Este tipo de operación significa un **Egreso**.

- **Portafolio:** Lista desplegable desde PORTAFOLIO. *Campo obligatorio*
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Tipo de Activo:** Lista desplegable desde ADMINISTRACIÓN. *Campo obligatorio*
- **Descripción:** Campo llenado por el usuario.
- **Moneda:** Llenado automáticamente. No editable.
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Con equivalencia en dólares/soles debajo.
- **Destinatario:** Campo llenado por el usuario.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

#### Cuentas por pagar

Esta ventana estará relacionada con el módulo POR PAGAR. Este tipo de operación significa un **Ingreso**.

- **Portafolio:** Lista desplegable desde PORTAFOLIO. *Campo obligatorio*
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Acreedor:** Lista desplegable desde POR PAGAR. *Campo obligatorio*
- **Descripción:** Campo llenado por el usuario.
- **Moneda:** Llenado automáticamente. No editable.
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Con equivalencia en dólares/soles debajo.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

> En la parte final habrá un botón que permita guardar la transacción como transacción recurrente.

#### Cuentas por cobrar

Esta ventana estará relacionada con el módulo CUENTAS POR COBRAR. Este tipo de operación significa un **Egreso**.

- **Portafolio:** Lista desplegable desde PORTAFOLIO. *Campo obligatorio*
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Deudor:** Lista desplegable desde POR COBRAR. *Campo obligatorio*
- **Descripción:** Campo llenado por el usuario.
- **Moneda:** Llenado automáticamente. No editable.
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Con equivalencia en dólares/soles debajo.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

> En la parte final habrá un botón que permita guardar la transacción como transacción recurrente.

### Después de parte superior

La barra de filtros será de una sola fila. Los filtros serán los siguientes:

- **Buscar descripción:** Campo de texto.
- **Tipo de operación:** Lista desplegable.
- **Portafolio:** Lista desplegable.
- **Categoría:** Lista desplegable. *Dependerá del tipo de operación filtrado*
- **Fecha Desde:** Desplegable tipo calendario.
- **Fecha Hasta:** Desplegable tipo calendario.

### Parte intermedia – Después de barra de filtros

Aquí estarán todas las transacciones creadas por el usuario, al inicio de cada fila, un icono con color que diferencie:

- 🔴 Egreso – Rojo
- 🟢 Ingreso – Verde
- 🔵 Transferencia – Azul

Dentro de la lista de transacciones, cada registro debe contener:

- **Editar:** Permite al usuario modificar los datos.
- **Eliminar:** Permite al usuario eliminar la transacción.

---

## 4. CRÉDITOS

### Parte superior

Dentro de este módulo en la parte superior debe haber un resumen de créditos activos y cancelados. Dentro de esta parte superior debe haber un botón que permita crear un nuevo crédito:

#### Tarjeta de Crédito

- **Nombre de Crédito:** Campo llenado por el usuario. *Campo obligatorio*
- **Portafolio:** Lista desplegable. Solo portafolios de tipo "Tarjeta de crédito". *Campo obligatorio*
- **Entidad Bancaria:** Llenado automáticamente desde el portafolio seleccionado.
- **Línea de Crédito:** Importe numérico, formato "#,000.00". *Campo obligatorio, mayor a 0.00*
- **Consumo Actual:** Importe numérico, formato "#,000.00".
- **Estado:** Por defecto "Activo".
- **Ciclos de Facturación:** Al dar clic al botón "Ciclos", aparece una tabla a la derecha:

| Mes de Facturación | Año de Facturación | Consumos desde | Consumos hasta | Fecha de Pago | Total a Pagar | Estado de Cuenta |
|---|---|---|---|---|---|---|
| Enero | 2026 | 25/12/2025 | 23/01/2026 | 23/02/2026 | 5,000.00 | Subir archivo |

  - **Mes de Facturación:** Lista desplegable de enero a diciembre.
  - **Año de Facturación:** Lista desplegable de 2016 a 2027 (extensible anualmente sin alterar registros).
  - **Consumos desde:** Desplegable tipo calendario. *Campo obligatorio*
  - **Consumos hasta:** Desplegable tipo calendario. *Campo obligatorio*
  - **Fecha de Pago:** Desplegable tipo calendario. *Campo obligatorio*
  - **Total a Pagar:** Calculado automáticamente: Total de pagos de tarjeta – Total de consumos dentro del mes de facturación.
  - **Estado de Cuenta:** Permite subir foto, PDF, Word, Excel.

  La tabla trae 1 fila por defecto con botón para crear más filas. Restricción: no se puede duplicar Mes + Año de Facturación.

#### Crédito Bancario

- **Nombre de Crédito:** Campo llenado por el usuario. *Campo obligatorio*
- **Entidad Bancaria:** Lista desplegable desde ADMINISTRACIÓN. *Campo obligatorio*
- **Cuenta destino de desembolso:** Solo portafolios de tipo Cuenta corriente, Cuenta de ahorros o Cuenta de efectivo. *Campo obligatorio*
- **Moneda:** Llenado automáticamente. No editable.
- **Fecha de Desembolso:** Desplegable tipo calendario. *Campo obligatorio*
- **Inicio de Cuotas:** Desplegable tipo calendario. *Campo obligatorio*
- **Número de Cuotas:** Importe numérico entero. *Campo obligatorio*
- **Capital prestado:** Importe numérico, formato "#,000.00". *Campo obligatorio*
- **Descripción:** Campo llenado por el usuario.
- **Estado:** Por defecto "Activo".
- **Cronograma de pagos:** Al dar clic al botón "Cronograma", aparece una tabla a la derecha:

| Fecha de Vencimiento | Capital | Intereses | Seguro | Otros | Cuota | Constancia de Pago |
|---|---|---|---|---|---|---|
| 05/01/2026 | 5,000.00 | 500.00 | 10.00 | 20.00 | 5,530.00 | Subir archivo |

  - **Fecha de Vencimiento:** Por defecto la primera cuota toma la fecha de "Inicio de Cuotas". Las siguientes suman 30 días a la fecha anterior.
  - **Capital, Intereses, Seguro, Otros:** Importes numéricos, formato "#,000.00".
  - **Cuota:** Suma automática de Capital + Intereses + Seguro + Otros.
  - **Constancia de Pago:** Permite subir foto, PDF, Word, Excel.
  - La tabla debe tener una fila de totales al final.

### Después de parte superior

Filtros (una sola fila):

- **Buscar descripción:** Campo de texto.
- **Tipo de crédito:** Lista desplegable (Tarjeta de crédito / Préstamo Bancario).
- **Estado:** Lista desplegable.
- **Entidad Bancaria:** Lista desplegable.

A lado de la barra de filtros, dos iconos para vista lista y vista tarjetas. Se pueden identificar por secciones según tipo de crédito.

### Parte intermedia – Después de barra de filtros

Aquí estarán todos los créditos creados por el usuario. Estado coloreado:

- 🔴 Rojo – "Desactivado"
- 🟢 Verde – "Activo"

Cada crédito debe tener una barra de progreso sobre el avance del crédito con porcentaje. Iconos por registro:

- **Editar:** Modificar datos.
- **Eliminar:** No se puede eliminar si tiene transacciones.
- **Desactivar:** Si el crédito está activo.
- **Activar:** Si el crédito está desactivado.

A lado derecho habrá una sección de alertas: una parte para vencimientos de tarjetas de crédito y otra para créditos bancarios.

---

## 5. ACTIVOS

### Parte superior

Resumen de activos activos y dados de baja. Botón para crear un nuevo activo (representa un **Egreso**):

- **Portafolio:** Lista desplegable desde PORTAFOLIO. *Campo obligatorio*
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Tipo de Activo:** Lista desplegable desde ADMINISTRACIÓN. *Campo obligatorio*
- **Descripción:** Campo llenado por el usuario.
- **Moneda:** Llenado automáticamente. No editable.
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Con equivalencia en dólares/soles debajo.
- **Destinatario:** Campo llenado por el usuario.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

### Después de parte superior

Filtros (una sola fila):

- **Buscar descripción:** Campo de texto.
- **Tipo de activo:** Lista desplegable.
- **Fecha Desde:** Desplegable tipo calendario.
- **Fecha Hasta:** Desplegable tipo calendario.

Dos iconos para vista lista y vista tarjetas, identificados por tipo de activo.

### Parte intermedia – Después de barra de filtros

Todos los activos creados por el usuario. Iconos por registro:

- **Editar:** Modificar datos.
- **Eliminar:** Elimina el activo y su transacción (egreso).
- **Desactivar:** Si el activo está activo.
- **Activar:** Si el activo está desactivado.

---

## 6. PRESUPUESTOS

### Parte superior

Resumen de presupuestos activos y desactivados. Botón para crear un nuevo presupuesto:

- **Nombre:** Campo llenado por el usuario. *Prohibido duplicar nombres de presupuesto.*
- **Categoría:** Lista desplegable desde ADMINISTRACIÓN. *Campo obligatorio*
- **Periodicidad:** Lista desplegable (Semanal, Mensual, Trimestral, Anual). *Campo obligatorio*
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*
- **Moneda:** Lista desplegable desde ADMINISTRACIÓN. *Campo obligatorio*
- **Fecha de inicio:** Desplegable tipo calendario. *Campo obligatorio*
- **Fecha de fin:** Llenada automáticamente según la periodicidad seleccionada.
- **Descripción:** Campo llenado por el usuario.
- **Notas:** Campo llenado por el usuario.

Una vez creado, el usuario puede crear nuevos períodos respetando la periodicidad original. El sistema toma la fecha de fin y habilita el nuevo período automáticamente. Cada período tiene un botón para ver todas las transacciones dentro de ese período (fecha, portafolio, destinatario, descripción, importe).

### Después de parte superior

Filtros (una sola fila):

- **Buscar descripción:** Campo de texto.
- **Moneda:** Lista desplegable.
- **Categoría:** Lista desplegable.
- **Estado:** Lista desplegable.

Dos iconos para vista lista y vista tarjetas.

### Parte intermedia – Después de barra de filtros

Todos los presupuestos creados. Ordenados por estado (activos primero). Iconos por registro:

- **Editar:** Modificar datos.
- **Eliminar:** No se puede eliminar si tiene transacciones relacionadas.
- **Desactivar:** Si el presupuesto está activo.
- **Activar:** Si el presupuesto está desactivado.

---

## 7. CUENTAS POR COBRAR

### Parte superior

Resumen de cuentas por cobrar cobradas y pendientes. Botón para crear una nueva cuenta por cobrar (representa un **Egreso**):

- **Portafolio:** Lista desplegable desde PORTAFOLIO. *Campo obligatorio*
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Deudor:** Lista desplegable desde módulo POR COBRAR. *Campo obligatorio*
- **Descripción:** Campo llenado por el usuario.
- **Moneda:** Llenado automáticamente. No editable.
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Con equivalencia en dólares/soles debajo.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

> En la parte final habrá un botón para guardar como transacción recurrente.

También debe haber un botón para crear un nuevo deudor con:

- **Deudor:** Campo llenado por el usuario. *Campo obligatorio*
- **Deuda inicial:** Importe numérico, formato "#,000.00".
- **Relación:** Campo llenado por el usuario.

### Después de parte superior

Filtros (una sola fila):

- **Estado:** Lista desplegable (Cobrados, Pendientes, Todos).
- **Ordenar:** Por mayores a menores deudores y de menores a mayores.

Dos iconos para vista lista y vista tarjetas.

### Parte intermedia – Después de barra de filtros

Todos los deudores creados. Al hacer clic en un deudor, se abre una ventana con sus transacciones (fecha, portafolio, descripción, importe) con total al final y filtros:

- Buscar descripción, Portafolio, Fecha Desde, Fecha Hasta.

Cada deudor debe tener una barra de progreso sobre el avance de lo cobrado con porcentaje.

---

## 8. CUENTAS POR PAGAR

### Parte superior

Resumen de cuentas por pagar pagadas y pendientes. Botón para crear una nueva cuenta por pagar (representa un **Ingreso**):

- **Portafolio:** Lista desplegable desde PORTAFOLIO. *Campo obligatorio*
- **Fecha:** Desplegable tipo calendario. *Campo obligatorio*
- **Acreedor:** Lista desplegable desde módulo POR PAGAR. *Campo obligatorio*
- **Descripción:** Campo llenado por el usuario.
- **Moneda:** Llenado automáticamente. No editable.
- **Monto:** Importe numérico, formato "#,000.00". *Campo obligatorio*. Con equivalencia en dólares/soles debajo.
- **Notas:** Campo llenado por el usuario.
- **Adjuntar constancia o comprobante:** Permite subir foto, PDF, Word, Excel.

> En la parte final habrá un botón para guardar como transacción recurrente.

También debe haber un botón para crear un nuevo acreedor con:

- **Acreedor:** Campo llenado por el usuario. *Campo obligatorio*
- **Deuda inicial:** Importe numérico, formato "#,000.00".
- **Relación:** Campo llenado por el usuario.

### Después de parte superior

Filtros (una sola fila):

- **Estado:** Lista desplegable (Cancelados, Pendientes, Todos).
- **Ordenar:** Por mayores a menores acreedores y de menores a mayores.

Dos iconos para vista lista y vista tarjetas.

### Parte intermedia – Después de barra de filtros

Todos los acreedores creados. Al hacer clic en un acreedor, se abre una ventana con sus transacciones (fecha, portafolio, descripción, importe) con total al final y filtros:

- Buscar descripción, Portafolio, Fecha Desde, Fecha Hasta.

Cada acreedor debe tener una barra de progreso sobre el avance de lo cancelado con porcentaje.

---

## 9. ALERTAS

### Parte superior

Resumen de alertas leídas y pendientes de leer, separadas por tipo: Críticas, Operativas y Sugerencias.

### Después de parte superior

Filtros (una sola fila):

- **Tipo de alerta:** Lista desplegable (Crítica, Operativa, Sugerencia, Todas).
- **Estado:** Lista desplegable (Leída, No leída, Todas).
- **Módulo:** Lista desplegable (Créditos, Presupuestos, Cuentas por cobrar, Cuentas por pagar, Todos).

### Parte intermedia – Después de barra de filtros

Las alertas se ordenan por fecha de generación (más recientes primero). Cada alerta muestra: tipo (con color), módulo de origen, descripción, fecha de generación y estado (leída/no leída). Cada alerta tiene un botón de acción directa que lleva al registro que la originó.

**Tipos de alertas generadas automáticamente:**

**Críticas:**
- Cuota de crédito bancario con vencimiento en los próximos 7 días.
- Fecha de pago de tarjeta de crédito con vencimiento en los próximos 7 días.
- Cuenta por pagar vencida (fecha de pago superada sin registro de pago).

**Operativas:**
- Presupuesto que ha alcanzado el 80% de su monto definido.
- Presupuesto que ha superado su monto definido (excedido).
- Cuenta por cobrar pendiente de cobro con más de 30 días desde su registro.

**Sugerencias:**
- Transacción recurrente guardada que el usuario no ha utilizado en el período actual.

---

## 10. ADMINISTRACIÓN

### Parte superior

Aquí estarán las siguientes configuraciones del sistema:

**Entidad Bancaria:**
- **Nombre de Entidad Bancaria:** Campo llenado por el usuario. *Campo obligatorio*
- **Nombre Corto:** Campo llenado por el usuario.
- **País:** Lista desplegable de países del mundo. *Campo obligatorio*
- **Color:** Catálogo de colores. Asigna uno por defecto si no se selecciona.
- **Icono:** Catálogo de iconos. Permite subir imagen. Asigna uno por defecto si no se selecciona.

**Moneda:**
- **País:** Lista desplegable de países del mundo. *Campo obligatorio*
- **Moneda:** Catálogo de principales monedas del mundo. *Campo obligatorio*

**Categoría:**
- **Nombre de Categoría:** Campo llenado por el usuario. *Campo obligatorio*
- **Tipo de Categoría:** Lista desplegable (Ingreso / Egreso). *Campo obligatorio*
- **Color:** Catálogo de colores. Asigna uno por defecto si no se selecciona.
- **Icono:** Catálogo de iconos. Permite subir imagen. Asigna uno por defecto si no se selecciona.

**Tipo de Activo:**
- **Nombre de tipo de activo:** Campo llenado por el usuario. *Campo obligatorio*
- Por defecto el sistema ofrece: Tecnología, Vehículo, Inmueble, Otro.

Todas las entidades bancarias, monedas, categorías y tipos de activos tienen cuatro iconos por registro:

- **Editar:** Modificar datos.
- **Eliminar:** No se puede eliminar si tiene registros relacionados.
- **Desactivar:** Si el registro está activo.
- **Activar:** Si el registro está desactivado.

---

## 11. TRANSACCIONES RECURRENTES

### Parte superior

Resumen del total de transacciones recurrentes guardadas. No hay botón de creación aquí — las transacciones recurrentes solo se crean desde el módulo de TRANSACCIONES, al registrar un Ingreso, Egreso, Transferencia, Cuenta por cobrar o Cuenta por pagar.

### Después de parte superior

Filtros (una sola fila):

- **Buscar:** Campo de texto, filtra por nombre de la transacción recurrente.
- **Tipo de operación:** Lista desplegable (Ingreso, Egreso, Transferencia, Cuenta por cobrar, Cuenta por pagar).
- **Portafolio:** Lista desplegable.

### Parte intermedia – Después de barra de filtros

Todas las transacciones recurrentes guardadas. Cada registro muestra: nombre de la recurrente, tipo de operación (con color: 🟢 verde ingreso, 🔴 rojo egreso, 🔵 azul transferencia), portafolio, monto y moneda.

Iconos por registro:

- **Usar:** Pre-llena automáticamente el formulario de nueva transacción con los datos de la recurrente. El usuario puede ajustar antes de guardar.
- **Editar:** Modifica el nombre y datos de la transacción recurrente.
- **Eliminar:** Elimina la recurrente. No elimina transacciones ya registradas anteriormente.
