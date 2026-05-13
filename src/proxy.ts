import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PAGES = ['/', '/login', '/auth/callback', '/auth/confirm']

const PUBLIC_API_PREFIXES = [
  '/api/funding-rates',
  '/api/opportunities',
  '/api/history',
  '/api/stats',
  '/api/depeg-monitor',
  '/api/yield-rates',
  '/api/cex-dex-spread',
  '/api/paper-trades',
  '/api/airdrops',
  '/api/lp-pools',
  '/api/analyze-opportunity',
  '/api/validation',
  '/api/positions',
  '/api/alerts',
  '/api/analyze',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const { response, user } = await updateSession(request)

  // APIs públicas — sem autenticação necessária
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return response
  }

  // Páginas públicas
  if (PUBLIC_PAGES.some((p) => pathname.startsWith(p))) {
    // Utilizador autenticado a tentar aceder /login → redireciona para dashboard
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Todas as APIs são públicas — autenticação feita via MetaMask on-chain
  if (pathname.startsWith('/api/')) {
    return response
  }

  // Páginas privadas sem sessão → /login (apenas settings)
  if (!user && pathname.startsWith('/settings')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  routes: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
