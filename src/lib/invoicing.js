// Twee soorten facturen, beide gebruikt voor de voorbeeldfactuur in het scherm én de opgeslagen factuur:
// - contractfactuur: oppervlakte × prijs per m², of de vaste jaarprijs, verdeeld over de perioden van de frequentie
// - belastingfactuur: een ontvangen aanslag (OV in België, OZB in Nederland) wordt per aanslagjaar volledig doorbelast
export const FREQUENTIES = { Maand: 12, Kwartaal: 4, Jaar: 1 }
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

// Voorbeeldrekeningen voor de simulatie
export const REKENINGEN = { debiteuren: '13000', btw: '15000', omzet: '82000', belasting: '82500' }

export const BETAALTERMIJN_DAGEN = 30

// Afzender op het factuurdocument; verzonnen gegevens voor de demo
export const AFZENDER = {
  naam: 'Demo Havenbedrijf BV',
  adres: ['Voorbeeldkade 1', '4500 AA Demostad'],
  iban: 'NL00 DEMO 0123 4567 89',
  btw: 'NL000000000B00',
  kvk: '00000000',
}

export const BELASTINGEN = {
  OV: { label: 'Onroerende voorheffing', land: 'BE' },
  OZB: { label: 'Onroerendezaakbelasting', land: 'NL' },
}

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100
const DAG_MS = 24 * 60 * 60 * 1000
const dagNummer = (s) => Date.parse(`${s}T00:00:00Z`) / DAG_MS
const iso = (date) => date.toISOString().slice(0, 10)
const eur = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)
const getal = (v) => new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 4 }).format(v)

export function annualPrice(c) {
  const contractValue = c.contractValue === '' ? null : c.contractValue
  if (c.fixedPrice) return contractValue == null ? null : Number(contractValue)
  if (c.m2 !== '' && c.m2 != null && c.pricePerM2 !== '' && c.pricePerM2 != null) return round2(Number(c.m2) * Number(c.pricePerM2))
  return contractValue == null ? null : Number(contractValue)
}

export function berekenOZB({ wozWaarde, ozbTarief }) {
  if (wozWaarde === '' || wozWaarde == null || ozbTarief === '' || ozbTarief == null) return null
  return round2((Number(wozWaarde) * Number(ozbTarief)) / 100)
}

export function periodsFor(frequency, year) {
  const n = FREQUENTIES[frequency]
  if (!n) return []
  const months = 12 / n
  return Array.from({ length: n }, (_, index) => {
    const start = new Date(Date.UTC(year, index * months, 1))
    const end = new Date(Date.UTC(year, (index + 1) * months, 0))
    const label = n === 12 ? `${MAANDEN[index]} ${year}` : n === 4 ? `Q${index + 1} ${year}` : `${year}`
    return { index, n, year, label, start: iso(start), end: iso(end) }
  })
}

// Deel van de periode dat binnen de looptijd valt: 1 = hele periode, 0 = erbuiten
function looptijdFactor(c, period) {
  const start = c.invoiceStartDate || c.startDate
  const end = c.invoiceEndDate || c.endDate
  const van = Math.max(dagNummer(period.start), start ? dagNummer(start) : -Infinity)
  const tot = Math.min(dagNummer(period.end), end ? dagNummer(end) : Infinity)
  const dagen = dagNummer(period.end) - dagNummer(period.start) + 1
  return Math.max(0, tot - van + 1) / dagen
}

// Het deel van het jaarbedrag voor deze periode; de centen lopen op zodat alle perioden samen exact het jaarbedrag zijn
const periodeDeel = (jaarbedrag, { index, n }) => round2((jaarbedrag * (index + 1)) / n) - round2((jaarbedrag * index) / n)

function referentie(c, period) {
  if (!c.invoiceRef) return null
  const kwartaal = Math.ceil(Number(period.start.slice(5, 7)) / 3)
  return c.invoiceRef.replaceAll('#K', String(kwartaal)).replaceAll('#J', String(period.year))
}

// c: contractvelden (ook niet-opgeslagen waarden uit het scherm). Geeft { error } of de factuur terug.
export function buildInvoice(c, period, btwPercentage) {
  const jaarprijs = annualPrice(c)
  if (jaarprijs == null) return { error: 'Geen oppervlakte en prijs per m² ingevuld' }
  const factor = looptijdFactor(c, period)
  if (factor === 0) return { error: `${period.label} valt buiten de looptijd van het contract` }

  const btwPct = Number(btwPercentage) || 0
  const regel = (code, omschrijving, grootboek, jaarbedrag) => {
    const bedrag = round2(periodeDeel(jaarbedrag, period) * factor)
    return { code, omschrijving, grootboek, jaarbedrag, bedrag, btwPct, btw: round2((bedrag * btwPct) / 100) }
  }

  const berekening = c.fixedPrice ? 'vaste jaarprijs' : `${getal(c.m2)} m² × ${eur(Number(c.pricePerM2))} per m²`
  const lines = [regel('CONTRACT', `${c.contractType || 'Contract'} ${period.label}: ${berekening}`, c.grootboekNieuw || REKENINGEN.omzet, jaarprijs)]


  const subtotal = round2(lines.reduce((s, l) => s + l.bedrag, 0))
  const vatAmount = round2(lines.reduce((s, l) => s + l.btw, 0))
  return {
    lines,
    jaarprijs,
    factor,
    referentie: referentie(c, period),
    subtotal,
    vatAmount,
    total: round2(subtotal + vatAmount),
  }
}

// Liep het contract in dit aanslagjaar? Ook een beëindigd contract krijgt een late aanslag nog doorbelast.
export function contractLiepIn(c, jaar) {
  const start = c.invoiceStartDate || c.startDate
  const end = c.invoiceEndDate || c.endDate
  return (!start || Number(start.slice(0, 4)) <= jaar) && (!end || Number(end.slice(0, 4)) >= jaar)
}

// Factuur voor één ontvangen aanslag: het volledige bedrag, in één keer
export function buildTaxInvoice(c, { taxType, year, amount }, btwPercentage) {
  const belasting = BELASTINGEN[taxType]
  if (!belasting) return { error: 'Onbekende belasting' }
  const bedrag = round2(Number(amount))
  if (!(bedrag > 0)) return { error: 'Vul het bedrag van de aanslag in' }
  if (!contractLiepIn(c, year)) return { error: `Het contract liep niet in ${year}` }

  const btwPct = Number(btwPercentage) || 0
  const lines = [{
    code: taxType,
    omschrijving: `${belasting.label} aanslagjaar ${year}, doorbelast`,
    grootboek: REKENINGEN.belasting,
    jaarbedrag: bedrag,
    bedrag,
    btwPct,
    btw: round2((bedrag * btwPct) / 100),
  }]
  return { lines, label: `${belasting.label} ${year}`, subtotal: bedrag, vatAmount: lines[0].btw, total: round2(bedrag + lines[0].btw) }
}

// Creditfactuur: het origineel met tegengestelde bedragen
export function creditLines(lines) {
  return lines.map((l) => ({ ...l, omschrijving: `Credit: ${l.omschrijving}`, jaarbedrag: -l.jaarbedrag, bedrag: -l.bedrag, btw: -l.btw }))
}

// Journaalpost zoals de financiële administratie die boekt; bij een creditfactuur draaien debet en credit om
export function journalLines(invoice) {
  const post = (rekening, omschrijving, debet) => ({ rekening, omschrijving, debet: debet > 0 ? debet : null, credit: debet < 0 ? -debet : null })
  return [
    post(REKENINGEN.debiteuren, `Debiteur ${invoice.debiteurnummer ?? ''} ${invoice.customerName}`.trim(), invoice.total),
    ...invoice.lines.map((l) => post(l.grootboek, l.omschrijving, -l.bedrag)),
    ...(invoice.vatAmount ? [post(REKENINGEN.btw, 'Af te dragen BTW', -invoice.vatAmount)] : []),
  ]
}
