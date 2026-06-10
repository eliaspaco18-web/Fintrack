# Rediseño Total FinTrack

Documento de revisión para la fase 1 del rediseño total y completo de la app.

Referencia visual base:
- `docs/inspiration-screen.png`

Ruta de revisión visual disponible en la app:
- `/design-review`

Objetivo:
- Rediseñar toda FinTrack de punta a punta.
- Mantener la escala cromática principal `blanco + verde oscuro`.
- Unificar `landing`, `auth`, `dashboard`, módulos internos, tablas, formularios, detalles, settings y estados de sistema bajo un solo lenguaje visual.
- Crear primero una fase de aprobación visual antes de implementar todo.

---

## 1. Dirección Visual

### Norte visual
- Minimalista, financiero y premium.
- Mucho blanco y aire.
- Verde oscuro como color estructural, no como decoración excesiva.
- Jerarquía editorial: titulares claros, números protagonistas, módulos ordenados.
- Sensación de producto serio, moderno y confiable.

### Paleta propuesta
- Fondo principal: blanco cálido `#F8F6F1`
- Superficie principal: blanco puro `#FFFFFF`
- Superficie secundaria: gris marfil `#F1EEE7`
- Verde oscuro principal: `#0D4F4A`
- Verde oscuro profundo: `#083A36`
- Verde medio interactivo: `#116B64`
- Verde suave de apoyo: `#DCEFEA`
- Texto principal: `#17312F`
- Texto secundario: `#617472`
- Bordes suaves: `rgba(13, 79, 74, 0.10)`

### Tipografía
- Display: geométrica, compacta y elegante.
- Body: limpia, muy legible y neutra.
- El dashboard y los números deben sentirse más ejecutivos que “app genérica”.

### Principios visuales
- Una sola familia de radios y sombras.
- Una sola lógica de espaciado.
- Cards con aire, no densas.
- Data primero, decoración después.
- Cada pantalla debe sentirse parte del mismo sistema, no de mini-productos distintos.

---

## 2. Propuestas De Mejora Visual

### Sistema general
- Unificar botones, inputs, tablas, modales, badges, pills, tabs y dropdowns.
- Crear una jerarquía tipográfica fija para todas las pantallas.
- Eliminar estilos que hoy compiten entre sí: bloques oscuros, fondos muy distintos y densidades mezcladas.
- Establecer una grilla consistente para escritorio, tablet y móvil.
- Rehacer la iconografía para que tenga un mismo peso visual.

### Navegación y shell
- Sidebar más limpio, más editorial y menos “administrativo”.
- Topbar con mejor título de contexto y acciones rápidas más claras.
- Estados activos más nítidos y elegantes.
- Mejor colapso del sidebar y mejor drawer móvil.
- Footer de perfil y cuenta con un bloque más refinado.

### Cards y widgets
- Cards más blancas, con sombra sutil y bordes suaves.
- Menos ruido decorativo, más estructura.
- KPIs con mejor jerarquía: label, número, delta, contexto.
- Widgets con títulos más claros y acciones más discretas.
- Consistencia entre dashboard y pantallas de módulos.

### Tablas y listados
- Encabezados más premium.
- Filas con más aire y mejor lectura escaneable.
- Acciones compactas pero claras.
- Filtros y búsqueda integrados al lenguaje visual del dashboard.
- Detalles y subtítulos más ordenados.

### Formularios
- Inputs más altos, con más espacio y mejor foco visual.
- Agrupación por secciones más clara.
- Validaciones menos agresivas y más elegantes.
- Modales de creación más limpios y guiados.
- Mejor experiencia para formularios largos, especialmente en transacciones, créditos y settings.

### Dashboard
- Rediseño completo del layout.
- Mayor claridad entre resumen ejecutivo, análisis y operación.
- Mejor uso del espacio lateral y superior.
- Gráficos más sobrios y financieros.
- Accesos rápidos convertidos en componentes verdaderamente premium.

### Landing y auth
- La landing debe vender seriedad, control y claridad.
- Login/registro deben sentirse parte del producto premium, no una pantalla separada.
- Mejor narrativa visual entre marketing y producto.
- Hero público y hero interno deben compartir ADN visual.

---

## 3. Dashboard Nuevo: Blueprint Completo

El dashboard debe convertirse en la pantalla bandera de FinTrack.

### Objetivo del dashboard
- En menos de 10 segundos el usuario debe entender:
  - cuánto tiene
  - cómo va el mes
  - qué está venciendo
  - dónde debe actuar

### Nueva estructura propuesta

#### A. Hero superior
- Balance consolidado
- Variación del mes
- Moneda principal y tipo de cambio
- Acciones rápidas:
  - Nueva transacción
  - Ver movimientos
  - Portafolio
  - Alertas

#### B. Fila KPI ejecutiva
- Patrimonio neto
- Ingresos del mes
- Egresos del mes
- Balance del mes
- Opcional: tasa de ahorro o salud financiera

#### C. Zona analítica principal
- Gráfico principal de flujo de caja
- Gasto por categoría
- Tendencia de 6 meses
- Comparativo mensual o semanal

#### D. Columna de decisiones
- Alertas críticas
- Vencimientos próximos
- Actividad reciente
- Recomendaciones o hallazgos automáticos

#### E. Bloques de módulos
- Portafolio resumido
- Créditos activos
- Activos relevantes
- Cuentas por cobrar y pagar
- Presupuestos en riesgo

#### F. Cierre del dashboard
- Última actualización
- Estado de sincronización
- Accesos a reportes/exportación

### Wireframe conceptual

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ HERO: Balance consolidado | acciones rápidas | tipo de cambio             │
├─────────────────────────────────────────────────────────────────────────────┤
│ KPI 1 │ KPI 2 │ KPI 3 │ KPI 4 │ KPI 5 opcional                            │
├───────────────────────────────────────────────────────┬─────────────────────┤
│ Flujo de caja / tendencia principal                   │ Alertas críticas    │
│                                                       │ Vencimientos        │
│                                                       │ Actividad reciente  │
├───────────────────────────────────────────────────────┴─────────────────────┤
│ Gasto por categoría │ Portafolio │ Créditos │ Activos │ Presupuestos       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cuentas por cobrar y pagar │ Exportación │ Estado del sistema              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Qué debe mejorar frente a la referencia
- Más claridad ejecutiva.
- Menos elementos de relleno.
- Mejor jerarquía de datos reales.
- Más coherencia entre gráficos, cards y navegación.
- Mayor profundidad visual sin perder limpieza.

---

## 4. Rediseño De Toda La App

### 4.1 Landing page
- Hero más sobrio y premium.
- Beneficios explicados con módulos reales del producto.
- Vista previa del dashboard renovado.
- Bloques: confianza, funcionalidades, seguridad, exportación, CTA final.
- Debe sentirse B2B financiero moderno, no landing genérica.

### 4.2 Login / Registro / Recuperación
- Rediseño total con el mismo lenguaje blanco + verde oscuro.
- Panel principal claro y limpio.
- Showcase lateral con previews del producto.
- Mejor segmentación entre login, signup y recovery.
- Experiencia premium y muy confiable.

### 4.3 Shell autenticado
- Sidebar
- Topbar
- Contenedor principal
- Estados activos
- Drawer mobile
- Breadcrumb y jerarquía por sección

### 4.4 Transacciones
- Vista de workspace mucho más limpia.
- Toolbar de filtros superior más refinada.
- Tabla principal rediseñada.
- Modal de nueva transacción más guiado.
- Mejor lectura del tipo, módulo y estado.

### 4.5 Portafolio
- Cards de cuentas y bancos más premium.
- Mejor resumen por saldo, moneda y uso.
- Estados activos/inactivos más elegantes.
- Vista híbrida: resumen superior + listado operativo.

### 4.6 Créditos
- Mejor visualización de deuda, cuotas, vencimientos y riesgo.
- Timeline o plan de pagos visual más claro.
- Mejor lectura de montos, intereses y saldo pendiente.

### 4.7 Activos
- Vista más patrimonial y menos administrativa.
- Cards por activo con valor, depreciación y estado.
- Detalle más visual.

### 4.8 Presupuestos
- Rediseño orientado a control y alerta.
- Barras más claras.
- Lectura rápida de uso vs límite.
- Categorías en riesgo con prioridad visual.

### 4.9 Por cobrar / Por pagar
- Estructura espejo entre ambos módulos.
- Señalización clara de urgencia y vencimiento.
- Tabla y detalle con lenguaje consistente.

### 4.10 Alertas
- Centro de alertas con prioridad real.
- Separación entre crítico, importante e informativo.
- Mejor relación entre alerta y acción recomendada.

### 4.11 Administración
- Categorías, entidades bancarias y parámetros dentro del mismo sistema visual.
- Menos apariencia de “backoffice técnico”.
- Más orden por bloques y subsecciones.

### 4.12 Configuración
- Sidebar secundaria de settings rediseñada.
- Mejor separación entre perfil, seguridad, notificaciones, exportación y soporte.
- Formularios más claros y más confiables.

### 4.13 Páginas de detalle
- Detalles de transacción, crédito, activo, cuenta por cobrar/pagar con:
  - resumen superior
  - datos clave
  - timeline o historial
  - acciones contextuales

### 4.14 Estados del sistema
- Empty states
- Error states
- Loading states
- Toasts
- Confirmaciones
- Estados offline

Todo debe compartir el mismo idioma visual.

---

## 5. Pack De Mockups A Preparar

Para aprobar antes de implementar, recomiendo producir estos mockups:

### Mockup 1. Landing principal
Debe mostrar:
- hero
- propuesta de valor
- preview del dashboard nuevo
- secciones de confianza
- CTA final

### Mockup 2. Login / Registro
Debe mostrar:
- panel de acceso
- lenguaje visual premium
- integración con previews del producto

### Mockup 3. Dashboard completo
Debe mostrar:
- hero ejecutivo
- KPIs
- flujo de caja
- alertas
- actividad reciente
- bloques de módulos

### Mockup 4. Transacciones
Debe mostrar:
- toolbar
- tabla renovada
- filtros
- modal de nueva transacción

### Mockup 5. Portafolio o Créditos
Debe mostrar:
- cómo se ve un módulo operativo completo
- cards + tabla + estados + acciones

### Mockup 6. Configuración
Debe mostrar:
- sidebar secundaria
- formularios
- paneles por categoría

---

## 6. Orden Recomendado De Revisión

1. Aprobación de dirección visual
2. Aprobación de dashboard
3. Aprobación de landing y auth
4. Aprobación de módulo operativo base
5. Extensión al resto de módulos

---

## 7. Criterios De Aprobación

Debemos aprobar estos puntos antes de construir:
- La paleta se siente correcta.
- El dashboard representa bien el producto.
- El lenguaje visual se puede extender a todos los módulos.
- La navegación y shell están suficientemente definidos.
- El estilo es premium y sobrio, no genérico.
- Hay coherencia real entre público, auth y entorno autenticado.

---

## 8. Próximo Paso Recomendado

Siguiente entregable:
- preparar el `mockup visual del nuevo dashboard`
- preparar el `mockup visual de landing`
- preparar el `mockup visual de login/register`

Ese set es suficiente para revisar si el rediseño total va en la dirección correcta antes de rehacer toda la app.
