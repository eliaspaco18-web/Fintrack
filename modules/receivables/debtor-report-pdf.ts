import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import sharp from 'sharp'
import { buildDebtorFinancialHistory, type ReceivableHistoryDocument, type ReceivableHistoryTransaction } from './debtor-financial-history'
import { summarizeObligationCurrencies } from '@/modules/obligations/obligation-currency-presentation'

export type DebtorReportPdfInput = {
  debtor: { name: string; relationship: string | null; initial_debt: number | string | null }
  receivables: ReceivableHistoryDocument[]
  transactions: ReceivableHistoryTransaction[]
  logoSvg: Uint8Array | null
  fonts: { regular: Uint8Array; semibold: Uint8Array; bold: Uint8Array }
  generatedAt: Date
}

const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595
const MARGIN = 34
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2
const COLUMNS = [62, 82, 260, 112, 48, 88, 122]

function safeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value || 'Fecha no verificable'
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatAmount(value: unknown, currency: unknown) {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  if (!Number.isFinite(numeric) || (currency !== 'PEN' && currency !== 'USD')) return 'No verificable'
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)
}

function wrap(value: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = []
  let line = ''
  for (const word of safeText(value).split(' ').filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ''
    let fragment = ''
    for (const character of word) {
      const next = `${fragment}${character}`
      if (fragment && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(fragment)
        fragment = character
      } else fragment = next
    }
    line = fragment
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['-']
}

export async function buildDebtorReportPdf(input: DebtorReportPdfInput) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`Estado de cuenta - ${safeText(input.debtor.name)}`)
  pdf.setAuthor('FinTrack')
  pdf.setSubject('Historial completo de cuenta por cobrar')

  const [regular, semibold, bold] = await Promise.all([
    pdf.embedFont(input.fonts.regular, { subset: true }),
    pdf.embedFont(input.fonts.semibold, { subset: true }),
    pdf.embedFont(input.fonts.bold, { subset: true }),
  ])
  const logoPng = input.logoSvg
    ? await sharp(Buffer.from(input.logoSvg), { density: 576 }).png().toBuffer().catch(() => null)
    : null
  const logo = logoPng ? await pdf.embedPng(logoPng).catch(() => null) : null
  const history = buildDebtorFinancialHistory(input.receivables, input.transactions)
  const verifiedSummary = summarizeObligationCurrencies(input.receivables.map(item => ({
    amount: item.amount,
    settledAmount: item.collected_amount,
    currency: item.currency,
    isOpen: !['COLLECTED', 'WRITTEN_OFF'].includes(item.status.toUpperCase()),
  })))
  const colors = {
    forest: rgb(.05, .31, .27), forestLight: rgb(.09, .38, .33), mint: rgb(.16, .59, .48),
    canvas: rgb(.965, .972, .97), ink: rgb(.11, .16, .15), muted: rgb(.38, .45, .43),
    border: rgb(.86, .89, .87), white: rgb(1, 1, 1), green: rgb(.1, .43, .31),
    greenSoft: rgb(.91, .96, .93), amber: rgb(.57, .37, .1), red: rgb(.64, .25, .23),
  }
  const createdDate = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(input.generatedAt)
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT
  let tablePageIndex = 0

  const drawTop = (first: boolean) => {
    const height = first ? 116 : 66
    const bottom = PAGE_HEIGHT - height
    page.drawRectangle({ x: 0, y: bottom, width: PAGE_WIDTH, height, color: colors.forest })
    page.drawRectangle({ x: 0, y: bottom, width: PAGE_WIDTH, height: 4, color: colors.mint })
    page.drawText('FINTRACK  /  CUENTAS POR COBRAR', { x: MARGIN, y: PAGE_HEIGHT - 25, font: semibold, size: 7.5, color: rgb(.72, .85, .8) })
    page.drawText(first ? 'Estado de cuenta' : 'Historial financiero', { x: MARGIN, y: PAGE_HEIGHT - (first ? 58 : 39), font: bold, size: first ? 24 : 15, color: colors.white })
    page.drawText(safeText(input.debtor.name), { x: MARGIN, y: PAGE_HEIGHT - (first ? 80 : 52), font: regular, size: first ? 11 : 9, color: rgb(.86, .92, .89), maxWidth: 590 })
    if (first) {
      const relationship = input.debtor.relationship ? `Relación: ${safeText(input.debtor.relationship)}` : 'Detalle individual del deudor'
      page.drawText(relationship, { x: MARGIN, y: PAGE_HEIGHT - 99, font: regular, size: 8, color: rgb(.72, .83, .78), maxWidth: 500 })
      page.drawText(`Generado ${createdDate}`, { x: 555, y: PAGE_HEIGHT - 99, font: regular, size: 7.5, color: rgb(.72, .83, .78), maxWidth: 190 })
    }
    if (logo) {
      const size = first ? 62 : 42
      const headerBottom = PAGE_HEIGHT - height
      page.drawImage(logo, { x: PAGE_WIDTH - MARGIN - size, y: headerBottom + (height - size) / 2, width: size, height: size })
    }
    y = PAGE_HEIGHT - height - (first ? 17 : 17)
  }

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 20, width: TABLE_WIDTH, height: 22, color: colors.forestLight })
    let x = MARGIN
    ;['Fecha', 'Tipo', 'Descripción', 'Cuenta', 'Moneda', 'Importe', 'Estado'].forEach((label, index) => {
      page.drawText(label, { x: x + 6, y: y - 13.5, font: semibold, size: 7, color: colors.white, maxWidth: COLUMNS[index]! - 10 })
      x += COLUMNS[index]!
    })
    y -= 25
  }

  drawTop(true)
  page.drawText('Resumen financiero', { x: MARGIN, y, font: bold, size: 12, color: colors.ink })
  y -= 18
  const cards = verifiedSummary.summaries
  const cardGap = 12
  const cardWidth = (TABLE_WIDTH - cardGap) / 2
  if (cards.length === 0) {
    page.drawRectangle({ x: MARGIN, y: y - 77, width: TABLE_WIDTH, height: 72, color: colors.canvas, borderColor: colors.border, borderWidth: .7 })
    page.drawText('Sin importes verificables en PEN o USD', { x: MARGIN + 14, y: y - 31, font: semibold, size: 10, color: colors.ink })
    page.drawText('Los registros con moneda o importe incompleto se identifican en el historial y no se estiman.', { x: MARGIN + 14, y: y - 49, font: regular, size: 8, color: colors.muted })
  }
  cards.forEach((item, index) => {
    const x = MARGIN + index * (cardWidth + cardGap)
    const bottom = y - 80
    const recovery = item.total > 0 ? Math.min(100, Math.max(0, item.settled / item.total * 100)) : null
    page.drawRectangle({ x, y: bottom, width: cardWidth, height: 76, color: colors.canvas, borderColor: colors.border, borderWidth: .7 })
    page.drawRectangle({ x, y: bottom, width: 3, height: 76, color: item.currency === 'PEN' ? colors.mint : rgb(.38, .59, .83) })
    page.drawText(item.currency, { x: x + 13, y: y - 17, font: bold, size: 9, color: colors.forest })
    const metrics = [
      { label: 'Documentado', value: formatAmount(item.total, item.currency), color: colors.ink },
      { label: 'Cobrado', value: formatAmount(item.settled, item.currency), color: colors.green },
      { label: 'Pendiente', value: formatAmount(item.pending, item.currency), color: colors.amber },
    ]
    const metricWidth = (cardWidth - 28) / 3
    metrics.forEach((metric, metricIndex) => {
      const mx = x + 13 + metricIndex * metricWidth
      page.drawText(metric.label, { x: mx, y: y - 34, font: regular, size: 6.7, color: colors.muted, maxWidth: metricWidth - 7 })
      page.drawText(metric.value, { x: mx, y: y - 48, font: semibold, size: 8, color: metric.color, maxWidth: metricWidth - 7 })
    })
    const barX = x + 13
    const barY = y - 66
    const barWidth = cardWidth - 126
    page.drawRectangle({ x: barX, y: barY, width: barWidth, height: 4, color: colors.border })
    if (recovery !== null) page.drawRectangle({ x: barX, y: barY, width: barWidth * recovery / 100, height: 4, color: colors.green })
    page.drawText(recovery === null ? 'Recuperación no calculable' : `${recovery.toFixed(1)}% recuperado`, { x: x + cardWidth - 107, y: y - 68, font: semibold, size: 7, color: recovery === null ? colors.muted : colors.green, maxWidth: 95 })
  })
  y -= 93
  const initialDebt = Number(input.debtor.initial_debt ?? 0)
  if (Number.isFinite(initialDebt) && initialDebt > 0) {
    page.drawText('Saldo inicial sin moneda verificable; excluido de los totales por moneda.', { x: MARGIN, y, font: regular, size: 7.5, color: colors.amber, maxWidth: TABLE_WIDTH })
    y -= 11
  }
  if (verifiedSummary.unverifiedRecordCount > 0) {
    page.drawText(`${verifiedSummary.unverifiedRecordCount} cuenta(s) con importe, cobro o moneda no verificable; excluida(s) de los totales confirmados.`, { x: MARGIN, y, font: regular, size: 7.5, color: colors.amber, maxWidth: TABLE_WIDTH })
    y -= 11
  }
  page.drawText(`Historial completo - ${history.length} registros - independiente de los filtros visibles`, { x: MARGIN, y, font: semibold, size: 9, color: colors.ink })
  y -= 17
  drawTableHeader()

  for (const entry of history) {
    const description = entry.description?.trim() || (entry.source === 'obligation' ? 'Cuenta por cobrar' : 'Movimiento sin descripción')
    const typeLabel = entry.type === 'INCOME' ? 'Cobro' : 'Préstamo'
    const account = entry.accountName || 'Sin cuenta'
    const amount = formatAmount(entry.amount, entry.currency)
    const status = entry.source === 'transaction' ? 'Registrado' : ({ COLLECTED: 'Cobrado', PARTIAL: 'Parcial', PENDING: 'Pendiente', WRITTEN_OFF: 'Castigado' }[entry.status.toUpperCase()] ?? 'No verificable')
    const descLines = wrap(description, regular, 7.35, COLUMNS[2]! - 12)
    const accountLines = wrap(account, regular, 7.1, COLUMNS[3]! - 12)
    const lineCount = Math.max(descLines.length, accountLines.length)
    let lineOffset = 0
    while (lineOffset < lineCount) {
      if (y - 35 < 38) {
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        tablePageIndex += 1
        drawTop(false)
        drawTableHeader()
      }
      const availableHeight = y - 38
      const fragmentLineCount = Math.min(lineCount - lineOffset, Math.max(1, Math.floor((availableHeight - 10) / 8.6)))
      const rowHeight = Math.max(24, fragmentLineCount * 8.6 + 10)
      const top = y
      if (tablePageIndex % 2 === 0) page.drawRectangle({ x: MARGIN, y: top - rowHeight, width: TABLE_WIDTH, height: rowHeight, color: rgb(.982, .988, .984) })
      let x = MARGIN
      const baseY = top - 14
      const firstFragment = lineOffset === 0
      ;[firstFragment ? formatDate(entry.date) : '', firstFragment ? typeLabel : 'Continúa'].forEach((value, index) => {
        if (value) page.drawText(value, { x: x + 5, y: baseY, font: regular, size: 7.1, color: index === 1 ? (entry.type === 'INCOME' ? colors.green : colors.red) : colors.muted, maxWidth: COLUMNS[index]! - 10 })
        x += COLUMNS[index]!
      })
      descLines.slice(lineOffset, lineOffset + fragmentLineCount).forEach((line, index) => page.drawText(line, { x: x + 5, y: baseY - index * 8.6, font: firstFragment && index === 0 ? semibold : regular, size: 7.35, color: colors.ink, maxWidth: COLUMNS[2]! - 12 }))
      x += COLUMNS[2]!
      accountLines.slice(lineOffset, lineOffset + fragmentLineCount).forEach((line, index) => page.drawText(line, { x: x + 5, y: baseY - index * 8.6, font: regular, size: 7.1, color: colors.muted, maxWidth: COLUMNS[3]! - 12 }))
      x += COLUMNS[3]!
      if (firstFragment) {
        page.drawText(entry.currency || 'No verificable', { x: x + 5, y: baseY, font: regular, size: 7, color: entry.currency ? colors.muted : colors.amber, maxWidth: COLUMNS[4]! - 10 })
        x += COLUMNS[4]!
        page.drawText(`${entry.type === 'INCOME' ? '+' : '-'}${amount}`, { x: x + 4, y: baseY, font: semibold, size: 7.1, color: entry.type === 'INCOME' ? colors.green : colors.red, maxWidth: COLUMNS[5]! - 8 })
        x += COLUMNS[5]!
        page.drawText(status, { x: x + 5, y: baseY, font: regular, size: 7, color: colors.muted, maxWidth: COLUMNS[6]! - 10 })
      }
      page.drawLine({ start: { x: MARGIN, y: top - rowHeight }, end: { x: MARGIN + TABLE_WIDTH, y: top - rowHeight }, thickness: .45, color: colors.border })
      y -= rowHeight
      lineOffset += fragmentLineCount
    }
    if (entry.notes?.trim()) {
      const noteLines = wrap(`Nota: ${entry.notes}`, regular, 7.1, TABLE_WIDTH - 28)
      let noteOffset = 0
      while (noteOffset < noteLines.length) {
        if (y - 35 < 38) {
          page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
          tablePageIndex += 1
          drawTop(false)
          drawTableHeader()
        }
        const availableLines = Math.max(1, Math.floor((y - 38 - 8) / 8.4))
        const fragmentLines = Math.min(noteLines.length - noteOffset, availableLines)
        const noteHeight = fragmentLines * 8.4 + 8
        const top = y
        page.drawRectangle({ x: MARGIN + 4, y: top - noteHeight, width: TABLE_WIDTH - 8, height: noteHeight, color: rgb(.96, .973, .966) })
        noteLines.slice(noteOffset, noteOffset + fragmentLines).forEach((line, index) => page.drawText(line, { x: MARGIN + 11, y: top - 13 - index * 8.4, font: regular, size: 7.1, color: colors.muted, maxWidth: TABLE_WIDTH - 24 }))
        y -= noteHeight + 2
        noteOffset += fragmentLines
      }
    }
  }

  pdf.getPages().forEach((current, index) => {
    current.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_WIDTH - MARGIN, y: 30 }, thickness: .5, color: colors.border })
    current.drawText('FinTrack  /  Reporte de solo lectura', { x: MARGIN, y: 17, font: regular, size: 7, color: colors.muted })
    current.drawText(`Página ${index + 1} de ${pdf.getPageCount()}`, { x: PAGE_WIDTH - MARGIN - 110, y: 17, font: semibold, size: 7, color: colors.muted, maxWidth: 110 })
  })
  return pdf.save()
}
