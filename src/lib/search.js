// Slim zoeken: één zoekregel die vrije tekst, bedragen, jaren, statussen en velden begrijpt.
// Wordt gebruikt door alle schermen (client) en door het globale zoeken (server, /api/search).
//
// Voorbeelden:
//   SCA0001                       tekst (ook "sca 0001", "SCA-0001")
//   €1000-5000, 1.000 tot 5.000   bedrag tussen (standaardbedrag van het scherm, bv. jaarprijs of factuurtotaal)
//   > 5000, vanaf 1000, max 2k    bedrag ondergrens / bovengrens
//   ov 2024                       onroerende voorheffing over aanslagjaar 2024
//   ov 2023-2025 > 5000           OV in een van die jaren boven € 5.000
//   jaar 2024, in 2023-2025       liep / hoort bij die jaren
//   actief, verlopen, geboekt     status
//   klant:havenbedrijf type:huur land:be debiteur:100734
//
// Een scherm beschrijft zijn records met een schema (zie src/lib/searchSchemas.js):
//   { name, text(r) → string[], amounts: { key: { label, get(r, jaar?) } }, defaultAmount,
//     yearAmounts: ['ov', ...]  (bedragen die per jaar verschillen), inYear(r, jaar) → boolean,
//     status(r) → string, statuses: { woord: waarde }, fields: { key: { label, get(r) } } }

const JAAR_MIN = 1990
const JAAR_MAX = 2100

// Woorden die een bedrag- of jaarsoort aankondigen; de getallen erna horen daarbij
const MAATWOORDEN = [
  [/^(onroerende voorheffing|voorheffing|ov)$/, 'ov'],
  [/^(ozb|onroerendezaakbelasting)$/, 'ozb'],
  [/^(jaarprijs|prijs|huurprijs)$/, 'jaarprijs'],
  [/^(bedrag|bedragen|totaal|factuurbedrag|€|eur|euro)$/, 'bedrag'],
  [/^(contractwaarde|waarde)$/, 'waarde'],
  [/^(m2|m²|oppervlakte|opp)$/, 'm2'],
  [/^(ki|kadastraal inkomen)$/, 'ki'],
  [/^(woz)$/, 'woz'],
  [/^(jaar|jaren|aanslagjaar|in|periode)$/, 'jaar'],
]
const MEERWOORD = ['onroerende voorheffing', 'kadastraal inkomen', 'meer dan', 'minder dan', 'groter dan', 'kleiner dan', 'tot en met', 'hoger dan', 'lager dan']

const LANDEN = { belgie: 'BE', belgië: 'BE', belgisch: 'BE', vlaanderen: 'BE', nederland: 'NL', nederlands: 'NL', zeeland: 'NL' }

export const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
const compact = (s) => s.replace(/[\s\-_/.]+/g, '')

// "1.000,50" → 1000.5, "12.5" → 12.5, "2k" → 2000, "1,5 mln" → 1500000; null als het geen getal is
export function parseNumber(raw) {
  let s = String(raw).trim().toLowerCase().replace(/^€\s*/, '').replace(/\s*(eur|euro)$/, '')
  let mult = 1
  const m = s.match(/^(.*?)(k|mln|m|miljoen)$/)
  if (m && /\d$/.test(m[1])) {
    s = m[1]
    mult = m[2] === 'k' ? 1e3 : 1e6
  }
  if (!/^-?[\d.,]+$/.test(s) || !/\d/.test(s)) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n * mult : null
}
const isYear = (raw, n) => Number.isInteger(n) && n >= JAAR_MIN && n <= JAAR_MAX && /^\d{4}$/.test(String(raw).trim())
const hasMoneyMark = (raw) => /€|eur|k$|mln$|,\d|\.\d{1,2}$|\d\.\d{3}/.test(String(raw).toLowerCase())

const fmtNum = (n) => new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(n)
const fmtEur = (n) => `€ ${fmtNum(n)}`
// Waarde met eenheid van het bedragveld: euro (standaard), 'm2' of '%'
const fmtUnit = (v, def) => (def?.unit === 'm2' ? `${fmtNum(v)} m²` : def?.unit === '%' ? `${fmtNum(v)}%` : fmtEur(v))
const yearsLabel = (ys) => {
  const s = [...ys].sort((a, b) => a - b)
  const aaneen = s.length > 2 && s.every((y, i) => i === 0 || y === s[i - 1] + 1)
  return aaneen ? `${s[0]}–${s.at(-1)}` : s.join(', ')
}
const rangeLabel = ({ min, max }, eur = true) => {
  const f = eur ? fmtEur : fmtNum
  if (min != null && max != null) return min === max ? f(min) : `${f(min)} – ${f(max)}`
  if (min != null) return `≥ ${f(min)}`
  return `≤ ${f(max)}`
}
const range = (a, b) => (a <= b ? { min: a, max: b } : { min: b, max: a })
const yearRange = (a, b) => {
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  return hi - lo > 60 ? null : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

function tokenize(input) {
  let s = ` ${String(input ?? '')} `
    .replace(/[–—]/g, '-')
    .replace(/\bt\/m\b|\btm\b|\bt\.e\.m\./gi, ' tot ')
    .replace(/€\s+/g, '€')
    .replace(/(\d)\s*-\s*(€?\d)/g, '$1-$2')
    .replace(/(>=|<=|≥|≤|>|<|=)\s+/g, '$1')
  const tokens = []
  const re = /"([^"]*)"|(\S+)/g
  let m
  while ((m = re.exec(s))) tokens.push(m[1] != null ? { quoted: true, raw: m[1] } : { raw: m[2] })
  // Meerwoordige termen samenvoegen ("meer dan", "onroerende voorheffing")
  const out = []
  for (let i = 0; i < tokens.length; i++) {
    const two = tokens[i + 1] && !tokens[i].quoted && !tokens[i + 1].quoted ? normalize(`${tokens[i].raw} ${tokens[i + 1].raw}`) : null
    const three = two && tokens[i + 2] ? `${two} ${normalize(tokens[i + 2].raw)}` : null
    if (three && MEERWOORD.includes(three)) {
      out.push({ raw: three })
      i += 2
    } else if (two && MEERWOORD.includes(two)) {
      out.push({ raw: two })
      i += 1
    } else out.push(tokens[i])
  }
  return out
}

const LOWER = ['>', '>=', '≥', 'vanaf', 'min', 'minimaal', 'minstens', 'meer dan', 'groter dan', 'hoger dan', 'boven', 'van']
const UPPER = ['<', '<=', '≤', 'max', 'maximaal', 'hoogstens', 'minder dan', 'kleiner dan', 'lager dan', 'onder', 'tot', 'tot en met']

// Parse een zoekopdracht voor een schema. Geeft { text, filters, chips } terug.
// filters: { kind: 'amount', field, min, max } | { kind: 'years', field, years } | { kind: 'status', value }
//          | { kind: 'field', key, value } | { kind: 'has', field }
export function parseQuery(input, schema = {}) {
  const tokens = tokenize(input)
  const text = []
  const filters = []
  const chips = []
  const amounts = schema.amounts ?? {}
  const statuses = schema.statuses ?? {}
  let context = null // laatst genoemde maat (ov, jaarprijs, jaar, ...)
  let pendingBound = null // 'min' | 'max' na "vanaf", "tot", ...
  let tussen = false // "tussen X en Y"
  let pendingWord = null // dat woord zelf: tekst als er geen getal op volgt ("van Dijk")

  const amountField = () => (context && context !== 'jaar' ? context : null)
  const addAmount = (min, max) => {
    const field = amountField() ?? schema.defaultAmount ?? 'bedrag'
    // "van X tot Y": tweede grens hoort bij hetzelfde filter
    const prev = filters.findLast((f) => f.kind === 'amount' && f.field === field)
    if (prev && min == null && max != null && (prev.max == null || (prev.min === prev.max && prev.min <= max))) {
      prev.max = max // "vanaf 1000 tot 5000", "1.000 tot 5.000"
      return
    }
    if (prev && max == null && min != null && prev.min == null) {
      prev.min = min
      return
    }
    filters.push({ kind: 'amount', field, min, max })
  }
  const addYears = (years) => {
    const field = context === 'ov' || context === 'ozb' ? context : null
    const prev = filters.find((f) => f.kind === 'years' && f.field === field)
    if (prev) prev.years = [...new Set([...prev.years, ...years])]
    else filters.push({ kind: 'years', field, years })
  }
  const pushNumber = (raw, n, bound) => {
    const yearish = isYear(raw, n) && !hasMoneyMark(raw)
    const jaarContext = context === 'jaar' || ((context === 'ov' || context === 'ozb') && !bound)
    if (yearish && jaarContext) return addYears([n])
    if (bound || amountField() || hasMoneyMark(raw)) return bound === 'max' ? addAmount(null, n) : bound === 'min' ? addAmount(n, null) : addAmount(n, n)
    text.push(normalize(raw)) // los getal zonder context: een nummer (debiteur, contract, ...)
  }

  for (let i = 0; i < tokens.length; i++) {
    const { raw, quoted } = tokens[i]
    if (quoted) {
      if (raw.trim()) text.push(normalize(raw))
      continue
    }
    const w = normalize(raw)

    // veld:waarde
    const kv = raw.match(/^([a-zA-Zë]+):(.+)$/)
    if (kv) {
      const key = normalize(kv[1])
      const val = kv[2]
      const maat = MAATWOORDEN.find(([re]) => re.test(key))?.[1]
      if (key === 'status') {
        const v = statuses[normalize(val)] ?? normalize(val)
        filters.push({ kind: 'status', value: v })
        continue
      }
      if (key === 'land') {
        filters.push({ kind: 'field', key: 'land', value: LANDEN[normalize(val)] ?? val.toUpperCase() })
        continue
      }
      if (maat) {
        const before = context
        context = maat
        const sub = parseQuery(`${maat === 'jaar' ? 'jaar' : maat} ${val}`, schema)
        filters.push(...sub.filters)
        context = before
        continue
      }
      filters.push({ kind: 'field', key, value: normalize(val) })
      continue
    }

    // maatwoord
    const maat = MAATWOORDEN.find(([re]) => re.test(w))?.[1]
    if (maat) {
      context = maat
      if (maat === 'ov' || maat === 'ozb') {
        if (!filters.some((f) => f.kind === 'has' && f.field === maat)) filters.push({ kind: 'has', field: maat })
      }
      continue
    }
    if (LOWER.includes(w) || UPPER.includes(w)) {
      if (pendingWord) text.push(pendingWord)
      pendingBound = LOWER.includes(w) ? 'min' : 'max'
      pendingWord = /^[a-z]/.test(w) && !w.includes(' ') ? w : null
      continue
    }
    if (w === 'tussen') {
      pendingBound = 'min'
      tussen = true
      continue
    }
    if (w === 'en' && tussen) {
      pendingBound = 'max'
      tussen = false
      continue
    }
    if (w === 'and' || w === ',' || w === 'of') continue

    // >5000, <=2k
    const cmp = raw.match(/^(>=|<=|≥|≤|>|<|=)(.+)$/)
    if (cmp) {
      const n = parseNumber(cmp[2])
      if (n != null) {
        pushNumber(cmp[2], n, cmp[1] === '=' ? null : cmp[1].startsWith('>') || cmp[1] === '≥' ? 'min' : 'max')
        pendingBound = pendingWord = null
        continue
      }
    }

    // 1000-5000, 2023-2025, €1k-€5k
    const rng = raw.match(/^(€?[\d.,]+(?:k|mln)?)-(€?[\d.,]+(?:k|mln)?)$/i)
    if (rng) {
      const a = parseNumber(rng[1])
      const b = parseNumber(rng[2])
      if (a != null && b != null) {
        const jaarOk = context == null || context === 'jaar' || context === 'ov' || context === 'ozb'
        const years = isYear(rng[1], a) && isYear(rng[2], b) && !hasMoneyMark(raw) && jaarOk ? yearRange(a, b) : null
        if (years) addYears(years)
        else {
          const r = range(a, b)
          addAmount(r.min, r.max)
        }
        pendingBound = pendingWord = null
        continue
      }
    }

    // 2023,2024
    if (/^\d{4}(,\d{4})+$/.test(raw) && (context === 'jaar' || context === 'ov' || context === 'ozb')) {
      addYears(raw.split(',').map(Number))
      continue
    }

    const n = parseNumber(raw)
    if (n != null) {
      pushNumber(raw, n, pendingBound)
      pendingBound = pendingWord = null
      continue
    }
    if (pendingWord) text.push(pendingWord)
    pendingBound = pendingWord = null

    if (LANDEN[w]) {
      filters.push({ kind: 'field', key: 'land', value: LANDEN[w] })
      continue
    }
    if (statuses[w]) {
      filters.push({ kind: 'status', value: statuses[w] })
      continue
    }
    text.push(w)
  }

  if (pendingWord) text.push(pendingWord)

  // "ov" met bedrag of jaar: het losse 'has'-filter is dan overbodig
  const clean = filters.filter(
    (f) => !(f.kind === 'has' && filters.some((g) => g !== f && g.field === f.field && (g.kind === 'amount' || g.kind === 'years')))
  )

  for (const f of clean) chips.push({ ...chipFor(f, schema), filter: f })
  for (const t of text) chips.push({ label: `“${t}”`, kind: 'text', supported: true })
  return { text, filters: clean, chips }
}

const MAATLABEL = { ov: 'Onroerende voorheffing', ozb: 'OZB', jaarprijs: 'Jaarprijs', bedrag: 'Bedrag', waarde: 'Contractwaarde', m2: 'm²', ki: 'Kadastraal inkomen', woz: 'WOZ-waarde' }

function chipFor(f, schema) {
  const amounts = schema.amounts ?? {}
  if (f.kind === 'amount') {
    const def = amounts[f.field]
    const label = def?.label ?? MAATLABEL[f.field] ?? f.field
    return { label: `${label} ${rangeLabel(f, !def?.unit && f.field !== 'm2')}`, kind: 'amount', supported: Boolean(def) }
  }
  if (f.kind === 'years') {
    const label = f.field ? `${MAATLABEL[f.field]} ${yearsLabel(f.years)}` : `Jaar ${yearsLabel(f.years)}`
    const supported = f.field ? Boolean(amounts[f.field]) : Boolean(schema.inYear)
    return { label, kind: 'years', supported }
  }
  if (f.kind === 'has') return { label: `Met ${MAATLABEL[f.field]}`, kind: 'amount', supported: Boolean(amounts[f.field]) }
  if (f.kind === 'status') {
    const label = Object.entries(schema.statuses ?? {}).find(([, v]) => v === f.value)?.[0] ?? f.value
    return { label: `Status: ${label}`, kind: 'status', supported: Boolean(schema.status) }
  }
  const def = schema.fields?.[f.key]
  return { label: `${def?.label ?? f.key}: ${f.value}`, kind: 'field', supported: Boolean(def) }
}

const inRange = (v, { min, max }) => v != null && (min == null || v >= min - 0.005) && (max == null || v <= max + 0.005)

// Controleert één record. Geeft null (geen treffer) of { notes } terug; notes zijn de gevonden waarden,
// bv. ["OV 2024: € 1.234,56"], om in de resultaten te tonen.
export function matchRecord(record, parsed, schema) {
  const notes = []
  if (parsed.text.length) {
    const hay = schema.text(record).filter((v) => v != null && v !== '').map(normalize).join(' \u0001 ')
    const hayCompact = compact(hay)
    for (const t of parsed.text) if (!hay.includes(t) && !(compact(t) && hayCompact.includes(compact(t)))) return null
  }

  const amounts = schema.amounts ?? {}
  const yearFilters = parsed.filters.filter((f) => f.kind === 'years')
  const yearsFor = (field) => yearFilters.find((f) => f.field === field)?.years

  for (const f of parsed.filters) {
    if (f.kind === 'status') {
      if (!schema.status) continue
      if (normalize(schema.status(record)) !== normalize(f.value)) return null
    } else if (f.kind === 'field') {
      const def = schema.fields?.[f.key]
      if (!def) continue
      const v = normalize(def.get(record))
      if (f.key === 'land' ? !v.split('+').includes(normalize(f.value)) : !v.includes(normalize(f.value))) return null
    } else if (f.kind === 'years' && !f.field) {
      if (!schema.inYear) continue
      if (!f.years.some((y) => schema.inYear(record, y))) return null
    }
  }

  // Bedragen (en per-jaar-bedragen zoals OV)
  const fields = new Set(parsed.filters.filter((f) => f.field && (f.kind === 'amount' || f.kind === 'years' || f.kind === 'has')).map((f) => f.field))
  for (const field of fields) {
    const def = amounts[field]
    if (!def) continue
    const amountFilter = parsed.filters.find((f) => f.kind === 'amount' && f.field === field)
    const perJaar = schema.yearAmounts?.includes(field)
    if (perJaar) {
      const years = yearsFor(field) ?? (amountFilter ? [new Date().getFullYear()] : null)
      if (years) {
        const hits = years.map((y) => ({ y, v: def.get(record, y) })).filter(({ v }) => v != null && (!amountFilter || inRange(v, amountFilter)))
        if (!hits.length) return null
        notes.push(...hits.map(({ y, v }) => `${def.short ?? def.label} ${y}: ${fmtUnit(v, def)}`))
      } else {
        const v = def.get(record, null)
        if (v == null) return null
        if (def.note !== false) notes.push(`${def.short ?? def.label} ${def.yearOf?.(record) ?? new Date().getFullYear()}: ${fmtUnit(v, def)}`)
      }
    } else {
      const v = def.get(record)
      if (amountFilter ? !inRange(v, amountFilter) : v == null) return null
      if (def.note !== false && amountFilter) notes.push(`${def.short ?? def.label}: ${fmtUnit(v, def)}`)
    }
  }
  // Bedrag zonder veld valt terug op het standaardbedrag van het scherm (in parseQuery al ingevuld)
  return { notes }
}

// Filtert een lijst; geeft [{ item, notes }] terug
export function searchRecords(records, query, schema) {
  const parsed = typeof query === 'string' ? parseQuery(query, schema) : query
  if (!parsed.text.length && !parsed.filters.length) return records.map((item) => ({ item, notes: [] }))
  const out = []
  for (const item of records) {
    const hit = matchRecord(item, parsed, schema)
    if (hit) out.push({ item, notes: hit.notes })
  }
  return out
}

export const VOORBEELDEN = [
  ['SCA0001', 'contractnummer, klant, kadaster, notities…'],
  ['€1000-5000', 'bedrag tussen (jaarprijs of factuurtotaal)'],
  ['> 10k', 'bedrag vanaf € 10.000'],
  ['ov 2024', 'onroerende voorheffing over 2024'],
  ['ov 2023-2025 > 5000', 'OV boven € 5.000 in een van die jaren'],
  ['jaar 2024', 'liep in / hoort bij 2024'],
  ['actief erfpacht', 'status en vrije tekst samen'],
  ['klant:haven land:be', 'veld bevat tekst; land BE of NL'],
  ['m2 > 10000', 'oppervlakte vanaf 10.000 m²'],
]
