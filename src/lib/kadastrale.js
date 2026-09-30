// Parser voor vrije-tekst kadastrale aanduidingen uit cp-001.
// België: CaPaKey, bv. "44812A0403/00D002" (afdeling, sectie, grondnummer/bisnummer, exponent, macht).
// Nederland:
// Voorbeelden: "VLS M-1462", "Vlissingen O-1491, O-1537 en O-1540", "BSL A-1603 tm 1605 VLS M1406 tm 1414",
// "Vl. M1338 en Bors. A1296", "VLS O-1320-1355-1356-1357g-1366", "Vlissingen sectie C nummer 2241"
const GEMEENTEN = [
  [/^(svg|sas)$/, 'Sas van Gent'],
  [/^(vlissingen|vlissisngen|vl|vls|vsl)$/, 'Vlissingen'],
  [/^(borsele|borssle|bors|bsl|b)$/, 'Borsele'],
  [/^(terneuzen|tnz)$/, 'Terneuzen'],
]
const MAX_RANGE = 25

function gemeenteFor(word) {
  const w = word.toLowerCase().replace(/\.$/, '')
  return GEMEENTEN.find(([re]) => re.test(w))?.[1] ?? null
}

// Tokens, volgorde telt:
// 1 "sas van gent" | 2,3,4 sectie+nummer(+g/ged) | 5 "tm" | 6 "ged" | 7 woord | 8,9 los nummer(+g/ged)
const TOKEN =
  /([Ss]as van [Gg]ent)|\b([A-Z]{1,2})\s*-?\s*(\d{1,5})([Gg](?:ed)?\b)?|\b([Tt]\/?[Mm])\b|(\(?[Gg]ed\.?\)?)|\b([A-Za-z]+\.?)(?=[\s,(]|$)|\b(\d{1,5})([Gg](?:ed)?\b)?/g

const CAPAKEY = /\b(\d{5}[A-Z]\d{4}\/\d{2}[A-Z_]\d{3})\b/g

// Geeft percelen terug; leeg als er niets herkenbaars in staat.
// NL: { land: 'NL', gemeente, sectie, perceelnummer, partial }
// BE: { land: 'BE', capakey, partial: false }
export function parseKadastrale(text) {
  const parcels = []
  if (!text) return parcels
  for (const m of String(text).matchAll(CAPAKEY)) parcels.push({ land: 'BE', capakey: m[1], partial: false })
  const src = String(text)
    .replace(CAPAKEY, ' ')
    .replace(/sectie\s+([A-Z]{1,2})\s+(?:nummer|nr\.?)\s*/gi, '$1-')
  let gemeente = null
  let sectie = null
  let pendingRange = false

  const add = (nr, partial) => {
    if (!gemeente || !sectie) return
    const last = parcels.findLast((p) => p.land === 'NL')
    if (pendingRange && last?.sectie === sectie && nr > last.perceelnummer && nr - last.perceelnummer <= MAX_RANGE) {
      for (let n = last.perceelnummer + 1; n <= nr; n++) parcels.push({ land: 'NL', gemeente, sectie, perceelnummer: n, partial })
    } else {
      parcels.push({ land: 'NL', gemeente, sectie, perceelnummer: nr, partial })
    }
    pendingRange = false
  }

  const re = new RegExp(TOKEN.source, 'g')
  let m
  while ((m = re.exec(src))) {
    if (m[1]) {
      gemeente = 'Sas van Gent'
      sectie = null
    } else if (m[2]) {
      sectie = m[2]
      add(Number(m[3]), Boolean(m[4]))
    } else if (m[5]) {
      pendingRange = true
    } else if (m[6]) {
      if (parcels.length) parcels[parcels.length - 1].partial = true
    } else if (m[7]) {
      const g = gemeenteFor(m[7])
      // "B" is alleen gemeente als er direct een sectie+nummer volgt (anders is het een sectieletter)
      const isLoneB = /^b$/i.test(m[7]) && !/^\s+[A-Z]{1,2}\s*-?\s*\d/.test(src.slice(re.lastIndex))
      if (g && !isLoneB) {
        gemeente = g
        sectie = null
      }
    } else if (m[8]) {
      add(Number(m[8]), Boolean(m[9]))
    }
  }

  const seen = new Set()
  return parcels.filter((p) => {
    const k = p.land === 'BE' ? p.capakey : `${p.gemeente}|${p.sectie}|${p.perceelnummer}`
    return seen.has(k) ? false : seen.add(k)
  })
}
