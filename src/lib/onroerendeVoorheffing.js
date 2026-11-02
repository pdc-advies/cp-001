// Onroerende voorheffing in Vlaanderen, volgens de rekenregels op vlaanderen.be.
// Indicatief: verminderingen en verlaagde tarieven (sociale woningen, materieel) zitten er niet in.
import tarieven from '@/lib/opcentiemen.json'

export const BASISTARIEF = 0.0397

// Indexatiecoëfficiënt per aanslagjaar
export const COEFFICIENTEN = { 2019: 1.823, 2020: 1.8492, 2021: 1.863, 2022: 1.9084, 2023: 2.0915, 2024: 2.1763, 2025: 2.2446, 2026: 2.3 }
const LAATSTE_JAAR = Math.max(...Object.keys(COEFFICIENTEN).map(Number))

export const coefficient = (jaar) => COEFFICIENTEN[jaar] ?? COEFFICIENTEN[LAATSTE_JAAR]

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100

// Officiële opcentiemen van het aanslagjaar. Een tarief dat op het contract is aangepast blijft gelden, net als het
// contracttarief bij een fusiegemeente zonder historie (ontbreekt = true).
export function opcentiemenVoorJaar(c, jaar) {
  const gemeente = tarieven.gemeenten.find((g) => g.naam === c.ovGemeente)
  const officieelGemeente = gemeente && Number(c.ovOpcentiemenGemeente) === gemeente.opcentiemen
  const officieelProvincie = Number(c.ovOpcentiemenProvincie) === tarieven.provincies[c.ovProvincie]
  const historisch = officieelGemeente ? gemeente.jaren[jaar] : undefined
  return {
    gemeente: historisch ?? c.ovOpcentiemenGemeente,
    provincie: (officieelProvincie ? tarieven.provinciesPerJaar[c.ovProvincie][jaar] : undefined) ?? c.ovOpcentiemenProvincie,
    ontbreekt: Boolean(officieelGemeente) && historisch === undefined,
  }
}

// Geeft alle tussenstappen terug; null als er geen kadastraal inkomen is
export function berekenOV({ kadastraalInkomen, jaar, opcentiemenGemeente, opcentiemenProvincie }) {
  if (kadastraalInkomen == null || kadastraalInkomen === '') return null
  const coef = coefficient(jaar)
  const geindexeerdKI = Math.round(Number(kadastraalInkomen) * coef)
  const basisheffing = round2(geindexeerdKI * BASISTARIEF)
  const provincie = round2((basisheffing * (Number(opcentiemenProvincie) || 0)) / 100)
  const gemeente = round2((basisheffing * (Number(opcentiemenGemeente) || 0)) / 100)
  return { coefficient: coef, geindexeerdKI, basisheffing, provincie, gemeente, totaal: round2(basisheffing + provincie + gemeente) }
}
