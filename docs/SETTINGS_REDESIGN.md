# Plan de rediseño del módulo Configuración

Fecha: 2026-05-24  
Estado: Propuesta pendiente de aprobación  
Alcance auditado: `app/(dashboard)/settings/page.tsx`, `components/settings/*`, secciones relevantes de `app/globals.css`

## 0. Criterio de diseño

El módulo debe sentirse como una configuración de fintech SaaS: compacto, confiable, claro y rápido de escanear. La dirección recomendada combina:

- Linear: navegación densa, jerarquía estricta, estados discretos y separación por bordes.
- Stripe: composición limpia, foco fuerte en la acción principal y copy funcional.
- Mercury: tono calmado, superficies sobrias y sensación de producto financiero cuidado.
- FinTrack: mantener `--ft-*` como fuente canónica de tokens y usar los aliases `--c-*` solo como compatibilidad.

Principio rector: Configuración no debe parecer una landing interna. Debe parecer un cockpit de preferencias personales: poco texto, controles cerca del contexto, estado visible y acciones sensibles protegidas.

## 1. Diagnóstico actual

### 1.1 Estructura general

El shell actual de `app/(dashboard)/settings/page.tsx` usa un contenedor central de `max-w-[1100px]`, un header grande con badges, título, descripción, métricas y navegación interna. La intención es premium, pero el resultado consume demasiado espacio antes de que el usuario llegue al control real.

Qué funciona:

- Hay una separación clara por tabs: Perfil, Seguridad, Preferencias, Alertas, Cuentas, Exportar y Soporte.
- La página ya resuelve routing por query param con `?tab=`.
- Los paneles están modularizados en `components/settings/*`.
- Hay tokens globales `--ft-*` y aliases `--c-*`, con soporte light/dark.
- Los formularios ya tienen validación básica, loading states y toasts.

Qué sobra:

- El header repite estado de perfil, correo, vista activa, ventana P6, avatar y métricas que no siempre ayudan a decidir.
- Muchos textos explican la arquitectura de la pantalla en vez de ayudar al usuario. Ejemplos: “La ventana prioriza identidad...” o “La franja inferior separa...”.
- Hay métricas laterales que son metacomentarios de diseño, no información de usuario.
- Los paneles usan muchas tarjetas dentro de tarjetas, con border/radius/shadow repetidos.
- La navegación desktop ocupa una fila amplia con tres grupos de tarjetas, cuando debería ayudar a moverse sin empujar el contenido.

Qué falta:

- Un resumen de cuenta realmente útil y compacto: identidad, email, moneda, estado de seguridad y cantidad de cuentas.
- Una navegación persistente en desktop que reduzca scroll y oriente mejor.
- Una jerarquía clara entre “acciones frecuentes”, “preferencias”, “datos” y “zona sensible”.
- Más edición inline y menos secciones narrativas.
- Estados accesibles completos: `aria-label` en botones icon-only, `aria-describedby` en campos con ayuda, tablist real si se decide usar tabs.
- Reglas de UI propias de settings en `app/globals.css` para no depender de clases Tailwind largas repetidas.

Qué confunde:

- El componente se llama `SettingsSidebar`, pero en desktop se renderiza como grid horizontal, no como sidebar.
- “Notificaciones” aparece como label técnico, pero el usuario pidió “Alertas”; conviene unificar el lenguaje.
- “Exportación” y “Soporte” tienen mucho texto defensivo sobre lo que todavía no existe.
- Perfil y Preferencias duplican moneda base.
- Los badges “Ventana P6” y “Avatar pendiente” compiten con información más importante.
- Algunos textos hablan desde el diseño (“mantuvimos”, “prioriza”, “franja inferior”) y no desde la necesidad del usuario.

### 1.2 Hallazgos UI con criterio Emil/Linear/Stripe/Mercury

| Antes | Después | Por qué |
| --- | --- | --- |
| Header grande con badges, métricas y descripción larga | Header compacto con título, email y una línea de estado accionable | Reduce fricción y deja que el contenido útil aparezca above the fold |
| Navegación desktop como tres tarjetas horizontales | Sidebar sticky de 248px en desktop y segmented tabs horizontales en mobile | Linear usa navegación persistente para páginas de settings; mejora orientación sin ocupar altura |
| Paneles con muchas métricas explicativas | Paneles con filas de setting y máximo un bloque de resumen contextual | Stripe/Mercury priorizan control + consecuencia, no decoración |
| Avatar como bloque grande con presets en grid | Avatar card compacta tipo squircle, iniciales/imagen, estado y acciones secundarias | Menos genérico que círculo; más coherente con el lenguaje de cards y sidebar de FinTrack |
| Copy explicando decisiones de diseño | Copy breve orientado a tarea: qué cambia, dónde impacta | El usuario no necesita leer la arquitectura interna del módulo |
| Transiciones `transform` en muchos hovers de navegación | Microinteracción más contenida: color/border y active scale solo en pressables | Settings es una superficie frecuente; debe sentirse rápida, no flotante |
| Métricas laterales repetidas por sección | Right rail opcional solo cuando agrega confianza o contexto | Evita tarjetas redundantes y libera espacio para formularios |
| Acciones sensibles visibles junto a acciones normales | Zona sensible separada al final, con confirmación clara y menor prominencia visual | Previene errores sin teatralizar el riesgo |

### 1.3 Diagnóstico por archivo

`app/(dashboard)/settings/page.tsx`

- Tiene buen fetching server-side y composición clara.
- El hero es demasiado alto para una página de ajustes.
- Mezcla información contextual con navegación y métricas.
- Usa `PageLayout className="max-w-[1100px]"`, que queda algo estrecho para un layout con sidebar + contenido.
- El estado `profileState` depende de nombre + avatar, pero se presenta como “Perfil completo”, cuando email y moneda también importan.

`components/settings/SettingsSidebar.tsx`

- El nombre promete sidebar, pero el desktop usa una grilla de grupos.
- La navegación tiene buenos iconos y active state, pero cada item es demasiado “card”.
- Mobile usa scroll horizontal correctamente, pero puede convertirse en segmented tabs más livianos.
- Falta semántica si se decide que sean tabs: `role="tablist"`, `role="tab"`, `aria-selected`.

`components/settings/primitives.tsx`

- Las primitivas son útiles, pero favorecen anidación pesada: `SettingsPanel` dentro de shell, `SettingsSubsection` dentro de panel, `SettingsMetric` en varias partes.
- `SettingsBadge` usa uppercase y tracking alto en todo; puede cansar visualmente.
- `SettingsRow` funciona bien como base de settings, pero necesita variante compacta, variante danger y variante con control alineado.
- `SettingsToggle` tiene estado accesible básico, pero puede mejorar con `aria-label`/`aria-labelledby` desde la fila.

`components/settings/ProfileSettingsForm.tsx`

- Es la sección más importante y también la más cargada.
- Avatar ocupa demasiado espacio y se acompaña de textos redundantes.
- La selección de presets tiene buen potencial visual, pero debería sentirse más FinTrack: squircle, tokenized border, estado claro, no grid genérico.
- Hay duplicación: alias aparece como texto, métrica y estado.
- Hay copy interno que puede eliminarse sin perder claridad.

`components/settings/SecuritySettingsPanel.tsx`

- Funcionalmente es sólido: cambio de contraseña, reset por correo, cierre global y eliminación.
- Está demasiado largo para una sola lectura.
- La zona sensible está bien aislada, pero el texto “menos teatral” sobra.
- El botón icon-only de password usa `tabIndex={-1}`; visualmente evita foco extra, pero hay que revisar si la acción sigue siendo accesible por teclado.
- El modal de eliminación tiene buen patrón de confirmación por email.

`components/settings/PreferencesPanel.tsx`

- Las tarjetas de tema son visualmente cuidadas, pero ocupan mucho espacio para una decisión binaria.
- Preferencias mezcla tema, modo privado, moneda y zona horaria; debería ordenarse por impacto: Apariencia, Privacidad, Región.
- Moneda base duplica Perfil. Debe vivir en un solo lugar o mostrarse en Perfil como resumen editable que conduce a Preferencias.
- `privateMode` parece estado local no persistido; hay que confirmar si debe guardarse antes de implementar UI definitiva.

`components/settings/NotificationsPanel.tsx`

- La división crítica/seguimiento es correcta.
- “Alertas” es mejor label de producto que “Notificaciones”.
- Hay demasiados bloques de métricas: cobertura, prioridad, estado, canal, correo, ritmo.
- La acción Guardar queda abajo, lejos de algunos toggles.
- El skeleton existe y coincide con la forma de filas, buen punto a preservar.

`components/settings/AccountsPanel.tsx`

- Es lectura, no edición. Eso está bien, pero debe decirlo con menos texto.
- Las métricas PEN/USD son útiles.
- El inventario en filas es claro, con números tabulares.
- El right rail “Edición/Portafolio” puede comprimirse en un CTA secundario “Gestionar en Portafolio”.

`components/settings/ExportPanel.tsx`

- Es simple y funcional.
- Tiene un solo export disponible; no necesita una estructura tan grande.
- Falta anticipar estados futuros: rango de fechas, tipo de dato, formato.
- Debe advertir sensibilidad sin asustar ni llenar de tarjetas.

`components/settings/SupportPanel.tsx`

- Es honesto al no enlazar placeholders.
- El exceso de copy hace que parezca una explicación de roadmap.
- Los legales pendientes deben mostrarse como estado discreto, no como bloque principal.
- Soporte debería priorizar: contacto, documentación cuando exista, legales.

`app/globals.css`

- El sistema canónico `--ft-*` ya existe y es coherente: warm neutral + teal accent.
- Hay aliases `--c-*` usados extensamente por settings.
- No hay una sección dedicada a settings; la UI depende de clases Tailwind inline.
- Hay tokens de formulario `--ft-form-*` que settings debería aprovechar más directamente.
- Existen tokens de motion (`--ease-out`, `--transition-fast/base`) que ya coinciden con una experiencia sobria.
- Hay estilos de avatar para sidebar (`--sidebar-avatar-border`, `.sidebar-account-avatar`) que pueden inspirar el avatar de settings.

## 2. Propuesta de rediseño

### 2.1 Dirección visual

Dirección: Fintech control room, warm-neutral.

La página debe sentirse como el panel donde el usuario calibra su cuenta, no como una pantalla promocional. Visualmente conviene mantener el fondo cálido `--ft-bg`, superficies `--ft-surface`, bordes suaves `--ft-border` y acento teal `--ft-primary`.

Decisiones:

- Base visual: `--ft-bg`, `--ft-surface`, `--ft-surface-muted`.
- Acento único: `--ft-primary` para foco, active state y acción principal.
- Semánticos: `--ft-danger`, `--ft-warning`, `--ft-success` solo para estados reales.
- Profundidad: borders + surface shifts; sombras mínimas solo en shell principal y overlays.
- Tipografía: mantener `Plus Jakarta Sans` para títulos y `Geist` para UI/body.
- Números: `Geist Mono` o `tabular-nums` en balances y conteos.
- Motion: máximo 150-180ms, solo `transform`, `opacity`, `border-color`, `background-color`; sin animaciones decorativas.

### 2.2 Layout general recomendado

Desktop desde `lg`:

- Shell de página con `max-w-[1240px]` o `max-w-[1280px]`.
- Header compacto de 64-80px:
  - Título: “Configuración”.
  - Subtítulo corto: “Cuenta, seguridad y datos de FinTrack.”
  - Chip de email o usuario actual.
  - Acción secundaria opcional: “Ver perfil” no necesaria si no existe destino real.
- Layout principal en dos columnas:
  - Sidebar sticky de 248px: navegación agrupada.
  - Content panel flexible: sección activa.
- Right rail solo dentro de secciones que realmente lo necesitan, no en todas.

Tablet:

- Header compacto.
- Navegación horizontal sticky bajo header.
- Content full width.

Mobile:

- Header mínimo.
- Segmented scroll horizontal con 7 items.
- Cada panel en una sola columna.
- CTA principal sticky solo si el formulario es largo; evitar sticky en lectura simple.

Proporción recomendada:

```txt
┌────────────────────────────────────────────────────────────┐
│ Configuración                         usuario@correo.com   │
├───────────────┬────────────────────────────────────────────┤
│ Cuenta        │ Perfil                                     │
│ Perfil        │ [Avatar compacto] [Datos visibles]         │
│ Seguridad     │                                            │
│               │ [Filas de settings / formularios]          │
│ Preferencias  │                                            │
│ Apariencia    │                                            │
│ Alertas       │                                            │
│               │                                            │
│ Datos         │                                            │
│ Cuentas       │                                            │
│ Exportar      │                                            │
│               │                                            │
│ Ayuda         │                                            │
│ Soporte       │                                            │
└───────────────┴────────────────────────────────────────────┘
```

### 2.3 Navegación interna

Recomendación: sidebar en desktop + tabs horizontales en mobile.

Por qué no solo tabs:

- Hay 7 secciones, demasiadas para tabs de escritorio sin scroll o wraps raros.
- Settings se beneficia de navegación persistente y agrupada.
- Linear y Stripe settings suelen usar una navegación lateral para categorías.

Por qué no solo sidebar:

- En mobile, un sidebar colapsado añadiría complejidad y ocultaría opciones.
- Un segmented control horizontal es más directo.

Agrupación propuesta:

- Cuenta: Perfil, Seguridad.
- Preferencias: Apariencia y región, Alertas.
- Datos: Cuentas, Exportar.
- Ayuda: Soporte.

Cambio de copy:

- `Notifications` visible como “Alertas”.
- `Exportación` visible como “Exportar”.
- `Preferencias` puede mantenerse, pero dentro se debe titular “Apariencia y región”.

Estado activo:

- Active item con rail izquierdo de 2px o fill suave `--ft-primary-soft`.
- Icono en `--ft-primary`.
- Texto principal en `--ft-text`.
- Evitar shadow grande en navegación.

### 2.4 Avatar propuesto

El avatar debe salir del patrón “foto circular genérica”. FinTrack ya usa un lenguaje de superficies cálidas, radios amplios y cuadrados redondeados. Recomendación: avatar tipo squircle financiero.

Características:

- Forma: rounded square/squircle de 72-88px, no círculo.
- Fondo fallback: gradiente muy sutil con `--ft-primary-soft`, `--ft-surface-muted` y textura/pattern discreto.
- Contenido fallback: iniciales en `Plus Jakarta Sans`, no icono de usuario genérico.
- Imagen subida: object-cover con border tokenizado.
- Estado: pequeño indicador corner badge, no badge textual grande.
- Presets: mantener si son parte del producto, pero reducir a “Elegir avatar” en disclosure o grid compacto.
- Acciones: “Cambiar” como primary/secondary compacto, “Quitar” como texto o ghost danger si existe avatar.

Composición recomendada:

```txt
[ avatar 80x80 ]  Elías P.
                 usuario@correo.com
                 Moneda base: PEN
                 [Cambiar foto] [Quitar]
```

Copy recomendado:

- Mantener: “PNG, JPG o WEBP hasta 5 MB.”
- Eliminar: “Visible en navegación, panel y acciones colaborativas.”
- Eliminar: métrica “Formato PNG · JPG”.
- Eliminar: métrica “Alias sugerido” si el alias no es una entidad real del producto.

### 2.5 Propuesta por sección

#### Perfil

Objetivo: editar identidad y moneda base sin ruido.

Simplificar:

- Convertir el layout a una tarjeta superior de identidad + formulario en filas.
- Quitar “Criterio operativo”.
- Quitar métricas de alias/formato/moneda duplicadas.
- Mantener nombre visible, correo readonly y moneda base si se decide que Perfil es dueño de ese dato.
- Si moneda queda en Preferencias, Perfil solo muestra un link/row “Moneda base: PEN” con CTA “Cambiar en Preferencias”.

Estructura recomendada:

- Header de panel: “Perfil” + “Define cómo aparece tu cuenta en FinTrack.”
- Identity card: avatar, nombre, email, acciones.
- Form group: Nombre visible, correo, moneda base.
- Footer: Guardar cambios.

#### Seguridad

Objetivo: acceso y riesgo, con progresive disclosure.

Simplificar:

- Mantener cambio de contraseña como bloque principal.
- Mover reset por correo y cerrar sesiones a filas compactas.
- Mantener zona sensible al final con separación visual.
- Quitar métricas laterales “Acceso/Correo/Riesgo”.
- Evitar copy como “menos teatral”.
- Revisar accesibilidad del botón mostrar/ocultar contraseña.

Estructura recomendada:

- Cambiar contraseña.
- Recuperación por correo.
- Sesiones.
- Zona sensible.

#### Preferencias

Objetivo: apariencia, privacidad y región.

Simplificar:

- Reemplazar las dos tarjetas grandes de tema por un segmented control o dos tiles compactos.
- Modo privado como fila destacada con toggle.
- Moneda y zona horaria como “Región financiera”.
- Quitar métricas laterales Tema/Privacidad/Contexto.
- Confirmar persistencia de modo privado antes de pulir UX.

Estructura recomendada:

- Apariencia: Tema oscuro/claro.
- Privacidad: Ocultar montos.
- Región: Moneda base, zona horaria.

#### Alertas

Objetivo: decidir qué interrupciones acepta el usuario.

Simplificar:

- Cambiar título visible a “Alertas”.
- Mantener dos grupos: Críticas y Seguimiento.
- Quitar bloque inferior de métricas “Canal principal/Correo/Ritmo”.
- Mantener contador de activas en el header.
- Acercar botón Guardar al estado pendiente.
- Usar badges “Recomendado” solo en alertas críticas realmente recomendadas.

Estructura recomendada:

- Alertas críticas: cuotas vencidas, cuentas por cobrar, cuentas por pagar, actividad inusual.
- Seguimiento: presupuesto, resumen semanal, nueva transacción.
- Footer compacto: “Cambios pendientes” + Guardar.

#### Cuentas

Objetivo: revisar cuentas conectadas y saltar a Portafolio para editar.

Simplificar:

- Mantener métricas Cuentas, Total PEN, Total USD.
- Convertir inventario a tabla/lista más densa.
- Quitar right rail Edición/Lectura.
- Agregar CTA secundario “Gestionar en Portafolio”.
- Empty state más directo.

Estructura recomendada:

- Summary metrics.
- Lista con nombre, tipo, moneda y balance.
- CTA Portafolio en header o footer.

#### Exportar

Objetivo: descargar datos de forma clara y segura.

Simplificar:

- Reducir a una tarjeta/row por export disponible.
- Mantener advertencia de datos sensibles como texto corto.
- Quitar métricas Formato/Cobertura/Cuidado.
- Preparar espacio futuro para filtros, pero no renderizar controles falsos.

Estructura recomendada:

- Archivo: Transacciones CSV.
- Descripción: “Movimientos con fecha, cuenta, categoría y monto.”
- Acción: Descargar.
- Nota: “El archivo puede contener información financiera sensible.”

#### Soporte

Objetivo: contacto y recursos reales.

Simplificar:

- Priorizar correo.
- Mostrar Centro de ayuda, Privacidad y Términos como pendientes discretos.
- Quitar metacopy de “sin placeholders” y “estado real”.
- Mantener versión de app, pero no necesita tres métricas.

Estructura recomendada:

- Contacto: soporte por correo.
- Recursos: ayuda, privacidad, términos.
- App: versión y stack si sirve para soporte.

### 2.6 Texto: eliminar, acortar, mantener

Eliminar:

- “Unificamos perfil, preferencias, notificaciones y seguridad en un shell más compacto...”
- “Ventana P6.”
- “La ventana prioriza identidad a la izquierda...”
- “La franja inferior separa entrega y estado...”
- “Mantuvimos su visibilidad alta, pero sin exageración visual.”
- “Preferimos dejarlo explícito en lugar de simular un enlace.”
- Métricas cuyo valor describe la UI: “Lectura consolidada”, “Prioridad operativa”, “Transparencia sin placeholders”.

Acortar:

- “Ajusta cómo se muestra tu identidad dentro de FinTrack y define la moneda base que usarán tus reportes.”
- Propuesta: “Actualiza tu nombre, avatar y moneda base.”
- “Decide qué eventos financieros merecen una interrupción real...”
- Propuesta: “Elige qué alertas quieres recibir.”
- “Descarga tus datos financieros en un formato limpio...”
- Propuesta: “Exporta tus movimientos para análisis o respaldo.”

Mantener:

- Mensajes de validación claros.
- Límites de archivo.
- Confirmación por correo en eliminación.
- Badges de estado cuando representan algo real: “Activo”, “Pendiente”, “Irreversible”, “Recomendado”.
- Texto legal o de sensibilidad cuando previene errores reales.

### 2.7 Referencias visuales aplicadas

Linear settings:

- Sidebar persistente, agrupación clara y active state sobrio.
- Densidad controlada: filas, no cards gigantes.
- Bordes suaves y muy poca sombra.

Stripe settings:

- Secciones con encabezados claros y controles alineados.
- Copy corto, directo y orientado al efecto del cambio.
- Primaria visible, secundarias contenidas.

Mercury settings:

- Tono financiero calmado.
- Superficies limpias, radios amplios y estados discretos.
- Confianza mediante orden, no mediante exceso de decoración.

## 3. Pasos de implementación

### Paso 1. Reducir shell y navegación

Impacto: alto  
Riesgo: medio  
Archivos:

- `app/(dashboard)/settings/page.tsx`
- `components/settings/SettingsSidebar.tsx`
- `components/settings/config.tsx`

Trabajo:

- Reducir header a título, descripción corta y email/estado.
- Eliminar badges globales no accionables.
- Reemplazar grid de navegación desktop por sidebar sticky.
- Mantener navegación horizontal en mobile.
- Ajustar `PageLayout` a ancho mayor para sidebar + contenido.
- Asegurar `aria-current` o roles de tabs según patrón final.

Criterio de aceptación:

- En desktop el usuario ve navegación y primer bloque de contenido sin scroll excesivo.
- En mobile los 7 destinos siguen accesibles.
- El active state es claro sin depender de sombras grandes.

### Paso 2. Crear primitivas settings más compactas

Impacto: alto  
Riesgo: medio  
Archivos:

- `components/settings/primitives.tsx`
- `app/globals.css`

Trabajo:

- Añadir variantes compactas para `SettingsPanel`, `SettingsSubsection` y `SettingsRow`.
- Reducir dependencia de `SettingsMetric` como bloque decorativo.
- Introducir clases/tokens settings en CSS si conviene: shell, nav, row, avatar, footer.
- Mantener todo conectado a `--ft-*`.
- Mejorar focus visible y active press feedback.

Criterio de aceptación:

- Las secciones usan menos wrappers.
- Los estilos repetidos bajan.
- Los estados hover/focus/disabled siguen consistentes.

### Paso 3. Rediseñar Perfil y avatar

Impacto: alto  
Riesgo: medio-alto  
Archivos:

- `components/settings/ProfileSettingsForm.tsx`
- `lib/constants/avatar-presets.ts` solo si se necesita ajustar presets o fallback
- `app/globals.css` si se agregan clases de avatar

Trabajo:

- Reorganizar Perfil alrededor de una identity card compacta.
- Cambiar avatar a squircle tokenizado.
- Mostrar iniciales/fallback más coherente si no hay imagen.
- Reducir presets a disclosure o bloque secundario.
- Quitar métricas y copy redundante.
- Mantener validación de archivo y APIs actuales.

Criterio de aceptación:

- Avatar se siente parte del sistema FinTrack.
- El formulario principal ocupa menos altura.
- Subir, quitar y seleccionar preset siguen funcionando.

### Paso 4. Reordenar Seguridad

Impacto: alto  
Riesgo: medio  
Archivos:

- `components/settings/SecuritySettingsPanel.tsx`
- `components/settings/primitives.tsx` si se necesita variante danger/inline

Trabajo:

- Mantener cambio de contraseña como bloque principal.
- Convertir reset y sesiones a filas compactas.
- Separar zona sensible al final.
- Revisar accesibilidad de botón mostrar/ocultar contraseña.
- Quitar métricas laterales.

Criterio de aceptación:

- Cambiar contraseña se entiende en menos de 5 segundos.
- Eliminar cuenta sigue protegido por modal y confirmación.
- No hay acciones destructivas cerca de acciones primarias.

### Paso 5. Simplificar Preferencias

Impacto: medio-alto  
Riesgo: medio  
Archivos:

- `components/settings/PreferencesPanel.tsx`
- `components/settings/ProfileSettingsForm.tsx` si se decide mover moneda fuera de Perfil

Trabajo:

- Convertir selector de tema a control compacto.
- Mantener modo privado como setting destacado.
- Agrupar moneda y zona horaria.
- Decidir dueño único de moneda base: Perfil o Preferencias.
- Confirmar persistencia real de `privateMode`.

Criterio de aceptación:

- No hay duplicación de moneda.
- Tema, privacidad y región se entienden como tres decisiones distintas.
- Guardar preferencias solo guarda datos persistentes reales.

### Paso 6. Rediseñar Alertas

Impacto: medio-alto  
Riesgo: bajo-medio  
Archivos:

- `components/settings/NotificationsPanel.tsx`
- `components/settings/config.tsx`

Trabajo:

- Cambiar naming visible a Alertas.
- Mantener skeleton actual, ajustado a filas compactas.
- Quitar métricas redundantes.
- Dejar footer con estado de cambios y botón Guardar.
- Mantener contador de activas.

Criterio de aceptación:

- Los toggles críticos se ven primero.
- El usuario sabe si hay cambios pendientes.
- El botón guardar no queda perdido entre bloques de lectura.

### Paso 7. Compactar Cuentas, Exportar y Soporte

Impacto: medio  
Riesgo: bajo  
Archivos:

- `components/settings/AccountsPanel.tsx`
- `components/settings/ExportPanel.tsx`
- `components/settings/SupportPanel.tsx`

Trabajo:

- Cuentas: tabla/lista densa + CTA Portafolio.
- Exportar: una row de descarga + nota sensible.
- Soporte: contacto primero, pendientes discretos, versión compacta.
- Quitar métricas que no cambian decisiones.

Criterio de aceptación:

- Cada sección cabe mejor en pantalla.
- No hay enlaces falsos.
- Las acciones disponibles están más cerca del contenido.

### Paso 8. Revisión de accesibilidad y estados

Impacto: alto  
Riesgo: bajo  
Archivos:

- `components/settings/*`
- `app/globals.css`

Trabajo:

- Revisar focus-visible en links, toggles, selects, botones y avatar presets.
- Añadir `aria-label` a botones icon-only.
- Asegurar labels y descriptions en inputs.
- Confirmar touch targets de 44px en mobile.
- Verificar contraste en light/dark con `--ft-*`.

Criterio de aceptación:

- Navegación completa por teclado.
- Estados loading/error/empty siguen presentes.
- Ningún control depende solo del color.

### Paso 9. QA visual y funcional

Impacto: alto  
Riesgo: bajo  
Archivos:

- Sin cambios nuevos previstos; revisión de todo el módulo.

Trabajo:

- Probar `/settings` y cada `?tab=`.
- Probar light/dark.
- Probar responsive mobile/tablet/desktop.
- Probar flujos: guardar perfil, avatar, password, reset, preferencias, alertas, export.
- Revisar que no haya copy metadiseño.
- Hacer squint test: navegación, contenido y acción principal deben distinguirse.

Criterio de aceptación:

- El módulo se siente más corto sin perder capacidad.
- El usuario puede ubicar la acción principal de cada sección en una mirada.
- La implementación no cambia APIs ni flujos de datos existentes salvo aprobación explícita.

## 4. Riesgos y decisiones pendientes

Decisiones a confirmar antes de implementar:

- Moneda base: debe vivir en Perfil o en Preferencias, no en ambas con edición completa.
- Modo privado: confirmar si debe persistirse en backend o mantenerse local.
- Avatar presets: confirmar si son parte de identidad de producto o si se pueden ocultar tras disclosure.
- Soporte/legal: confirmar si existen rutas reales para privacidad y términos.
- Sidebar desktop: confirmar si el usuario prefiere navegación lateral persistente o tabs superiores compactos.

Riesgos:

- Rediseñar navegación puede alterar expectativas si usuarios ya aprendieron la grilla horizontal.
- Compactar textos puede ocultar explicaciones útiles para usuarios nuevos si no se conserva ayuda contextual.
- Cambiar avatar visual requiere revisar assets y fallback para evitar imagen estirada o recortes pobres.
- Mover moneda base puede afectar tests o expectativas de APIs si otros módulos asumen que Perfil la edita.

## 5. Resultado esperado

Después del rediseño, Configuración debería:

- Mostrar contenido útil antes, con menos altura desperdiciada.
- Tener navegación clara en desktop y mobile.
- Usar un avatar distintivo y coherente con FinTrack.
- Reducir texto explicativo y mantener solo copy funcional.
- Separar acciones frecuentes, preferencias y riesgo.
- Mantener coherencia total con `--ft-*`, light/dark y el sistema visual existente.
- Sentirse más como Linear/Stripe/Mercury aplicado a fintech personal, no como una colección de cards decorativas.
