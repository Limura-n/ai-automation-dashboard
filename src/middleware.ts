import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Detect localhost via headers (x-forwarded-for, x-real-ip, or host)
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const realIp = request.headers.get('x-real-ip') || ''
  const host = request.headers.get('host') || ''

  // Allow all requests from localhost (127.0.0.1, ::1, or hostname matches localhost)
  const isLocalhost =
    forwardedFor === '127.0.0.1' ||
    forwardedFor === '::1' ||
    forwardedFor === '::ffff:127.0.0.1' ||
    realIp === '127.0.0.1' ||
    realIp === '::1' ||
    realIp === '::ffff:127.0.0.1' ||
    host === 'localhost:3000' ||
    host === 'localhost' ||
    host.startsWith('localhost') ||
    host === '127.0.0.1:3000' ||
    host === '127.0.0.1' ||
    host === '[::1]:3000' ||
    host === '[::1]'

  if (isLocalhost) {
    return NextResponse.next()
  }

  // Require x-api-key header for non-localhost requests
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.API_SECRET_KEY || 'dev-key-change-me'

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
