// Server-side opzoeken van percelen bij PDOK (BRK Kadastrale Kaart, OGC API Features).
// Resultaten worden per serverproces gecachet: een koude run over alle contracten duurt ~15 s, daarna direct.
const API = 'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items'
const TTL_MS = 24 * 60 * 60 * 1000
const CONCURRENCY = 8

const cache = globalThis.__pdokParcelCache ?? (globalThis.__pdokParcelCache = new Map())

export const parcelKey = (p) => `${p.gemeente}|${p.sectie}|${p.perceelnummer}`

async function fetchParcel(p) {
  const params = new URLSearchParams({
    f: 'json',
    kadastrale_gemeente_waarde: p.gemeente,
    sectie: p.sectie,
    perceelnummer: String(p.perceelnummer),
  })
  const res = await fetch(`${API}?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`PDOK ${res.status}`)
  const data = await res.json()
  const f = data.features?.[0]
  if (!f) return null
  return {
    geometry: f.geometry,
    grootte: f.properties.kadastrale_grootte_waarde ?? null,
    aanduiding: `${f.properties.akr_kadastrale_gemeente_code_waarde} ${f.properties.sectie} ${f.properties.perceelnummer}`,
  }
}

// Geeft Map<key, parcel|null> terug. null = niet gevonden in BRK. Netwerkfouten worden niet gecachet.
export async function resolveParcels(parcels) {
  const now = Date.now()
  const todo = []
  for (const p of parcels) {
    const hit = cache.get(parcelKey(p))
    if (!hit || now - hit.at > TTL_MS) todo.push(p)
  }

  const queue = [...new Map(todo.map((p) => [parcelKey(p), p])).values()]
  async function worker() {
    while (queue.length) {
      const p = queue.shift()
      try {
        cache.set(parcelKey(p), { at: Date.now(), value: await fetchParcel(p) })
      } catch {
        // volgende aanvraag opnieuw proberen
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const out = new Map()
  for (const p of parcels) {
    const hit = cache.get(parcelKey(p))
    out.set(parcelKey(p), hit ? hit.value : undefined)
  }
  return out
}
