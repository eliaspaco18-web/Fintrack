# Blueprint: Créditos y Alertas (FinTrack)

## 1) Tipos de crédito permitidos

1. Tarjeta de crédito
2. Crédito bancario (hipotecario, vehicular, personal, etc.)

## 2) Datos mínimos por tipo

### Tarjeta de crédito

- `nombre`
- `entidad_financiera`
- `moneda` (PEN/USD)
- `limite_credito`
- `saldo_usado`
- `tasa_interes_mensual`
- `dia_corte`
- `dia_pago`
- `estado` (activo/cerrado/bloqueado)

### Crédito bancario

- `nombre`
- `entidad_financiera`
- `subtipo` (hipotecario, vehicular, libre disponibilidad, pyme, otro)
- `moneda` (PEN/USD)
- `monto_desembolsado`
- `tasa_interes_mensual`
- `fecha_inicio`
- `numero_cuotas`
- `estado` (activo/cancelado/restructurado)

## 3) Cronograma de cuotas recomendado

Para cada cuota:

- `numero_cuota`
- `fecha_vencimiento`
- `capital`
- `interes`
- `seguro`
- `comisiones` (portes, gastos administrativos)
- `otros`
- `cuota_total`
- `estado` (pendiente/pagada/vencida/parcial)
- `fecha_pago_real`
- `mora` (si aplica)

Regla de negocio:

- `cuota_total = capital + interes + seguro + comisiones + otros + mora`

## 4) Relación con transacciones

- Cada pago de cuota se registra en `Transacciones`.
- El pago debe impactar:
  - `Créditos` (actualiza saldo/avance)
  - `Dashboard` (egreso del mes)
  - `Alertas` (quita vencida o cambia prioridad)
- Para tarjetas:
  - compras -> aumentan `saldo_usado`
  - pago -> reduce `saldo_usado`

## 5) Centro de Alertas (prioridad)

Prioridad alta:

- cuota vencida
- tarjeta con utilización >= 95%
- atraso repetido en 2 o más cuotas

Prioridad media:

- cuota vence en <= 7 días
- utilización de tarjeta entre 80% y 94%
- gasto mensual +15% vs mes anterior

Prioridad informativa:

- categoría concentrada (>45% del gasto mensual)
- recordatorio de corte/pago cercano

## 6) Superficies donde deben aparecer alertas

1. Módulo `Alertas` (centro completo)
2. Dashboard (contador + resumen)
3. Módulo `Créditos` (chips por riesgo)
4. Tabla de transacciones (marcas de impacto)

## 7) Fases de implementación sugeridas

1. Unificar UX de tipos de crédito (tarjeta/bancario).
2. Completar cronograma con desglose (capital/interés/seguro/comisiones).
3. Motor de alertas y recomendaciones.
4. Reglas de severidad y notificaciones in-app.
