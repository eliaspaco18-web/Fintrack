# FinTrack QA Smoke Checklist

## Objetivo
Validar los flujos criticos de la app despues de cambios funcionales y de UI.

## Precondiciones
- Usuario autenticado.
- Existen datos base o permisos para crear datos.
- App levantada con `npm run dev` o validada con `npm run build`.

## Ejecucion automatizada (Playwright)
- Listar pruebas: `npm run test:e2e:list`
- Ejecutar smoke E2E: `npm run test:e2e`
- Ejecutar en UI mode: `npm run test:e2e:ui`
- Para pruebas autenticadas, define variables:
  - `E2E_USER_EMAIL`
  - `E2E_USER_PASSWORD`

## Flujo 1: Nueva transaccion (egreso)
1. Ir a `/transactions/new`.
2. Verificar formulario visible: `transaction-form`.
3. Elegir tipo egreso en `transaction-type-selector`.
4. Ingresar monto en `transaction-amount-input`.
5. Seleccionar cuenta en `transaction-source-account-select`.
6. Seleccionar categoria en `transaction-category-select`.
7. Completar descripcion en `transaction-description-input`.
8. Guardar y confirmar que no hay error global.

Nota automatizada: este flujo esta cubierto en `tests/e2e/authenticated-transactions.spec.ts`
si defines `E2E_USER_EMAIL` y `E2E_USER_PASSWORD`.

## Flujo 2: Quick create de cuenta desde transaccion
1. En `/transactions/new`, click en `transaction-open-quick-account`.
2. Verificar modal `quick-account-modal`.
3. Completar:
   - `quick-account-name-input`
   - `quick-account-institution-input` (opcional)
   - `quick-account-type-select`
   - `quick-account-currency-select`
   - `quick-account-balance-input`
4. Guardar con `quick-create-save` o `Ctrl/Cmd + Enter`.
5. Confirmar:
   - modal cerrado,
   - cuenta seleccionada automaticamente en `transaction-source-account-select`.

Nota automatizada: este flujo esta cubierto en
`tests/e2e/authenticated-quick-create.spec.ts`.

## Flujo 3: Quick create de categoria desde transaccion
1. Click en `transaction-open-quick-category`.
2. Verificar modal `quick-category-modal`.
3. Completar:
   - `quick-category-name-input`
   - `quick-category-scope-select`
   - `quick-category-icon-input`
   - `quick-category-color-input`
4. Guardar con `quick-create-save`.
5. Confirmar categoria disponible/seleccionada en `transaction-category-select`.

Nota automatizada: este flujo esta cubierto en
`tests/e2e/authenticated-quick-create.spec.ts`.

## Flujo 4: Tabla de transacciones (filtros)
1. Ir a `/transactions`.
2. Usar:
   - `transactions-search-input`
   - `transactions-account-filter`
   - `transactions-category-filter`
   - `transactions-sort-select`
   - `transactions-per-page-select`
3. Confirmar que la URL refleja filtros activos.
4. Click en `transactions-reset-filters-button` y validar reset completo.

## Flujo 5: Vistas guardadas de tabla
1. Ajustar filtros.
2. Guardar con `transactions-save-view-button`.
3. Aplicar desde `transactions-saved-view-select`.
4. Cambiar un filtro manualmente y confirmar que la vista deja de estar seleccionada.
5. Eliminar con `transactions-delete-view-button`.

Nota automatizada: este flujo esta cubierto en
`tests/e2e/authenticated-saved-views.spec.ts`.

## Flujo 6: Portafolio
1. Ir a `/portfolio`.
2. Crear cuenta con:
   - `portfolio-form`
   - `portfolio-name-input`
   - `portfolio-type-select`
   - `portfolio-currency-select`
   - `portfolio-initial-balance-input`
3. Editar/desactivar/reactivar con:
   - `portfolio-edit-<id>`
   - `portfolio-deactivate-<id>`
   - `portfolio-reactivate-<id>`
4. Al desactivar, confirmar modal:
   - `portfolio-deactivate-modal`
   - `portfolio-deactivate-cancel-button`
   - `portfolio-deactivate-confirm-button`

Nota automatizada: la conectividad `Portafolio -> Nueva transaccion` esta cubierta
en `tests/e2e/authenticated-management.spec.ts`.
Nota automatizada adicional: desactivar cuenta via modal esta cubierto en
`tests/e2e/authenticated-management.spec.ts`.

## Flujo 7: Administracion de categorias
1. Ir a `/admin`.
2. Crear categoria con:
   - `categories-form`
   - `categories-name-input`
   - `categories-scope-select`
   - `categories-order-input`
3. Editar/eliminar con:
   - `categories-edit-<id>`
   - `categories-delete-<id>`
4. Al eliminar, confirmar modal:
   - `categories-delete-modal`
   - `categories-delete-cancel-button`
   - `categories-delete-confirm-button`

Nota automatizada: la conectividad `Administracion -> Nueva transaccion` esta cubierta
en `tests/e2e/authenticated-management.spec.ts`.
Nota automatizada adicional: eliminar categoria via modal esta cubierto en
`tests/e2e/authenticated-management.spec.ts`.

## Flujo 8: Eliminar transaccion desde tabla
1. Ir a `/transactions`.
2. Buscar una transaccion en `transactions-search-input`.
3. En la fila, usar accion `Eliminar`.
4. Verificar modal `transactions-delete-modal`.
5. Cancelar con `transactions-delete-cancel-button`.
6. Confirmar con `transactions-delete-confirm-button`.
7. Validar que la fila ya no aparezca en resultados.

Nota automatizada: este flujo esta cubierto en
`tests/e2e/authenticated-transactions.spec.ts`.

## Flujo 9: Eliminar transaccion desde detalle
1. Ir a `/transactions`.
2. Abrir una transaccion para entrar a `/transactions/[id]`.
3. Click en `transaction-detail-delete-button`.
4. Verificar modal `transaction-detail-delete-modal`.
5. Cancelar con `transaction-detail-delete-cancel-button`.
6. Reabrir y confirmar con `transaction-detail-delete-confirm-button`.
7. Validar redireccion a `/transactions` y ausencia de la transaccion.

Nota automatizada: este flujo esta cubierto en
`tests/e2e/authenticated-transactions.spec.ts`.

## Flujo 10: Accesibilidad de modales (Escape + foco)
1. Abrir cualquier modal de:
   - `transactions-delete-modal`
   - `portfolio-deactivate-modal`
   - `categories-delete-modal`
   - `quick-account-modal` o `quick-category-modal`
2. Presionar `Esc` y validar cierre del modal.
3. Confirmar que el foco regresa al boton que abrio el modal.

Nota automatizada: este flujo esta cubierto en
`tests/e2e/authenticated-transactions.spec.ts`,
`tests/e2e/authenticated-management.spec.ts` y
`tests/e2e/authenticated-quick-create.spec.ts`.

## Criterio de salida
- Sin errores de runtime.
- Sin bloqueos de navegacion entre modulos.
- `npm run typecheck`, `npm run lint` y `npm run build` en verde.
