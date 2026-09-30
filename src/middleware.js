import { NextResponse } from 'next/server'

// Eenvoudige login voor de hele site (pagina's én API) via HTTP Basic Auth.
// Gebruikersnaam en wachtwoord komen uit de omgevingsvariabelen BASIC_AUTH_USER en BASIC_AUTH_PASSWORD.
// Zonder die variabelen blijft de site open (met een waarschuwing in de log), zodat een deploy niet vastloopt.
const USER = process.env.BASIC_AUTH_USER
const PASSWORD = process.env.BASIC_AUTH_PASSWORD

function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function middleware(request) {
  if (!USER || !PASSWORD) {
    console.warn('BASIC_AUTH_USER/BASIC_AUTH_PASSWORD niet ingesteld: site is niet beveiligd')
    return NextResponse.next()
  }

  const header = request.headers.get('authorization') || ''
  if (header.startsWith('Basic ')) {
    const decoded = atob(header.slice(6))
    const sep = decoded.indexOf(':')
    if (sep !== -1 && safeEqual(decoded.slice(0, sep), USER) && safeEqual(decoded.slice(sep + 1), PASSWORD)) {
      return NextResponse.next()
    }
  }

  return new NextResponse('Inloggen vereist', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Contract Register", charset="UTF-8"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
