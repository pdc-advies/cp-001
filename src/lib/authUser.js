// Inlognaam zoals de middleware die meegeeft; nooit uit de body, zodat de auteur niet te vervalsen is
export function author(request) {
  const raw = request.headers.get('x-auth-user')
  return raw ? decodeURIComponent(raw) : 'onbekend'
}
