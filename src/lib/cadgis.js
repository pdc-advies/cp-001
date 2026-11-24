// Server-side opzoeken van Belgische percelen (CaPaKey).
// 1. Digitale Vlaanderen, Actueel Digitaal Percelenplan (ADP, WFS): dekt Vlaanderen, publiek bereikbaar.
// 2. Terugval voor wat niet in Vlaanderen ligt: federale kadasterdienst (FOD Financiën / AAPD, CadGIS, ArcGIS laag 11).
//    Die dienst is sinds eind 2026 verhuisd naar www.minfin.fgov.be en blokkeert (een deel van) het verkeer;
//    fouten daar worden niet gecachet en bij de volgende aanvraag opnieuw geprobeerd.
// Resultaten per serverproces 24 uur gecachet.
const ADP_URL = 'https://geo.api.vlaanderen.be/Adpf/wfs'
const CADGIS_URL =
  'https://www.minfin.fgov.be/geoservices/arcgis/rest/services/WMS/Cadastral_Layers/MapServer/11/query'
const TTL_MS = 24 * 60 * 60 * 1000
const ADP_BATCH = 50
const CADGIS_BATCH = 100

const cache = globalThis.__cadgisParcelCache ?? (globalThis.__cadgisParcelCache = new Map())

const inList = (keys) => keys.map((k) => `'${k}'`).join(',')

// Oppervlakte (m²) van een WGS84-polygoon op de bol (zelfde methode als turf/area). ADP levert geen oppervlakte mee.
const R = 6378137
const rad = (d) => (d * Math.PI) / 180
function ringArea(ring) {
  let s = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    s += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)))
  }
  return Math.abs((s * R * R) / 2)
}
const polygonArea = (rings) => rings.reduce((a, r, i) => a + (i === 0 ? ringArea(r) : -ringArea(r)), 0)
function geometryArea(g) {
  if (!g) return null
  const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : []
  return Math.round(polys.reduce((a, p) => a + polygonArea(p), 0))
}

async function fetchAdp(capakeys) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'Adpf:Adpf',
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    propertyName: 'CAPAKEY,SHAPE',
    count: String(capakeys.length * 4),
    cql_filter: `CAPAKEY IN (${inList(capakeys)})`,
  })
  const res = await fetch(`${ADP_URL}?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`ADP ${res.status}`)
  const data = await res.json()
  return new Map(
    (data.features ?? []).map((f) => [
      f.properties.CAPAKEY,
      { geometry: f.geometry, grootte: geometryArea(f.geometry), aanduiding: f.properties.CAPAKEY },
    ])
  )
}

async function fetchCadgis(capakeys) {
  const params = new URLSearchParams({
    where: `CaPaKey IN (${inList(capakeys)})`,
    outFields: 'CaPaKey,SuVaCn',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  })
  const res = await fetch(`${CADGIS_URL}?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`CadGIS ${res.status}`)
  const data = await res.json() // geblokkeerd → HTML-pagina → gooit hier
  if (data.error) throw new Error(`CadGIS ${data.error.message}`)
  return new Map(
    (data.features ?? []).map((f) => [
      f.properties.CaPaKey,
      { geometry: f.geometry, grootte: f.properties.SuVaCn ?? geometryArea(f.geometry), aanduiding: f.properties.CaPaKey },
    ])
  )
}

// Vraagt keys in batches op; geeft de gevonden percelen terug en de keys die zeker niet gevonden zijn.
// Bij een fout blijven de keys van die batch onbeslist (undefined), zodat ze niet als 'niet gevonden' gecachet worden.
async function lookup(fetcher, keys, size) {
  const found = new Map()
  const missing = []
  for (let i = 0; i < keys.length; i += size) {
    const batch = keys.slice(i, i + size)
    try {
      const hits = await fetcher(batch)
      for (const k of batch) (hits.has(k) ? found.set(k, hits.get(k)) : missing.push(k))
    } catch {
      // onbeslist laten
    }
  }
  return { found, missing }
}

// Geeft Map<capakey, parcel|null|undefined> terug. null = niet gevonden, undefined = dienst niet bereikbaar.
export async function resolveCapakeys(capakeys) {
  const now = Date.now()
  const todo = [...new Set(capakeys)].filter((k) => {
    const hit = cache.get(k)
    return !hit || now - hit.at > TTL_MS
  })

  if (todo.length) {
    const adp = await lookup(fetchAdp, todo, ADP_BATCH)
    for (const [k, v] of adp.found) cache.set(k, { at: Date.now(), value: v })
    // Niet in Vlaanderen gevonden: federale dienst proberen. Alleen cachen als die ook echt antwoordt.
    const fed = await lookup(fetchCadgis, adp.missing, CADGIS_BATCH)
    for (const [k, v] of fed.found) cache.set(k, { at: Date.now(), value: v })
    for (const k of fed.missing) cache.set(k, { at: Date.now(), value: null })
  }

  const out = new Map()
  for (const k of capakeys) {
    const hit = cache.get(k)
    out.set(k, hit ? hit.value : undefined)
  }
  return out
}
