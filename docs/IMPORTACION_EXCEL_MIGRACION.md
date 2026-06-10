# Importacion Excel para migracion de datos

Fecha: 2026-06-03  
Estado: Implementacion por fases en curso  
Alcance: migracion inicial y extendida de informacion financiera hacia FinTrack mediante plantilla Excel oficial

## Actualizacion de criterio 2026-06-06

Decisiones activas de producto para la plantilla actual:

- Ya no se importan portafolios desde Excel.
- Los portafolios se seleccionan desde una lista precargada con los nombres que ya existen en FinTrack.
- Las categorias se muestran como texto simple del sistema, separadas por tipo de operacion.
- Se eliminaron columnas `clave` en las hojas operativas para reducir confusion al llenar el archivo.
- El `tipo_cambio` ya no se pide al usuario en la plantilla; FinTrack lo resuelve al importar usando la fecha del movimiento y la tabla diaria contable `exchange_rates_daily`, y si no existe una tasa exacta usa la ultima diaria previa disponible.
- Las hojas visibles para el usuario deben concentrarse en operaciones:
  - `03_Ingresos`
  - `04_Egresos`
  - `05_Transferencias`
  - `06_Compra_Activo`
  - `07_Por_Cobrar`
  - `08_Por_Pagar`

## Estado de implementacion

| Fase | Estado | Notas |
| --- | --- | --- |
| Fase 1A: Base tecnica | Implementada | Migracion `import_jobs`/`import_job_rows`, RLS, tipos internos y endpoints base de historial/detalle |
| Fase 1B: Plantilla Excel oficial | Implementada | Endpoint `GET /api/imports/excel/template` con `.xlsx`, hojas base, formatos, proteccion, metadata, listas y validaciones |
| Fase 1C: Analizador del Excel | Implementada | Endpoint `POST /api/imports/excel/analyze` con lectura `.xlsx`, validacion estructural, filas normalizadas, errores, advertencias y saldos proyectados sin guardar datos finales |
| Fase 1D: UI de importacion | Implementada | Panel en Configuracion > Datos para descargar plantilla, subir Excel, ver resumen, errores, advertencias y saldos proyectados |
| Fase 1E: Commit de datos | Implementada | Endpoint `POST /api/imports/excel/commit` y botón activo en Configuración para crear catálogos, portafolios y transacciones base. Filas que dependan de crédito, presupuesto, deudor o acreedor quedan bloqueadas para fases posteriores |
| Fase 2: Modulos completos | Implementada | La plantilla, el analizador y el commit ya cubren hojas `04` a `09` para créditos, activos, presupuestos, por cobrar, por pagar y recurrentes, con validaciones relacionales y creación por módulo |
| Fase 3: Robustez y control avanzado | En progreso | Ya incluye idempotencia práctica por `file_hash`, descarga de reporte CSV y rollback seguro de importaciones confirmadas con metadata de reversión |

## 1. Objetivo

Permitir que un usuario que ya lleva sus finanzas en Excel, Google Sheets u otra app pueda migrar su informacion a FinTrack sin registrar todo manualmente.

La funcionalidad debe resolver tres necesidades:

- Dar al usuario una plantilla clara para ordenar su informacion antes de importarla.
- Validar la data antes de guardarla, mostrando errores comprensibles por fila y columna.
- Cargar los datos por modulos respetando dependencias: catalogos, portafolios, transacciones y registros derivados.

La recomendacion es no aceptar cualquier Excel libre como flujo principal. La mejor forma es ofrecer una plantilla oficial de FinTrack, generada desde la cuenta del usuario, con hojas separadas por modulo, columnas estandarizadas, ejemplos, listas desplegables y reglas visibles.

## 2. Decision recomendada

### Usar una plantilla Excel oficial

FinTrack debe incluir un boton en Configuracion o Administracion:

**Importar datos desde Excel**

El flujo ideal:

1. El usuario descarga una plantilla Excel de FinTrack.
2. La plantilla viene con hojas por modulo y catalogos prellenados.
3. El usuario completa solo las hojas que desea migrar.
4. Sube el archivo.
5. FinTrack analiza el archivo sin guardar nada todavia.
6. Se muestra una vista previa con:
   - filas validas
   - errores bloqueantes
   - advertencias
   - nuevos catalogos detectados
   - saldos proyectados por portafolio
7. El usuario confirma la importacion.
8. FinTrack guarda los datos por fases internas y genera un reporte final.

### Por que no importar Excel libre desde el inicio

Un Excel libre da mas flexibilidad, pero aumenta mucho el riesgo de:

- columnas mal nombradas
- fechas ambiguas
- monedas no reconocidas
- cuentas duplicadas
- categorias escritas de varias formas
- saldos finales inconsistentes
- transacciones enlazadas a cuentas inexistentes

La plantilla oficial reduce errores y hace que la experiencia sea mas confiable para usuarios no tecnicos.

## 3. Ubicacion en la app

La funcionalidad debe vivir en:

- **Configuracion > Datos > Importar**
- Acceso secundario desde **Administracion**, porque muchos datos importados crean o usan catalogos.

En Configuracion, la seccion Datos podria quedar asi:

- Exportar informacion
- Importar desde Excel
- Historial de importaciones

## 4. Estructura de la plantilla Excel

El archivo recomendado: `FinTrack_Plantilla_Migracion.xlsx`

Hojas:

| Hoja | Uso | Obligatoria |
| --- | --- | --- |
| `00_Instrucciones` | Guia rapida, reglas generales, version de plantilla | Interna u oculta |
| `01_Catalogos` | Catalogos internos de soporte | Interna u oculta |
| `03_Ingresos` | Dinero que entra a tus cuentas | No |
| `04_Egresos` | Dinero que sale de tus cuentas | No |
| `05_Transferencias` | Transferencias entre tus propias cuentas | No |
| `06_Compra_Activo` | Compra de activo con alta del activo en la misma hoja | No |
| `07_Por_Cobrar` | Deudores y cuentas por cobrar | No |
| `08_Por_Pagar` | Acreedores y cuentas por pagar | No |

Decisión de producto:

- La importación de movimientos ya no se modela como una sola hoja genérica de transacciones.
- Ahora se divide por tipo de operación, siguiendo el modal real de `Nueva transacción` en FinTrack.
- Los portafolios no se crean desde Excel; se eligen desde la lista existente del usuario.
- Las hojas operativas no deben pedir columnas `clave`.
- `Recurrentes` queda fuera de este flujo de migración inicial para evitar mezclar historial cargado con plantillas futuras.
- `00_Instrucciones`, `01_Catalogos` y `_checks` no deben distraer al usuario en pestañas visibles; pueden quedar ocultas o internas.

## 5. Calidad esperada de la plantilla Excel

La plantilla no debe ser una hoja plana sin controles. Debe entregarse como un archivo Excel estructurado, con formatos, validaciones y ayudas visuales para reducir errores antes de que el usuario suba el archivo.

### Estructura general del libro

Cada hoja de carga debe tener:

- una fila superior con el nombre de la hoja y una descripcion corta
- una fila de encabezados fija y congelada
- filtros activos en la tabla
- columnas obligatorias marcadas visualmente
- ejemplos en las primeras filas o una fila de ejemplo separada
- formatos aplicados por columna
- validaciones de datos en las columnas con valores cerrados
- comentarios o notas en encabezados complejos
- ancho de columnas suficiente para leer el contenido

Hojas internas sugeridas:

| Hoja | Visibilidad | Uso |
| --- | --- | --- |
| `_metadata` | Oculta o protegida | Version de plantilla, fecha de generacion, usuario, moneda base |
| `_listas` | Oculta o protegida | Valores permitidos para desplegables |
| `_catalogos_usuario` | Oculta o protegida | Catalogos existentes del usuario para validacion |
| `_checks` | Visible en modo avanzado | Resumen de errores simples detectables por Excel |

### Formatos por tipo de dato

| Tipo de dato | Formato Excel | Regla |
| --- | --- | --- |
| Claves | Texto | No convertir a numero ni fecha |
| Nombres/descripciones | Texto | Permitir espacios, maximos validados en servidor |
| Fechas | Fecha con formato `yyyy-mm-dd` | No aceptar formatos ambiguos como `dd/mm/yyyy` |
| Montos | Numero con 2 decimales `#,##0.00` | Sin simbolo de moneda en la celda |
| Porcentajes/tasas | Porcentaje o numero decimal controlado | Definir si se espera `18%` o `0.18` |
| Monedas | Texto en mayusculas | Ejemplo: `PEN`, `USD` |
| Si/No | Lista desplegable | Valores exactos: `SI`, `NO` |
| Estados | Lista desplegable | Valores exactos del sistema |
| Tipos/enums | Lista desplegable | Evitar escritura libre |

Regla importante:

Aunque Excel tenga formato de fecha, el backend debe normalizar siempre a `YYYY-MM-DD`. La validacion de Excel ayuda al usuario, pero la validacion real debe hacerse en el servidor.

### Validaciones de datos obligatorias

La plantilla debe usar listas desplegables para todos los campos con valores cerrados:

| Campo | Valores |
| --- | --- |
| tipo_catalogo | `moneda`, `categoria`, `entidad_bancaria`, `tipo_activo` |
| alcance categoria | `INGRESO`, `EGRESO` |
| tipo portafolio | `CHECKING`, `SAVINGS`, `CASH`, `CREDIT_CARD`, `STOCKS`, `ETF`, `CRYPTO`, `OTHER` |
| tipo transaccion | `INCOME`, `EXPENSE`, `TRANSFER` |
| subtipo transaccion | `NORMAL`, `ASSET_PURCHASE`, `RECEIVABLE_LENDING`, `PAYABLE_PAYMENT` |
| forma_pago | `DEBIT`, `CREDIT` |
| tipo_credito | `CREDIT_CARD`, `LINE_OF_CREDIT` |
| estado credito | `ACTIVE`, `CLOSED`, `BLOCKED` |
| estado activo | `ACTIVE`, `SOLD`, `DEPRECIATED` |
| periodicidad presupuesto | `WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY` |
| estado por cobrar | `PENDING`, `PARTIAL`, `COLLECTED`, `WRITTEN_OFF` |
| estado por pagar | `PENDING`, `PARTIAL`, `PAID`, `DISPUTED` |
| activo / incluir_patrimonio | `SI`, `NO` |

Las columnas que referencian registros de otras hojas tambien deben tener desplegables cuando sea posible:

- `portafolio_origen`
- `portafolio_destino`
- `categoria`
- `presupuesto`
- `tarjeta_credito`
- `deudor`
- `acreedor`
- `tipo_activo`
- `entidad_bancaria`

Estas listas deben alimentarse desde las hojas `_listas` y `_catalogos_usuario`. Si el usuario agrega nuevos valores en `01_Catalogos`, la app debe validarlos en el analisis aunque Excel no actualice dinamicamente todos los desplegables.

### Validaciones numericas y de fecha

Reglas aplicables desde Excel:

- `monto`, `saldo_inicial`, `limite_credito`, `valor_compra`, `valor_actual`: numero decimal con maximo 2 decimales.
- Montos transaccionales: mayor que 0.
- `monto_usado`: mayor o igual que 0.
- `monto_usado <= limite_credito`, cuando Excel pueda evaluarlo en la misma fila.
- `monto_cobrado <= monto`.
- `monto_pagado <= monto`.
- `dia_cierre` y `dia_pago`: entero entre 1 y 31.
- fechas: fecha real de Excel, visible como `yyyy-mm-dd`.
- `fecha_fin >= fecha_inicio`, cuando ambas existan.

Limitacion:

Excel puede validar reglas simples, pero las reglas relacionales importantes deben validarse en FinTrack. Por ejemplo: que una categoria sea compatible con el tipo de transaccion, que una tarjeta exista y este activa, o que un presupuesto corresponda a la categoria y fecha.

### Proteccion de plantilla

La plantilla debe proteger:

- nombres de hojas
- encabezados
- filas de instrucciones
- formulas de checks
- hojas internas de listas y metadata

Las celdas de entrada deben quedar desbloqueadas. La proteccion no debe tratarse como seguridad; solo evita ediciones accidentales. La seguridad real sigue estando en backend, RLS y validacion por usuario autenticado.

### Checks dentro del Excel

La plantilla puede incluir una columna opcional `validacion_excel` al final de cada hoja, con formulas simples como:

- faltan obligatorios
- monto invalido
- fecha invalida
- origen y destino iguales
- monto cobrado mayor al monto total
- monto usado mayor al limite

Esto no reemplaza la validacion del servidor. Sirve para que el usuario corrija antes de subir.

### Criterios de aceptacion de la plantilla

Antes de entregar la plantilla a usuarios, debe cumplir:

- todas las hojas principales tienen encabezados bloqueados y filtros activos
- columnas de fecha muestran `yyyy-mm-dd`
- columnas monetarias muestran 2 decimales
- columnas de claves y codigos se mantienen como texto
- campos cerrados tienen listas desplegables
- campos obligatorios estan marcados visualmente
- hay ejemplos claros sin contaminar la importacion real
- la plantilla incluye version interna
- el backend rechaza archivos con version incompatible
- el backend puede importar un archivo completado correctamente sin ajustes manuales

## 6. Hojas y columnas propuestas

### `00_Instrucciones`

Contenido:

- version de plantilla
- fecha de descarga
- moneda principal del usuario
- reglas de fecha: `YYYY-MM-DD`
- formato de montos: numero decimal sin simbolos
- explicacion de columnas obligatorias
- significado de `clave`
- advertencia sobre saldos iniciales

Regla importante:

Si el usuario importa transacciones historicas, el saldo inicial de cada portafolio debe representar el saldo anterior a la primera transaccion importada. Si no tiene historial y solo quiere partir desde hoy, puede registrar el saldo actual como saldo inicial y no llenar transacciones antiguas.

### `01_Catalogos`

Esta hoja debe permitir crear catalogos nuevos y tambien mostrar catalogos existentes.

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| tipo_catalogo | `moneda`, `categoria`, `entidad_bancaria`, `tipo_activo` |
| clave | Identificador amigable |
| nombre | Nombre visible |
| alcance | Para categorias: `INGRESO` o `EGRESO` |
| codigo_moneda | Para monedas: `PEN`, `USD`, `EUR`, etc. |
| simbolo | Simbolo de moneda |
| color | Color opcional |
| icono | Icono opcional |
| activo | `SI` o `NO` |
| notas | Texto opcional |

Reglas:

- Las categorias deben tener alcance unico: ingreso o egreso.
- Las monedas deben convertirse a mayusculas.
- Si una entidad bancaria ya existe con el mismo nombre, se reutiliza.
- Si una categoria ya existe con el mismo nombre y alcance, se reutiliza.

### `02_Portafolios`

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| clave_portafolio | Identificador para referenciar desde otras hojas |
| nombre | Nombre del portafolio |
| entidad_bancaria | Nombre o clave de entidad bancaria |
| tipo | `CHECKING`, `SAVINGS`, `CASH`, `CREDIT_CARD`, `STOCKS`, `ETF`, `CRYPTO`, `OTHER` |
| moneda | Codigo de moneda |
| saldo_inicial | Saldo antes del periodo importado |
| fecha_saldo_inicial | Fecha de corte del saldo inicial |
| incluir_patrimonio | `SI` o `NO` |
| color | Opcional |
| icono | Opcional |
| activo | `SI` o `NO` |
| notas | Opcional |

Reglas:

- `clave_portafolio`, `nombre`, `tipo`, `moneda` y `saldo_inicial` son obligatorios.
- `saldo_inicial` puede ser negativo solo si el tipo de cuenta lo permite.
- Las transacciones deben referenciar `clave_portafolio`, no el nombre visible.
- En la importacion, FinTrack crea el portafolio con `initial_balance` y `balance` iguales al saldo inicial; luego aplica las transacciones importadas para llegar al saldo proyectado.

### `03_Transacciones`

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| clave_transaccion | Identificador unico de la fila |
| tipo | `INCOME`, `EXPENSE`, `TRANSFER` |
| subtipo | `NORMAL`, `ASSET_PURCHASE`, `RECEIVABLE_LENDING`, `PAYABLE_PAYMENT` |
| forma_pago | `DEBIT` o `CREDIT` cuando aplique |
| portafolio_origen | Clave del portafolio origen |
| portafolio_destino | Clave del portafolio destino, solo transferencias |
| tarjeta_credito | Clave del credito si fue consumo o pago con tarjeta |
| fecha | Fecha de operacion |
| categoria | Nombre o clave de categoria |
| presupuesto | Nombre o clave de presupuesto opcional |
| descripcion | Texto visible |
| moneda | Codigo de moneda |
| monto | Monto positivo |
| tipo_cambio | Opcional; requerido si la moneda no coincide con PEN y no se usara tipo de cambio automatico |
| remitente | Para ingresos |
| destinatario | Para egresos |
| deudor | Para cuentas por cobrar |
| acreedor | Para cuentas por pagar |
| notas | Opcional |

Reglas:

- `monto` siempre se importa como valor positivo. El efecto se determina por `tipo`.
- Transferencias requieren origen y destino distintos.
- Ingresos y egresos requieren categoria.
- Si `forma_pago = CREDIT`, debe existir `tarjeta_credito`.
- Si `subtipo = ASSET_PURCHASE`, debe existir una fila relacionada en `05_Activos` o datos minimos suficientes para crear el activo.
- Si `subtipo = RECEIVABLE_LENDING`, debe existir deudor.
- Si `subtipo = PAYABLE_PAYMENT`, debe existir acreedor.

### `04_Creditos`

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| clave_credito | Identificador del credito |
| tipo_credito | `CREDIT_CARD` o `LINE_OF_CREDIT` |
| nombre | Nombre visible |
| entidad_bancaria | Nombre o clave |
| portafolio_asociado | Clave de cuenta si aplica |
| moneda | Codigo de moneda |
| limite_credito | Linea total |
| monto_usado | Consumo actual o capital pendiente |
| tasa_interes | Tasa anual o mensual segun definicion del modulo |
| dia_cierre | Tarjetas |
| dia_pago | Tarjetas |
| estado | `ACTIVE`, `CLOSED`, `BLOCKED` |
| notas | Opcional |

Reglas:

- `monto_usado` no puede superar `limite_credito`.
- Para tarjetas, `dia_cierre` y `dia_pago` deben estar entre 1 y 31.
- Para creditos bancarios, el detalle de cuotas puede agregarse en una version posterior de la plantilla.

### `05_Activos`

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| clave_activo | Identificador del activo |
| clave_transaccion | Transaccion de compra relacionada, si existe |
| nombre | Nombre del activo |
| tipo_activo | Nombre o clave |
| fecha_compra | Fecha |
| moneda | Codigo |
| valor_compra | Monto |
| valor_actual | Monto |
| tasa_depreciacion | Opcional |
| numero_serie | Opcional |
| ubicacion | Opcional |
| estado | `ACTIVE`, `SOLD`, `DEPRECIATED` |
| notas | Opcional |

Reglas:

- Si existe `clave_transaccion`, debe estar en `03_Transacciones`.
- Si no existe transaccion relacionada, el activo se importa como registro patrimonial historico sin afectar caja.
- `valor_actual` no puede ser negativo.

### `06_Presupuestos`

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| clave_presupuesto | Identificador del presupuesto |
| nombre | Nombre visible |
| categoria | Categoria de egreso |
| moneda | Codigo |
| monto | Limite del presupuesto |
| periodicidad | `WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY` |
| fecha_inicio | Fecha |
| fecha_fin | Opcional si FinTrack la calcula |
| estado | `ACTIVE` o `INACTIVE` |
| descripcion | Opcional |

Reglas:

- La categoria debe ser de egreso.
- El monto debe ser positivo.
- No debe duplicar nombre y periodo para el mismo usuario.

### `07_Por_Cobrar`

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| clave_cxc | Identificador de la cuenta por cobrar |
| clave_deudor | Identificador del deudor |
| deudor | Nombre del deudor |
| relacion | Familiar, cliente, amigo, otro |
| fecha | Fecha de origen |
| fecha_vencimiento | Opcional |
| moneda | Codigo |
| monto | Monto total |
| monto_cobrado | Monto ya cobrado |
| concepto | Descripcion corta |
| estado | `PENDING`, `PARTIAL`, `COLLECTED`, `WRITTEN_OFF` |
| portafolio_origen | Clave del portafolio si aplica |
| notas | Opcional |

Reglas:

- `monto_cobrado` no puede superar `monto`.
- Si el estado es `COLLECTED`, el monto cobrado debe igualar el monto total.
- Si se indica portafolio origen, debe existir en `02_Portafolios`.

### `08_Por_Pagar`

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| clave_cxp | Identificador de la cuenta por pagar |
| clave_acreedor | Identificador del acreedor |
| acreedor | Nombre del acreedor |
| relacion | Banco, proveedor, persona, otro |
| fecha | Fecha de origen |
| fecha_vencimiento | Opcional |
| moneda | Codigo |
| monto | Monto total |
| monto_pagado | Monto ya pagado |
| concepto | Descripcion corta |
| estado | `PENDING`, `PARTIAL`, `PAID`, `DISPUTED` |
| portafolio_origen | Clave del portafolio si aplica |
| notas | Opcional |

Reglas:

- `monto_pagado` no puede superar `monto`.
- Si el estado es `PAID`, el monto pagado debe igualar el monto total.
- Si se indica portafolio origen, debe existir en `02_Portafolios`.

### `09_Recurrentes`

Columnas propuestas:

| Columna | Descripcion |
| --- | --- |
| clave_recurrente | Identificador de la recurrente |
| nombre | Nombre visible |
| tipo | `INCOME`, `EXPENSE`, `TRANSFER` |
| subtipo | Opcional |
| portafolio_origen | Clave |
| portafolio_destino | Clave para transferencias |
| categoria | Categoria si aplica |
| presupuesto | Opcional |
| deudor | Opcional |
| acreedor | Opcional |
| moneda | Codigo |
| monto | Monto |
| descripcion | Texto |
| forma_pago | `DEBIT` o `CREDIT` |
| activo | `SI` o `NO` |
| notas | Opcional |

Reglas:

- No crea transacciones pasadas automaticamente.
- Solo crea la regla recurrente para futuras ejecuciones.

## 7. Flujo de importacion en la app

### Paso 1: Descargar plantilla

El usuario elige que modulos quiere migrar:

- Solo portafolios
- Portafolios + transacciones
- Migracion completa
- Modulos especificos

FinTrack genera una plantilla personalizada con:

- catalogos existentes del usuario
- monedas activas
- entidades bancarias existentes
- categorias existentes
- ejemplos por modulo
- version de plantilla

### Paso 2: Subir archivo

El usuario sube `.xlsx`.

Validaciones iniciales:

- extension valida
- tamano maximo recomendado: 10 MB en MVP
- plantilla reconocida
- version compatible
- hojas requeridas presentes
- encabezados sin cambios criticos

### Paso 3: Analisis y validacion

FinTrack procesa el archivo con `exceljs`, que ya esta disponible en el proyecto.

El analisis debe producir:

- total de filas por hoja
- filas validas
- errores bloqueantes
- advertencias
- catalogos nuevos detectados
- duplicados internos
- duplicados contra datos existentes
- saldo inicial por portafolio
- saldo proyectado despues de transacciones

Tipos de validacion:

- **Estructural:** hojas, columnas, version de plantilla.
- **Formato:** fechas, montos, codigos, valores permitidos.
- **Relacional:** portafolios, categorias, deudores, acreedores y creditos referenciados.
- **Negocio:** reglas de FinTrack, saldos, estados, limites de credito.
- **Seguridad:** que nada intente escribir fuera del usuario autenticado.

### Paso 4: Vista previa

Antes de guardar:

- resumen general por modulo
- tabla de errores por hoja/fila/columna
- advertencias no bloqueantes
- preview de datos que se crearan
- saldos proyectados por portafolio
- boton para descargar reporte de errores

Estados posibles:

- **Listo para importar:** sin errores bloqueantes.
- **Importable con advertencias:** puede continuar, pero se muestran riesgos.
- **Requiere correccion:** errores bloqueantes.

### Paso 5: Confirmar importacion

El usuario confirma con una accion explicita:

`Importar datos`

La app crea un registro de importacion y ejecuta la carga en orden:

1. Catalogos
2. Portafolios
3. Creditos
4. Presupuestos
5. Deudores y acreedores
6. Transacciones
7. Activos vinculados o historicos
8. Cuentas por cobrar y por pagar
9. Recurrentes
10. Alertas derivadas, si aplica

### Paso 6: Resultado final

Al terminar:

- mostrar total creado por modulo
- mostrar filas omitidas
- mostrar advertencias finales
- enlazar al historial de importaciones
- permitir descargar reporte final

## 8. Modelo tecnico recomendado

### Nuevas rutas API

| Ruta | Uso |
| --- | --- |
| `GET /api/imports/excel/template` | Genera y descarga plantilla personalizada |
| `POST /api/imports/excel/analyze` | Recibe Excel, valida y genera preview |
| `POST /api/imports/excel/commit` | Confirma una importacion previamente analizada |
| `GET /api/imports` | Lista historial de importaciones |
| `GET /api/imports/[id]` | Detalle y reporte |

### Nuevas tablas sugeridas

`import_jobs`

| Campo | Descripcion |
| --- | --- |
| id | UUID |
| user_id | Usuario |
| status | `DRAFT`, `VALIDATED`, `COMMITTED`, `FAILED`, `CANCELLED` |
| template_version | Version usada |
| file_name | Nombre original |
| file_url | Ruta privada opcional en Storage |
| summary | JSON con conteos por modulo |
| error_count | Total errores |
| warning_count | Total advertencias |
| created_at | Fecha |
| committed_at | Fecha de confirmacion |

`import_job_rows`

| Campo | Descripcion |
| --- | --- |
| id | UUID |
| import_job_id | Importacion |
| sheet_name | Hoja |
| row_number | Numero de fila |
| row_key | Clave de usuario |
| status | `VALID`, `WARNING`, `ERROR`, `IMPORTED`, `SKIPPED` |
| payload | JSON normalizado |
| errors | JSON de errores |
| warnings | JSON de advertencias |
| target_table | Tabla destino |
| target_record_id | Registro creado |

Estas tablas permiten validar primero, guardar el preview y confirmar despues sin volver a interpretar el Excel desde cero.

### Servicios internos

Archivos sugeridos:

| Archivo | Responsabilidad |
| --- | --- |
| `lib/imports/excel-template.ts` | Construir plantilla Excel |
| `lib/imports/excel-parser.ts` | Leer workbook y normalizar hojas |
| `lib/imports/import-validator.ts` | Validar estructura, formatos y reglas |
| `lib/imports/import-committer.ts` | Guardar datos por orden de dependencia |
| `lib/imports/import-report.ts` | Generar reporte de errores/resultados |
| `app/api/imports/excel/template/route.ts` | Endpoint de descarga |
| `app/api/imports/excel/analyze/route.ts` | Endpoint de analisis |
| `app/api/imports/excel/commit/route.ts` | Endpoint de confirmacion |

### Libreria Excel

El proyecto ya tiene `exceljs` en `package.json`, por lo que no se necesita instalar una libreria adicional para leer y generar `.xlsx`.

Para una plantilla mas cuidada, `exceljs` permite:

- hojas
- estilos
- colores
- anchos de columna
- filtros
- listas desplegables basicas
- celdas bloqueadas
- comentarios/notas

## 9. Reglas criticas de negocio

### Saldos

El saldo final de cada portafolio se calcula como:

`saldo_inicial + ingresos - egresos +/- transferencias`

FinTrack debe mostrar este saldo proyectado antes de importar.

Si el saldo proyectado no coincide con el saldo esperado por el usuario, la importacion puede continuar, pero debe mostrar advertencia clara.

### Duplicados

La importacion debe detectar:

- claves duplicadas dentro del Excel
- portafolios con mismo nombre y moneda
- categorias repetidas por nombre y alcance
- transacciones muy parecidas: misma fecha, portafolio, monto, tipo y descripcion

En MVP, la importacion debe evitar duplicar registros si se sube el mismo archivo dos veces usando `clave` + `import_job_id` + huella de fila.

### Fechas

Todas las fechas deben normalizarse a `YYYY-MM-DD`.

No se debe aceptar fecha ambigua como `03/04/2026`, porque puede significar 3 de abril o 4 de marzo segun configuracion regional.

### Monedas y tipo de cambio

Reglas:

- `PEN` y `USD` deben ser soportadas desde el MVP.
- Si la transaccion esta en moneda distinta a la moneda principal, se usa `tipo_cambio` si fue llenado.
- Si no hay `tipo_cambio`, FinTrack puede usar el endpoint interno de tipo de cambio solo cuando exista dato disponible para esa fecha.
- Si no se puede determinar equivalencia, la fila queda bloqueada.

### Adjuntos

No se recomienda importar adjuntos en la primera version.

Razon:

- Excel no es buen contenedor para comprobantes.
- Los archivos pueden hacer pesada la importacion.
- Ya existe bucket `attachments` y su manejo debe ser controlado por modulo.

Se puede agregar una columna `ruta_adjunto` en una fase posterior, pero la primera version debe enfocarse en data estructurada.

## 10. Experiencia de usuario

### Pantalla principal

Elementos:

- boton `Descargar plantilla`
- boton `Subir Excel`
- estado del archivo cargado
- resumen por modulo
- tabla de errores
- vista previa de saldos
- historial de importaciones recientes

### Copys recomendados

Titulo:

`Importar datos desde Excel`

Subtitulo:

`Migra tus movimientos y pendientes usando una plantilla segura de FinTrack y los portafolios que ya existen en tu cuenta.`

Estado sin archivo:

`Descarga la plantilla, completa las hojas que necesites y sube el archivo para validarlo antes de importar.`

Error bloqueante:

`Corrige estas filas en tu Excel y vuelve a subirlo. Ningun dato fue guardado.`

Confirmacion:

`Se importaran registros nuevos en tu cuenta. Esta accion no modificara datos existentes sin confirmacion.`

## 11. Implementacion por fases

### Fase 1: MVP seguro

Objetivo:

Importar la base minima para que un usuario migre su vida financiera principal.

Incluye:

- descarga de plantilla Excel personalizada
- hojas `00_Instrucciones`, `01_Catalogos`, `02_Portafolios`, `03_Transacciones`
- analisis del archivo
- validacion con errores por fila y columna
- preview de saldos por portafolio
- confirmacion manual
- importacion de catalogos, portafolios y transacciones
- historial basico de importaciones

No incluye:

- adjuntos
- importacion masiva asincrona
- deshacer importacion
- creditos complejos con cronogramas
- conciliacion bancaria

Criterio de salida:

- Un usuario puede crear portafolios y movimientos historicos desde Excel sin romper saldos.

### Fase 2: Modulos completos

Objetivo:

Extender la migracion a los modulos operativos de FinTrack.

Incluye:

- `04_Creditos`
- `05_Activos`
- `06_Presupuestos`
- `07_Por_Cobrar`
- `08_Por_Pagar`
- `09_Recurrentes`
- validaciones relacionales entre transacciones y modulos derivados
- creacion de deudores y acreedores desde plantilla
- generacion de alertas derivadas cuando aplique

Criterio de salida:

- Un usuario puede migrar no solo movimientos, sino tambien obligaciones, activos, presupuestos y reglas recurrentes.

### Fase 3: Robustez y control avanzado

Objetivo:

Hacer que la importacion sea resistente para archivos grandes y escenarios reales.

Incluye:

- procesamiento asincrono para archivos grandes
- reporte descargable de errores
- idempotencia fuerte para evitar duplicados al reintentar
- opcion de deshacer una importacion completa
- soporte para mapping manual de columnas en archivos no oficiales
- soporte opcional para ZIP de adjuntos
- pruebas E2E de importacion

Nota operativa:

- El rollback automatico requiere que la importacion haya sido confirmada con metadata de reversión `rollback-v1`. Los jobs confirmados antes de esta mejora deben reimportarse con la plantilla actual para tener deshacer seguro.

Criterio de salida:

- La importacion puede usarse en produccion con usuarios reales y bajo riesgo operativo.

## 12. Skills y dependencias

Para elaborar este documento se uso el skill **Spreadsheets** como referencia conceptual para buenas practicas de plantillas Excel, pero no se genero un `.xlsx` en esta tarea.

Para implementar la funcionalidad en codigo:

- No hace falta instalar skills adicionales.
- No hace falta instalar libreria Excel adicional porque el proyecto ya tiene `exceljs`.
- Si luego quieres que cree la plantilla `.xlsx` real y verificada, si conviene usar el skill **Spreadsheets** para construir el archivo final con formato, hojas, validaciones y revision visual.

Skills opcionales para fases futuras:

| Skill | Cuando usarlo |
| --- | --- |
| Spreadsheets | Crear la plantilla Excel real y reportes `.xlsx` |
| impeccable o frontend-design | Disenar la pantalla de importacion y vista previa |
| ui-ux-design-pro | Auditar la experiencia completa de migracion antes de implementarla |

## 13. Riesgos y decisiones pendientes

### Riesgos

- Saldos incorrectos si el usuario mezcla saldo actual con transacciones historicas.
- Duplicados si el usuario reimporta un archivo editado.
- Categorias creadas con nombres casi iguales.
- Tipos de cambio historicos incompletos.
- Archivos muy grandes que excedan tiempo de respuesta serverless.
- Usuarios editando nombres de hojas o encabezados clave.

### Decisiones pendientes

1. Definir si Fase 1 permitira solo `PEN` y `USD` o todas las monedas activas.
2. Definir limite maximo de filas por archivo en MVP.
3. Definir si se permitira actualizar registros existentes o solo crear nuevos.
4. Definir si se guardara el archivo original en Supabase Storage.
5. Definir si el usuario podra deshacer una importacion desde el historial.

## 14. Recomendacion final

Construir primero una importacion controlada por plantilla oficial. El MVP debe enfocarse en portafolios y transacciones, porque son la base del dashboard, saldos, reportes y patrimonio.

Despues, extender a creditos, activos, presupuestos, cuentas por cobrar, cuentas por pagar y recurrentes. Esta ruta reduce el riesgo y permite validar la parte mas delicada: que la data importada produzca saldos correctos y sea confiable desde el primer uso.
