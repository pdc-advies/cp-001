// Server-side opzoeken van Belgische percelen bij de federale kadasterdienst (FOD Financiën / AAPD, CadGIS).
// Dekt heel België. De dienst is een ArcGIS MapServer; laag 11 = Cadastral_parcel.
// Per aanvraag max. 100 CaPaKeys; resultaten per serverproces 24 uur gecachet.
const QUERY_URL =
  'https://ccff02.minfin.fgov.be/geoservices/arcgis/rest/services/WMS/Cadastral_Layers/MapServer/11/query'
const TTL_MS = 24 * 60 * 60 * 1000
const BATCH = 100

const cache = globalThis.__cadgisParcelCache ?? (globalThis.__cadgisParcelCache = new Map())

async function fetchBatch(capakeys) {
  const body = new URLSearchParams({
    where: `CaPaKey IN (${capakeys.map((k) => `'${k}'`).join(',')})`,
    outFields: 'CaPaKey,SuVaCn',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  })
  const res = await fetch(QUERY_URL, { method: 'POST', body, cache: 'no-store' })
  if (!res.ok) throw new Error(`CadGIS ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`CadGIS ${data.error.message}`)
  return data.features ?? []
}

// Geeft Map<capakey, parcel|null> terug. null = niet gevonden. Netwerkfouten worden niet gecachet.
export async function resolveCapakeys(capakeys) {
  const now = Date.now()
  const todo = [...new Set(capakeys)].filter((k) => {
    const hit = cache.get(k)
    return !hit || now - hit.at > TTL_MS
  })

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH)
    try {
      const features = await fetchBatch(batch)
      const byKey = new Map(features.map((f) => [f.properties.CaPaKey, f]))
      for (const k of batch) {
        const f = byKey.get(k)
        cache.set(k, {
          at: Date.now(),
          value: f ? { geometry: f.geometry, grootte: f.properties.SuVaCn ?? null, aanduiding: k } : null,
        })
      }
    } catch {
      // volgende aanvraag opnieuw proberen
    }
  }

  const out = new Map()
  for (const k of capakeys) {
    const hit = cache.get(k)
    out.set(k, hit ? hit.value : undefined)
  }
  return out
}
