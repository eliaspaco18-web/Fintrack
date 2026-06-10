const { URL } = require('node:url')

function buildSupabaseRemotePatterns() {
  const patterns = []
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()

  if (!rawUrl) return patterns

  try {
    const url = new URL(rawUrl)
    patterns.push({
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      pathname: '/storage/v1/object/sign/attachments/**',
    })
  } catch {
    // Si la URL no es válida, dejamos la lista vacía para no romper el build.
  }

  return patterns
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: buildSupabaseRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
