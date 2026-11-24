// Zoekschema's per soort record: welke tekst doorzocht wordt, welke bedragen en jaren er zijn.
// Zie src/lib/search.js voor de zoektaal.
import { annualPrice, berekenOZB, contractLiepIn } from '@/lib/invoicing'
import { berekenOV, opcentiemenVoorJaar } from '@/lib/onroerendeVoorheffing'
import { parseKadastrale } from '@/lib/kadastrale'

const num = (v) => (v === '' || v == null ? null : Number(v))
const jaarVan = (d) => (d ? Number(String(d).slice(0, 4)) : null)
const tussen = (y, start, end) => (start == null || y >= start) && (end == null || y <= end)
const STATUS_NL = { active: 'actief', expired: 'verlopen', draft: 'concept' }

const landCache = new WeakMap()
function landVan(c) {
  if (c.land !== undefined) return c.land ?? ''
  if (!landCache.has(c)) landCache.set(c, [...new Set(parseKadastrale(c.kadastrale).map((p) => p.land))].sort().join('+'))
  return landCache.get(c)
}

// Contract zoals in de database, of de eigenschappen van een kaartobject (met jaarprijs/land al berekend)
export const contractSchema = {
  name: 'contracten',
  text: (c) => [
    c.contractNumber, c.customerName, c.klantNaam, c.debiteurnummer, c.description, c.kostenplaats, c.kadastrale,
    c.notes, c.contractType, c.manager, c.invoiceRef, c.ovGemeente, c.grootboekNieuw, c.grootboekOud, STATUS_NL[c.status],
  ],
  defaultAmount: 'jaarprijs',
  yearAmounts: ['ov', 'ozb'],
  amounts: {
    jaarprijs: { label: 'Jaarprijs', get: (c) => (c.jaarprijs !== undefined ? c.jaarprijs : annualPrice(c)) },
    waarde: { label: 'Contractwaarde', get: (c) => num(c.contractValue) },
    m2: { label: 'Oppervlakte', unit: 'm2', get: (c) => num(c.m2) },
    ki: { label: 'Kadastraal inkomen', short: 'KI', get: (c) => num(c.kadastraalInkomen) },
    woz: { label: 'WOZ-waarde', short: 'WOZ', get: (c) => num(c.wozWaarde) },
    ov: {
      label: 'Onroerende voorheffing',
      short: 'OV',
      get: (c, jaar) => {
        if (num(c.kadastraalInkomen) == null) return null
        const y = jaar ?? new Date().getFullYear()
        if (jaar && !contractLiepIn(c, y)) return null
        const t = opcentiemenVoorJaar(c, y)
        return berekenOV({ kadastraalInkomen: c.kadastraalInkomen, jaar: y, opcentiemenGemeente: t.gemeente, opcentiemenProvincie: t.provincie })?.totaal ?? null
      },
    },
    ozb: {
      label: 'OZB',
      get: (c, jaar) => (jaar && !contractLiepIn(c, jaar) ? null : berekenOZB(c)),
    },
  },
  inYear: (c, y) => contractLiepIn(c, y),
  status: (c) => c.status,
  statuses: { actief: 'active', lopend: 'active', verlopen: 'expired', beeindigd: 'expired', concept: 'draft' },
  fields: {
    klant: { label: 'Klant', get: (c) => `${c.customerName ?? ''} ${c.klantNaam ?? ''}` },
    type: { label: 'Type', get: (c) => c.contractType },
    debiteur: { label: 'Debiteur', get: (c) => c.debiteurnummer },
    nummer: { label: 'Contract', get: (c) => c.contractNumber },
    contract: { label: 'Contract', get: (c) => c.contractNumber },
    kostenplaats: { label: 'Kostenplaats', get: (c) => c.kostenplaats },
    kadaster: { label: 'Kadaster', get: (c) => c.kadastrale },
    gemeente: { label: 'Gemeente', get: (c) => c.ovGemeente },
    beheerder: { label: 'Beheerder', get: (c) => c.manager },
    notitie: { label: 'Notitie', get: (c) => c.notes },
    land: { label: 'Land', get: landVan },
  },
}

export const customerSchema = {
  name: 'klanten',
  text: (k) => [k.debiteurnummer, k.debiteurnummerOud, k.name, k.address, k.city, k.email, k.phone, k.notes],
  fields: {
    naam: { label: 'Naam', get: (k) => k.name },
    klant: { label: 'Naam', get: (k) => k.name },
    debiteur: { label: 'Debiteur', get: (k) => `${k.debiteurnummer} ${k.debiteurnummerOud ?? ''}` },
    plaats: { label: 'Plaats', get: (k) => k.city },
    email: { label: 'E-mail', get: (k) => k.email },
  },
}

export const btwSchema = {
  name: 'btw-codes',
  text: (b) => [b.code, b.description, b.percentage != null ? `${b.percentage}%` : null],
  amounts: { percentage: { label: 'Percentage', unit: '%', get: (b) => num(b.percentage) } },
  defaultAmount: 'percentage',
  fields: { code: { label: 'Code', get: (b) => b.code } },
}

const SOORT = (i) => (i.creditOfId ? 'creditfactuur' : i.type === 'belasting' ? `belasting ${i.taxType ?? ''} ${i.taxYear ?? ''}` : 'contractfactuur')
const belastingBedrag = (soort) => (i, jaar) =>
  i.type === 'belasting' && i.taxType === soort && (jaar == null || i.taxYear === jaar) ? i.subtotal : null

// Factuur uit het Contractenportaal (tabel invoices)
export const invoiceSchema = {
  name: 'facturen',
  text: (i) => [
    i.contractNumber, i.customerName, i.debiteurnummer, i.periodLabel, i.unit4Number, `CP001-${i.id}`, i.taxReference,
    i.customerReference, i.status, SOORT(i), i.createdBy,
  ],
  defaultAmount: 'bedrag',
  yearAmounts: ['ov', 'ozb'],
  amounts: {
    bedrag: { label: 'Totaal', get: (i) => i.total },
    excl: { label: 'Excl. btw', get: (i) => i.subtotal },
    ov: { label: 'Onroerende voorheffing', short: 'OV', get: belastingBedrag('OV'), yearOf: (i) => i.taxYear },
    ozb: { label: 'OZB', get: belastingBedrag('OZB'), yearOf: (i) => i.taxYear },
  },
  inYear: (i, y) => (i.taxYear ? i.taxYear === y : tussen(y, jaarVan(i.periodStart), jaarVan(i.periodEnd))),
  status: (i) => i.status,
  statuses: { aangemaakt: 'aangemaakt', concept: 'aangemaakt', concepten: 'aangemaakt', verzonden: 'verzonden', geboekt: 'geboekt', betaald: 'betaald' },
  fields: {
    klant: { label: 'Klant', get: (i) => i.customerName },
    debiteur: { label: 'Debiteur', get: (i) => i.debiteurnummer },
    contract: { label: 'Contract', get: (i) => i.contractNumber },
    type: { label: 'Soort', get: SOORT },
  },
}

// Regel in de factuurrun (voorbeeld per contract)
export const runRowSchema = {
  name: 'factuurrun',
  text: (r) => [r.contractNumber, r.customerName, r.reason, r.state, r.invoice?.unit4Number, r.invoice?.status],
  defaultAmount: 'bedrag',
  amounts: { bedrag: { label: 'Totaal', get: (r) => r.invoice?.total ?? r.total ?? null } },
  status: (r) => r.state,
  statuses: { gereed: 'gereed', gefactureerd: 'gefactureerd', overgeslagen: 'overgeslagen' },
  fields: {
    klant: { label: 'Klant', get: (r) => r.customerName },
    contract: { label: 'Contract', get: (r) => r.contractNumber },
  },
}

// Verkoopfactuur in de Unit4-simulatie: kent alleen het ontvangen bericht
const u4 = (r) => r.payload?.invoice ?? {}
const u4Belasting = (soort) => (r, jaar) => {
  const t = u4(r).tax
  return t && t.type === soort && (jaar == null || t.year === jaar) ? u4(r).totals?.net ?? null : null
}
export const unit4Schema = {
  name: 'unit4',
  text: (r) => {
    const i = u4(r)
    return [
      r.number, r.externalId, r.status, i.customer?.name, i.customer?.debtorNumber, i.contract?.number, i.contract?.type,
      i.period?.label, i.tax?.reference, i.tax ? `${i.tax.type} ${i.tax.year}` : null, i.customerReference, i.creditOf,
      ...(i.lines ?? []).map((l) => `${l.description} ${l.ledgerAccount ?? ''}`), r.bookedBy, r.paidBy,
    ]
  },
  defaultAmount: 'bedrag',
  yearAmounts: ['ov', 'ozb'],
  amounts: {
    bedrag: { label: 'Totaal', get: (r) => u4(r).totals?.gross ?? null },
    excl: { label: 'Excl. btw', get: (r) => u4(r).totals?.net ?? null },
    ov: { label: 'Onroerende voorheffing', short: 'OV', get: u4Belasting('OV'), yearOf: (r) => u4(r).tax?.year },
    ozb: { label: 'OZB', get: u4Belasting('OZB'), yearOf: (r) => u4(r).tax?.year },
  },
  inYear: (r, y) => {
    const i = u4(r)
    return i.tax?.year ? i.tax.year === y : tussen(y, jaarVan(i.period?.start), jaarVan(i.period?.end))
  },
  status: (r) => r.status,
  statuses: { ontvangen: 'ontvangen', 'te boeken': 'ontvangen', geboekt: 'geboekt', betaald: 'betaald' },
  fields: {
    klant: { label: 'Klant', get: (r) => u4(r).customer?.name },
    debiteur: { label: 'Debiteur', get: (r) => u4(r).customer?.debtorNumber },
    contract: { label: 'Contract', get: (r) => u4(r).contract?.number },
  },
}

// Bericht van de koppeling; de volledige inhoud (verzoek en antwoord) is doorzoekbaar
const berichtTekst = new WeakMap()
export const messageSchema = {
  name: 'berichten',
  text: (m) => {
    if (!berichtTekst.has(m)) berichtTekst.set(m, `${JSON.stringify(m.payload ?? '')} ${JSON.stringify(m.response ?? '')}`)
    return [m.direction?.replaceAll('CP-001', 'Contractenportaal'), m.operation, m.method, m.endpoint, String(m.httpStatus), m.invoiceId && `CP001-${m.invoiceId}`, berichtTekst.get(m)]
  },
  defaultAmount: 'bedrag',
  amounts: { bedrag: { label: 'Factuurtotaal', get: (m) => m.payload?.invoice?.totals?.gross ?? null } },
  inYear: (m, y) => jaarVan(m.createdAt) === y,
  status: (m) => (m.httpStatus < 300 ? 'ok' : 'fout'),
  statuses: { ok: 'ok', gelukt: 'ok', fout: 'fout', mislukt: 'fout', error: 'fout' },
  fields: { richting: { label: 'Richting', get: (m) => m.direction?.replaceAll('CP-001', 'Contractenportaal') } },
}

// Notitie of actie bij een contract (globaal zoeken)
export const noteSchema = {
  name: 'notities',
  text: (n) => [n.text, n.author, n.team, n.contractNumber],
  inYear: (n, y) => jaarVan(n.createdAt) === y,
  status: (n) => (n.team ? (n.doneAt ? 'afgerond' : 'open') : 'notitie'),
  statuses: { open: 'open', afgerond: 'afgerond' },
  fields: { team: { label: 'Team', get: (n) => n.team }, auteur: { label: 'Auteur', get: (n) => n.author } },
}
