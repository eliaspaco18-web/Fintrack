import { expect, test } from '@playwright/test'
import {
  ATTACHMENT_DELETE_BLOCKED_MESSAGE,
  ATTACHMENT_LEGACY_REFERENCE_NOTICE,
  ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
  ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
  ATTACHMENT_VERIFICATION_FAILED_MESSAGE,
  getLegacyAttachmentReferenceState,
  hasCreditAttachmentReference,
  hasLegacyAttachmentNoteReference,
  hasStoredAttachmentReference,
  hasTransactionAttachmentReference,
  hasUnsupportedAttachmentWrite,
  wouldReplaceLegacyAttachmentNotes,
} from '@/modules/attachments/attachment-integrity'

test.describe('Attachments legacy and unsupported modules safe behavior', () => {
  test('blocks unsupported Assets, Receivables and Payables writes, including null removal', () => {
    for (const body of [
      { attachment_url: 'legacy/assets/file.pdf' },
      { attachment_url: null },
      { attachment: { name: 'invented.pdf' } },
    ]) {
      expect(hasUnsupportedAttachmentWrite(body, ['attachment_url', 'attachment'])).toBe(true)
    }

    expect(hasUnsupportedAttachmentWrite({ name: 'Valid edit', notes: null }, [
      'attachment_url',
      'attachment',
    ])).toBe(false)
  })

  test('blocks nested billing-cycle statement writes before schemas can strip them', () => {
    expect(hasUnsupportedAttachmentWrite({
      cycles: [{
        billing_month: 8,
        billing_year: 2026,
        statement_url: 'legacy/cycles/statement.pdf',
      }],
    }, ['statement_url', 'statement_file', 'attachment'])).toBe(true)

    expect(hasUnsupportedAttachmentWrite({
      cycles: [{ billing_month: 8, billing_year: 2026 }],
    }, ['statement_url', 'statement_file', 'attachment'])).toBe(false)
  })

  test('preserves stored attachment_url and statement_url by blocking destructive replacement', () => {
    expect(getLegacyAttachmentReferenceState({
      references: ['legacy/attachment.pdf', null],
    })).toBe('PRESENT')
    expect(getLegacyAttachmentReferenceState({
      references: [null, '  ', undefined],
    })).toBe('CLEAR')
    expect(hasStoredAttachmentReference('legacy/statement.pdf')).toBe(true)
  })

  test('fails closed when legacy-reference verification is unavailable', () => {
    expect(getLegacyAttachmentReferenceState({
      references: [],
      verificationFailed: true,
    })).toBe('UNVERIFIED')
  })

  test('preserves legacy note markers and allows unchanged notes', () => {
    const transactionNotes = 'Observación\n[adjunto:recibo.pdf|legacy/path.pdf]'
    const creditNotes = 'Observación\n[adjunto_credito:estado.pdf|legacy/card.pdf]'

    expect(hasTransactionAttachmentReference(transactionNotes)).toBe(true)
    expect(hasCreditAttachmentReference(creditNotes)).toBe(true)
    expect(hasLegacyAttachmentNoteReference(transactionNotes)).toBe(true)
    expect(hasLegacyAttachmentNoteReference(creditNotes)).toBe(true)
    expect(wouldReplaceLegacyAttachmentNotes(transactionNotes, transactionNotes)).toBe(false)
    expect(wouldReplaceLegacyAttachmentNotes(transactionNotes, 'Observación')).toBe(true)
    expect(wouldReplaceLegacyAttachmentNotes(creditNotes, null)).toBe(true)
    expect(wouldReplaceLegacyAttachmentNotes('Sin adjunto', 'Edición válida')).toBe(false)
  })

  test('uses controlled messages without inventing file metadata or exposing internals', () => {
    const messages = [
      ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
      ATTACHMENT_LEGACY_REFERENCE_NOTICE,
      ATTACHMENT_VERIFICATION_FAILED_MESSAGE,
      ATTACHMENT_DELETE_BLOCKED_MESSAGE,
      ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
    ]

    for (const message of messages) {
      expect(message).not.toMatch(/supabase|postgres|bucket|policy|token|secret|storage|https?:\/\//i)
      expect(message.length).toBeGreaterThan(20)
    }
    expect(ATTACHMENT_LEGACY_REFERENCE_NOTICE).toContain('disponibilidad no puede verificarse')
  })

  test('keeps the P01A active-core reference recognizers intact', () => {
    expect(hasStoredAttachmentReference('user-1/transactions/tx-1/file.pdf')).toBe(true)
    expect(hasTransactionAttachmentReference('[adjunto:recibo.pdf|user-1/transactions/tx-1/file.pdf]')).toBe(true)
    expect(hasCreditAttachmentReference('[adjunto_credito:contrato.pdf|user-1/credits/credit-1/file.pdf]')).toBe(true)
  })
})
