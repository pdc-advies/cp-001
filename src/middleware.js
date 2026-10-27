import { NextResponse } from 'next/server'

// Eenvoudige login voor de hele site (pagina's én API) via HTTP Basic Auth.
// Persoonlijke logins in BASIC_AUTH_USERS als "naam:wachtwoord,naam2:wachtwoord2" (geen komma in wachtwoorden);
// de gedeelde login BASIC_AUTH_USER/BASIC_AUTH_PASSWORD blijft daarnaast werken.
// De inlognaam gaat als x-auth-user header mee naar de app (bijv. als auteur van notities).
// Zonder logins blijft de site open (met een waarschuwing in de log), zodat een deploy niet vastloopt.
const USERS = [
  ...(process.env.BASIC_AUTH_USERS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf(':')
      return sep > 0 ? [entry.slice(0, sep), entry.slice(sep + 1)] : null
    })
    .filter(Boolean),
  ...(process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD
    ? [[process.env.BASIC_AUTH_USER, process.env.BASIC_AUTH_PASSWORD]]
    : []),
]

function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Een meegestuurde x-auth-user altijd vervangen, zodat niemand zich als een ander kan voordoen
function nextAs(request, user) {
  const headers = new Headers(request.headers)
  headers.delete('x-auth-user')
  if (user) headers.set('x-auth-user', encodeURIComponent(user))
  return NextResponse.next({ request: { headers } })
}

export function middleware(request) {
  if (!USERS.length) {
    console.warn('BASIC_AUTH_USERS/BASIC_AUTH_USER niet ingesteld: site is niet beveiligd')
    return nextAs(request, null)
  }

  const header = request.headers.get('authorization') || ''
  if (header.startsWith('Basic ')) {
    // atob geeft losse bytes; als UTF-8 lezen zodat namen met accenten kloppen
    const bytes = Uint8Array.from(atob(header.slice(6)), (ch) => ch.charCodeAt(0))
    const decoded = new TextDecoder().decode(bytes)
    const sep = decoded.indexOf(':')
    if (sep !== -1) {
      const name = decoded.slice(0, sep)
      const password = decoded.slice(sep + 1)
      // Altijd alle logins vergelijken, zodat de responstijd niets verraadt
      let match = null
      for (const [u, p] of USERS) {
        const nameOk = safeEqual(name, u)
        const passwordOk = safeEqual(password, p)
        if (nameOk && passwordOk) match = u
      }
      if (match) return nextAs(request, match)
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
