# Lanzamiento a produccion

## Objetivo
Dejar un proceso repetible para publicar FinTrack en produccion con control de cambios, validacion funcional y criterio claro de rollback.

## Estado base esperado
- `npm run build`: ok
- `npm run typecheck`: ok
- `npm run test:e2e -- tests/e2e/login-ui.spec.ts tests/e2e/auth-redirect.spec.ts`: ok
- Migraciones remotas al dia con `supabase/migrations`
- Variables de entorno configuradas en Vercel y Supabase

## Preflight tecnico
1. Verificar rama, commit y alcance exacto del release.
2. Confirmar que no se mezclen cambios no aprobados para produccion.
3. Ejecutar:
   - `npm run build`
   - `npm run typecheck`
   - `npm run test:e2e -- tests/e2e/login-ui.spec.ts tests/e2e/auth-redirect.spec.ts`
4. Revisar si hay migraciones nuevas en `supabase/migrations`.
5. Confirmar si el release requiere deploy de app, migracion de DB o ambos.

## Preflight de Supabase
1. Confirmar proyecto objetivo:
   - desarrollo
   - staging
   - produccion
2. Aplicar migraciones pendientes.
3. Validar:
   - RLS activa en tablas criticas
   - policies de `bank_entities`, `accounts`, `transactions`, `credits`, `assets`, `accounts_receivable`, `accounts_payable`
   - bucket `attachments` y policies de storage
   - redirects de Auth
   - proveedor SMTP/Resend si hay correos activos
4. Confirmar que no existan seeds de prueba ni usuarios demo que contaminen el entorno.

## Preflight de Vercel
1. Confirmar variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_APP_URL`
   - `CRON_SECRET`
   - cualquier secreto de correo o integracion activa
2. Confirmar dominio final y redirects.
3. Confirmar que `vercel.json` y cron jobs apunten al entorno correcto.

## Suite minima de salida
### Anonima
- login renderiza
- redirects auth funcionan
- build completo sin error

### Autenticada
Requiere `E2E_USER_EMAIL` y `E2E_USER_PASSWORD`.

- Smoke:
  - dashboard
  - portafolio
  - administracion
  - movimientos
- Portafolio:
  - crear cuenta
  - desactivar cuenta
  - eliminar cuenta
- Administracion:
  - crear categoria
  - eliminar categoria
  - crear entidad bancaria
  - desactivar/reactivar entidad bancaria
- Presupuestos:
  - crear presupuesto
  - desactivar/reactivar presupuesto
  - eliminar presupuesto
  - ver presupuesto compatible en movimientos
- Movimientos:
  - crear egreso
  - crear compra de activo
  - eliminar desde tabla
  - eliminar desde detalle
  - quick create de cuenta
  - quick create de categoria
- Creditos:
  - crear tarjeta
  - eliminar tarjeta
- Activos:
  - crear activo
  - eliminar activo
- Por cobrar:
  - crear deudor
  - crear cuenta por cobrar
  - validar cuenta origen en detalle
- Por pagar:
  - crear acreedor
  - crear cuenta por pagar
  - validar cuenta origen en detalle
- Alertas:
  - crear alerta manual
  - resolver alerta

## Checklist funcional post deploy
1. Ingresar con usuario controlado real.
2. Abrir:
   - `/dashboard`
   - `/portfolio`
   - `/transactions`
   - `/credits`
   - `/budgets`
   - `/assets`
   - `/receivables`
   - `/payables`
   - `/alerts`
   - `/admin`
   - `/settings`
3. Confirmar que ningun modulo quede en skeleton infinito.
4. Confirmar que botones visibles de accion respondan con:
   - modal
   - guardado
   - cambio de estado
   - eliminacion
   - toast o feedback equivalente
5. Confirmar que los catalogos no muestren duplicados evidentes.
6. Confirmar que moneda y categoria se comporten segun PRD en `Movimientos`.

## Monitoreo inmediato tras release
Durante los primeros 15 a 30 minutos revisar:
- errores de funciones serverless
- fallos de endpoints de dashboard
- latencia de `/api/dashboard/*`
- latencia de `/api/exchange-rate`
- fallos de autenticacion
- fallos de storage y signed URLs

## Criterio de rollback
Hacer rollback si ocurre cualquiera de estos casos:
- login o navegacion principal deja de funcionar
- un modulo operativo queda bloqueado en carga
- fallan altas o eliminaciones criticas
- una migracion rompe compatibilidad de datos
- aparecen errores repetidos de RLS o permisos

## Estrategia de rollback
1. Revertir deploy en Vercel al ultimo release sano.
2. Si hubo migracion destructiva, evaluar rollback de DB solo con respaldo y plan claro.
3. Congelar nuevos cambios hasta reproducir y aislar el fallo.
4. Dejar incidente documentado con:
   - modulo afectado
   - timestamp
   - ultimo deploy
   - migracion aplicada
   - impacto visible

## Riesgos conocidos a vigilar
- Rate limit de `forgot-password` y `welcome-email` en memoria del proceso.
- Pruebas autenticadas dependen de credenciales E2E configuradas.
- Cambios de schema requieren validar app + DB en conjunto, no por separado.

## Regla de novedades aprobadas
- Toda mejora visible para usuarios debe agregarse primero en [lib/product-updates/registry.ts](/Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/lib/product-updates/registry.ts).
- Esa mejora solo se muestra dentro de la app cuando tiene ventana activa `startsAt` y `endsAt`.
- La leyenda visible por defecto es `Nuevo`.
- Si no esta en ese registro, no debe anunciarse como novedad.

## Flujo recomendado de publicacion
1. Implementar cambio.
2. Validar build, typecheck y suite minima.
3. Aplicar migraciones si corresponde.
4. Preparar entrada en registro de novedades si aplica.
5. Desplegar en Vercel.
6. Ejecutar smoke post deploy.
7. Confirmar monitoreo estable.

## Release automatizado GitHub + Supabase + Vercel
La fuente de verdad pasa a ser tu repositorio local, pero el release se alinea en los tres frentes con un solo disparo controlado.

### Archivos de automatizacion
- Workflow: [.github/workflows/production-release.yml](/Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/.github/workflows/production-release.yml)
- Script local: [scripts/release-production.sh](/Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/scripts/release-production.sh)
- Version actual del producto: [lib/release/current-release.json](/Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/lib/release/current-release.json)

### Que hace el flujo
1. Genera automaticamente la nueva version visible en formato `Vx.y.z.build`.
2. Genera automaticamente un titulo, resumen y mejoras clave del release.
3. Ejecuta checks de salida.
4. Sube tu version local a GitHub.
5. Dispara un workflow manual de GitHub Actions.
6. El workflow:
   - instala dependencias,
   - corre build, typecheck y smoke,
   - aplica migraciones en Supabase,
   - construye y despliega en Vercel Produccion,
   - registra la version publicada en base de datos,
   - envia correo a usuarios con la nueva version y mejoras,
   - y deja listo el aviso in-app para mostrarse solo una vez por usuario.

### Variables y secretos que debes configurar en GitHub
En `Settings > Secrets and variables > Actions`:

#### Repository variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_PROJECT_REF`: `yahocagtrxvevqhhlkln`
- `VERCEL_ORG_ID`: `team_yoQ8LjFAuDbIECvokuYnyerC`
- `VERCEL_PROJECT_ID`: `prj_sD0qAEQHEKYsvCeQBjb0lWJWgGiG`

#### Repository secrets
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`

### Como se usa
Desde tu maquina:

```bash
npm run release:production -- "release: descripcion corta"
```

Ese comando:
- genera automaticamente la siguiente version disponible a partir del manifiesto actual,
- genera automaticamente el titulo, resumen y highlights visibles para usuarios,
- corre checks locales,
- hace `git add -A`,
- crea commit si hay cambios,
- hace `git push` a `main`,
- y si tienes `gh` instalado, dispara el workflow remoto automaticamente.

### Reglas de version
- Formato: `Vx.y.z.build`
- Ejemplo: `V1.1.1.100`
- Por defecto, el comando mantiene la misma serie `x.y.z` y sube solo el `build` en `+1`.
- Si alguna vez quieres cambiar manualmente la serie, puedes usar:

```bash
RELEASE_SERIES=1.2.0 npm run release:production -- "release: descripcion corta"
```

- Si quieres editar el contenido manualmente antes de lanzar, puedes usar modo interactivo:

```bash
RELEASE_INTERACTIVE=true npm run release:production -- "release: descripcion corta"
```

### Como se enteran los usuarios
En cada release exitoso:
1. Se envia un correo con:
   - version publicada,
   - titulo del release,
   - resumen corto,
   - mejoras o correcciones clave.
2. Dentro de la app aparece un mensaje modal solo la primera vez que cada usuario entra despues de esa actualizacion.
3. La version actual queda visible dentro de la interfaz.

### Estilo de comunicacion del release
- El correo se arma con un bloque hero, tarjeta de version y highlights con iconos visuales de `Novedad`, `Mejora` y `Corrección`.
- El popup in-app usa badges, iconos y tarjetas visuales para que el usuario sí lea el cambio y no lo cierre por inercia.

Si no tienes `gh`, el push queda hecho y solo tendrás que lanzar manualmente el workflow `Production Release` desde la pestaña `Actions`.

### Control de salida
El workflow no se dispara en cada push por defecto. Sale solo cuando:
- tú ejecutas el script local, o
- disparas manualmente `Production Release` desde GitHub.

## Nota
El banner estatico de `PRODUCT_UPDATES` puede seguir usandose para campañas o avisos manuales, pero el versionado operativo del release ahora sale del manifiesto dinámico y del workflow de producción.
