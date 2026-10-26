import { expect, test } from '@playwright/test'
import { z } from 'zod'
import { apiError } from '@/lib/api/response'
import { readBoundedJsonBody } from '@/lib/api/read-bounded-json-body'

test.describe('bounded JSON request bodies', () => {
  test('Zod v4 does not accumulate an issue for every malformed element past an array limit', () => {
    const schema = z.array(z.object({ amount: z.number() })).max(600)
    const result = schema.safeParse(Array.from({ length: 30_000 }, () => null))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toHaveLength(1)
  })

  test('rejects an oversized declared body before reading it', async () => {
    let pulls = 0
    const request = new Request('http://fintrack.test/api/credits', {
      method: 'POST',
      headers: { 'content-length': '11' },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1
          controller.enqueue(new TextEncoder().encode('{"ok":true}'))
          controller.close()
        },
      }),
      duplex: 'half',
    } as RequestInit)

    const result = await readBoundedJsonBody(request, 10)
    expect(result).toEqual({ ok: false, reason: 'too_large' })
    expect(pulls).toBe(0)
  })

  test('caps chunked requests that omit or understate content length', async () => {
    let canceled = false
    const request = new Request('http://fintrack.test/api/credits', {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"values":'))
          controller.enqueue(new TextEncoder().encode('[1,2,3]}'))
        },
        cancel() {
          canceled = true
        },
      }),
      duplex: 'half',
    } as RequestInit)

    const result = await readBoundedJsonBody(request, 12)
    expect(result).toEqual({ ok: false, reason: 'too_large' })
    expect(canceled).toBe(true)
  })

  test('parses bodies at the bound and retains invalid JSON behavior below it', async () => {
    const valid = new Request('http://fintrack.test/api/credits', {
      method: 'POST',
      body: '{"installments":[1,2]}',
      headers: { 'content-type': 'application/json' },
    })
    expect(await readBoundedJsonBody(valid, 22)).toEqual({
      ok: true,
      value: { installments: [1, 2] },
    })

    const invalid = new Request('http://fintrack.test/api/credits', {
      method: 'POST',
      body: '{',
    })
    expect(await readBoundedJsonBody(invalid, 10)).toEqual({ ok: false, reason: 'invalid_json' })
  })

  test('maps the payload-size error to HTTP 413 without changing the API envelope', async () => {
    const response = apiError({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'La solicitud supera el tamaño máximo permitido',
    })
    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'La solicitud supera el tamaño máximo permitido',
      },
    })
  })
})
