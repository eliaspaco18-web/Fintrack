import { expect, test } from '@playwright/test'
import {
  ATTACHMENT_CONFIRMATION_MESSAGE,
  ATTACHMENT_DELETE_BLOCKED_MESSAGE,
  ATTACHMENT_TIMEOUT_MESSAGE,
  ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
  AttachmentIntegrityError,
  buildFinancialAttachmentPath,
  hasCreditAttachmentReference,
  hasStoredAttachmentReference,
  hasTransactionAttachmentReference,
  sanitizeAttachmentLabel,
  storeFinancialAttachment,
  type FinancialAttachmentStorage,
} from '@/modules/attachments/attachment-integrity'
import {
  ATTACHMENT_UNVERIFIED_NOTICE,
  AttachmentRequestTimeoutError,
  getAttachmentAvailabilityOutcome,
  requestAttachmentUpload,
} from '@/modules/attachments/attachment-client'

const TEST_FILE = new File(['confirmed attachment'], 'Estado Cuenta Agosto.pdf', {
  type: 'application/pdf',
})

function storageFixture(overrides: Partial<FinancialAttachmentStorage> = {}) {
  const calls = {
    ensureReady: 0,
    upload: [] as Array<{ path: string; contentType: string }>,
    remove: [] as string[],
    signed: [] as string[],
  }

  const storage: FinancialAttachmentStorage = {
    async ensureReady() {
      calls.ensureReady += 1
    },
    async upload(path, _file, contentType) {
      calls.upload.push({ path, contentType })
    },
    async remove(path) {
      calls.remove.push(path)
    },
    async createSignedUrl(path) {
      calls.signed.push(path)
      return `https://files.test/${encodeURIComponent(path)}`
    },
    ...overrides,
  }

  return { storage, calls }
}

function attachmentResponse(
  availability: 'AVAILABLE' | 'UNVERIFIED',
  file = TEST_FILE,
) {
  return new Response(JSON.stringify({
    ok: true,
    data: {
      path: 'user-1/transactions/transaction-1/123-estado-cuenta-agosto.pdf',
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
      signed_url: availability === 'AVAILABLE' ? 'https://files.test/signed' : null,
      availability,
    },
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}

test.describe('Attachments active core integrity', () => {
  for (const module of ['transactions', 'credits'] as const) {
    test(`keeps a successful ${module} upload associated with its authenticated record path`, async () => {
      const { storage, calls } = storageFixture()
      const associatedPaths: string[] = []

      const result = await storeFinancialAttachment({
        userId: 'user-1',
        module,
        recordId: `${module}-1`,
        file: TEST_FILE,
        storage,
        associate: async path => { associatedPaths.push(path) },
        now: () => 123,
      })

      expect(result).toMatchObject({
        path: `user-1/${module}/${module}-1/123-estado-cuenta-agosto.pdf`,
        fileName: TEST_FILE.name,
        fileSize: TEST_FILE.size,
        contentType: TEST_FILE.type,
        availability: 'AVAILABLE',
      })
      expect(associatedPaths).toEqual([result.path])
      expect(calls.upload).toEqual([{ path: result.path, contentType: TEST_FILE.type }])
      expect(calls.remove).toEqual([])
    })
  }

  test('does not associate or invent metadata when storage upload fails', async () => {
    let associationCalls = 0
    const { storage } = storageFixture({
      upload: async () => { throw new Error('sensitive storage response') },
    })

    await expect(storeFinancialAttachment({
      userId: 'user-1',
      module: 'credits',
      recordId: 'credit-1',
      file: TEST_FILE,
      storage,
      associate: async () => { associationCalls += 1 },
    })).rejects.toMatchObject({
      name: 'AttachmentIntegrityError',
      code: 'DATABASE_ERROR',
      message: 'No se pudo guardar el archivo.',
    })

    expect(associationCalls).toBe(0)
  })

  test('removes the uploaded object when record association fails', async () => {
    const { storage, calls } = storageFixture()

    await expect(storeFinancialAttachment({
      userId: 'user-1',
      module: 'transactions',
      recordId: 'transaction-1',
      file: TEST_FILE,
      storage,
      associate: async () => { throw new Error('sensitive database response') },
      now: () => 456,
    })).rejects.toMatchObject({
      name: 'AttachmentIntegrityError',
      code: 'DATABASE_ERROR',
      message: ATTACHMENT_CONFIRMATION_MESSAGE,
      cleanupConfirmed: true,
    })

    expect(calls.remove).toEqual([
      'user-1/transactions/transaction-1/456-estado-cuenta-agosto.pdf',
    ])
  })

  test('reports a controlled atomicity failure if compensation cannot be confirmed', async () => {
    const { storage } = storageFixture({
      remove: async () => { throw new Error('sensitive cleanup response') },
    })

    const error = await storeFinancialAttachment({
      userId: 'user-1',
      module: 'credits',
      recordId: 'credit-1',
      file: TEST_FILE,
      storage,
      associate: async () => { throw new Error('sensitive association response') },
    }).catch(caught => caught)

    expect(error).toBeInstanceOf(AttachmentIntegrityError)
    expect(error).toMatchObject({
      code: 'ATOMICITY_FAILURE',
      cleanupConfirmed: false,
    })
    expect(String(error.message)).not.toMatch(
      /supabase|postgres|bucket|policy|token|secret|sensitive/i,
    )
  })

  test('returns UNVERIFIED when association succeeds but availability cannot be confirmed', async () => {
    const { storage } = storageFixture({
      createSignedUrl: async () => { throw new Error('signing failed') },
    })

    const result = await storeFinancialAttachment({
      userId: 'user-1',
      module: 'credits',
      recordId: 'credit-1',
      file: TEST_FILE,
      storage,
      associate: async () => undefined,
    })

    expect(result).toMatchObject({
      signedUrl: null,
      availability: 'UNVERIFIED',
    })
  })

  test('accepts only confirmed AVAILABLE metadata from the server', async () => {
    const result = await requestAttachmentUpload('/api/test/attachment', TEST_FILE, {
      timeoutMs: 50,
      fetchImpl: async () => attachmentResponse('AVAILABLE'),
    })

    expect(result.file_name).toBe(TEST_FILE.name)
    expect(result.file_size).toBe(TEST_FILE.size)
    expect(getAttachmentAvailabilityOutcome(result)).toEqual({
      kind: 'AVAILABLE',
      message: null,
    })
  })

  test('preserves UNVERIFIED so both Credits and Transactions can warn instead of claiming success', async () => {
    const result = await requestAttachmentUpload('/api/test/attachment', TEST_FILE, {
      timeoutMs: 50,
      fetchImpl: async () => attachmentResponse('UNVERIFIED'),
    })

    expect(result).toMatchObject({ availability: 'UNVERIFIED', signed_url: null })
    expect(getAttachmentAvailabilityOutcome(result)).toEqual({
      kind: 'UNVERIFIED',
      message: ATTACHMENT_UNVERIFIED_NOTICE,
    })
    expect(ATTACHMENT_UNVERIFIED_NOTICE).toContain('no pudo verificarse')
  })

  test('rejects a nominal success whose metadata does not match the selected file', async () => {
    const otherFile = new File(['other'], 'invented.pdf', { type: 'application/pdf' })

    await expect(requestAttachmentUpload('/api/test/attachment', TEST_FILE, {
      timeoutMs: 50,
      fetchImpl: async () => attachmentResponse('AVAILABLE', otherFile),
    })).rejects.toThrow(ATTACHMENT_CONFIRMATION_MESSAGE)
  })

  test('times out a stalled request, aborts it and lets loading be released', async () => {
    let loading = true
    let observedSignal: AbortSignal | undefined

    try {
      await requestAttachmentUpload('/api/test/attachment', TEST_FILE, {
        timeoutMs: 5,
        fetchImpl: (_input, init) => {
          observedSignal = init?.signal ?? undefined
          return new Promise<Response>((_, reject) => {
            observedSignal?.addEventListener('abort', () => {
              reject(new DOMException('transport detail', 'AbortError'))
            }, { once: true })
          })
        },
      })
    } catch (error) {
      expect(error).toBeInstanceOf(AttachmentRequestTimeoutError)
      expect((error as Error).message).toBe(ATTACHMENT_TIMEOUT_MESSAGE)
    } finally {
      loading = false
    }

    expect(observedSignal?.aborted).toBe(true)
    expect(loading).toBe(false)
  })

  test('recognizes only explicit active-core references before destructive actions', () => {
    expect(hasStoredAttachmentReference('user-1/transactions/tx-1/file.pdf')).toBe(true)
    expect(hasStoredAttachmentReference('   ')).toBe(false)
    expect(hasStoredAttachmentReference(null)).toBe(false)
    expect(hasStoredAttachmentReference({ path: 'invented.pdf' })).toBe(false)

    expect(hasCreditAttachmentReference(
      'Nota válida\n[adjunto_credito:estado.pdf|user-1/credits/credit-1/file.pdf]',
    )).toBe(true)
    expect(hasCreditAttachmentReference('Nota sin referencia de archivo')).toBe(false)
    expect(hasTransactionAttachmentReference(
      'Nota válida\n[adjunto:recibo.pdf|user-1/transaction-1/file.pdf]',
    )).toBe(true)
    expect(hasTransactionAttachmentReference('[adjunto_credito:no-es-transaccion]')).toBe(false)
  })

  test('uses controlled non-sensitive messages when an active reference cannot be changed safely', () => {
    for (const message of [
      ATTACHMENT_DELETE_BLOCKED_MESSAGE,
      ATTACHMENT_UPDATE_BLOCKED_MESSAGE,
    ]) {
      expect(message).not.toMatch(/supabase|postgres|bucket|policy|token|secret|storage/i)
      expect(message.length).toBeGreaterThan(20)
    }
  })

  test('sanitizes active-core labels and record-scoped storage paths', () => {
    expect(sanitizeAttachmentLabel(' estado|cuenta]\nagosto.pdf ')).toBe(
      'estado cuenta agosto.pdf',
    )
    expect(buildFinancialAttachmentPath(
      'user/unsafe',
      'credits',
      'credit/unsafe',
      '../Estado Cuenta.pdf',
      789,
    )).toBe('user-unsafe/credits/credit-unsafe/789-..-estado-cuenta.pdf')
  })
})
