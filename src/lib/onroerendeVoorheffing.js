// Onroerende voorheffing in Vlaanderen, volgens de rekenregels op vlaanderen.be.
// Indicatief: verminderingen en verlaagde tarieven (sociale woningen, materieel) zitten er niet in.
export const BASISTARIEF = 0.0397

// Indexatiecoëfficiënt per aanslagjaar
export const COEFFICIENTEN = { 2024: 2.1763, 2025: 2.2446, 2026: 2.3 }
const LAATSTE_JAAR = Math.max(...Object.keys(COEFFICIENTEN).map(Number))

export const heeftCoefficient = (jaar) => jaar in COEFFICIENTEN
export const coefficient = (jaar) => COEFFICIENTEN[jaar] ?? COEFFICIENTEN[LAATSTE_JAAR]

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100

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
