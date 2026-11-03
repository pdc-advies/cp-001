// Demodata: 10 fictieve contracten (5 NL, 5 BE) op echte, openbare kadastrale percelen, zodat de kaart werkt.
// Klanten, bedragen en notities zijn verzonnen. Gebruik: node prisma/seed-demo.js [--reset]
// Vult alleen een lege database. --reset wist eerst contracten, notities, klanten en BTW-codes, maar weigert
// bij meer dan 50 contracten: dat is geen demodatabase.
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const CUSTOMERS = [
  { debiteurnummer: '900101', name: 'Zeeuwse Opslag BV (demo)', address: 'Kanaalweg 10', city: '4530 AA Terneuzen' },
  { debiteurnummer: '900102', name: 'Kanaalzone Logistiek BV (demo)', address: 'Havenstraat 22', city: '4530 AB Terneuzen' },
  { debiteurnummer: '900103', name: 'Scheldewerf Holding NV (demo)', address: 'Werfkade 3', city: '4380 AC Vlissingen' },
  { debiteurnummer: '900201', name: 'Haasrode Tech Campus NV (demo)', address: 'Researchpark 1', city: '3001 Leuven' },
  { debiteurnummer: '900202', name: 'Brabant Distributie BVBA (demo)', address: 'Logistiekweg 7', city: '3001 Leuven' },
]

const BTW_CODES = [
  { code: 'V21', description: 'BTW hoog (demo)', percentage: 21 },
  { code: '0', description: 'Vrijgesteld (demo)', percentage: 0 },
]

const base = { kostenplaats: 'DEMO', invoiceFrequency: 'Kwartaal', manager: 'Demo', grootboekNieuw: '82000', btwCode: 'V21' }

const CONTRACTS = [
  // Nederland (kadastrale gemeente Terneuzen, sectie A)
  { ...base, contractNumber: 'DEMO-NL-01', debiteurnummer: '900101', contractType: 'Erfpacht', status: 'active', kadastrale: 'Terneuzen A-806', startDate: '2018-01-01', endDate: '2043-12-31', m2: 7820, pricePerM2: 4.25, description: 'Opslagterrein met loods' },
  { ...base, contractNumber: 'DEMO-NL-02', debiteurnummer: '900101', contractType: 'Huur', status: 'active', kadastrale: 'Terneuzen A-809 en A-813', startDate: '2021-07-01', endDate: '2031-06-30', m2: 38255, pricePerM2: 3.1, description: 'Twee aaneengesloten percelen, containeropslag' },
  { ...base, contractNumber: 'DEMO-NL-03', debiteurnummer: '900102', contractType: 'Erfpacht', status: 'active', kadastrale: 'Terneuzen A-1032', startDate: '2015-04-01', endDate: '2065-03-31', m2: 50000, pricePerM2: 2.8, description: 'Distributiecentrum; contract-m² wijkt af van kadaster' },
  { ...base, contractNumber: 'DEMO-NL-04', debiteurnummer: '900102', contractType: 'Huur', status: 'expired', kadastrale: 'TNZ A-1044', startDate: '2014-01-01', endDate: '2024-12-31', m2: 24880, pricePerM2: 2.5, description: 'Verlopen huurcontract' },
  { ...base, contractNumber: 'DEMO-NL-05', debiteurnummer: '900103', contractType: 'Opstal', status: 'draft', kadastrale: 'Terneuzen A1086 ged.', startDate: '2027-01-01', endDate: null, fixedPrice: true, contractValue: 48000, btwCode: '0', description: 'Concept: gedeelte van het perceel, vaste jaarprijs' },
  // België (CaPaKey, Haasrode bij Leuven)
  { ...base, contractNumber: 'DEMO-BE-01', debiteurnummer: '900201', contractType: 'Concessie', status: 'active', kadastrale: '24034C0335/00_000', startDate: '2019-01-01', endDate: '2048-12-31', m2: 13130, pricePerM2: 6.4, description: 'Kantoor en labo' },
  { ...base, contractNumber: 'DEMO-BE-02', debiteurnummer: '900201', contractType: 'Concessie', status: 'active', kadastrale: '24034C0430/00D000', startDate: '2020-05-01', endDate: '2035-04-30', m2: 13021, pricePerM2: 5.9, description: 'Parkeerterrein' },
  { ...base, contractNumber: 'DEMO-BE-03', debiteurnummer: '900202', contractType: 'Huur', status: 'active', kadastrale: '24034A0194/00C000', startDate: '2022-01-01', endDate: '2032-12-31', m2: 12671, pricePerM2: 5.2, description: 'Magazijn' },
  { ...base, contractNumber: 'DEMO-BE-04', debiteurnummer: '900202', contractType: 'Concessie', status: 'active', kadastrale: '24034B0101/00E000, 24034B0100/00H000', startDate: '2017-09-01', endDate: '2042-08-31', m2: 24577, pricePerM2: 4.75, description: 'Twee percelen, één concessie' },
  { ...base, contractNumber: 'DEMO-BE-05', debiteurnummer: '900201', contractType: 'Huur', status: 'expired', kadastrale: '24034B0080/00F000', startDate: '2012-01-01', endDate: '2023-12-31', m2: 10200, pricePerM2: 3.9, description: 'Verlopen huurcontract' },
]

// Voorbeeldnotities en -acties (auteur "Demo")
const NOTES = [
  { contractNumber: 'DEMO-NL-03', text: 'Contract-m² (50.000) wijkt af van het kadaster. Grens van het perceel controleren.', team: 'gis' },
  { contractNumber: 'DEMO-NL-03', text: 'Na controle GIS: jaarprijs herberekenen.', team: 'financieel' },
  { contractNumber: 'DEMO-NL-05', text: 'Conceptcontract: opstalrecht juridisch laten toetsen.', team: 'juridisch' },
  { contractNumber: 'DEMO-BE-04', text: 'Klant vraagt om samenvoeging van beide percelen in één factuur.', team: 'contract' },
  { contractNumber: 'DEMO-BE-01', text: 'Jaarlijkse indexatie besproken met de klant, akkoord.', team: null },
]

// Facturatievelden: wisselende frequenties en, voor België, een verzonnen KI met de tarieven van Leuven 2026
// (1170 = percelen met een economische aard). Ook voor een al gevulde demodatabase.
const OV_LEUVEN = { ovGemeente: 'Leuven (gedifferentieerd 1170)', ovProvincie: 'Vlaams-Brabant', ovOpcentiemenGemeente: 1170, ovOpcentiemenProvincie: 171.75 }
const BILLING = {
  'DEMO-NL-01': { invoiceFrequency: 'Jaar' },
  'DEMO-NL-02': { invoiceFrequency: 'Maand' },
  'DEMO-BE-01': { invoiceFrequency: 'Kwartaal', kadastraalInkomen: 18500, ...OV_LEUVEN },
  'DEMO-BE-02': { invoiceFrequency: 'Maand', kadastraalInkomen: 6200, ...OV_LEUVEN },
  'DEMO-BE-03': { invoiceFrequency: 'Kwartaal', kadastraalInkomen: 9400, ...OV_LEUVEN },
  'DEMO-BE-04': { invoiceFrequency: 'Jaar', kadastraalInkomen: 14800, ...OV_LEUVEN },
  'DEMO-BE-05': { invoiceFrequency: 'Kwartaal', kadastraalInkomen: 5300, ...OV_LEUVEN },
}

// Voorbeeldwaarden voor de OZB-berekening; verzonnen, niet de echte WOZ-waarde of het echte tarief
const OZB = { 'DEMO-NL-01': 620000, 'DEMO-NL-02': 1450000, 'DEMO-NL-03': 3900000, 'DEMO-NL-04': 980000, 'DEMO-NL-05': 1200000 }

async function applyOzb() {
  for (const [contractNumber, wozWaarde] of Object.entries(OZB)) {
    await prisma.contract.updateMany({ where: { contractNumber }, data: { wozWaarde, ozbTarief: 0.45 } })
  }
}

async function applyBilling() {
  for (const [contractNumber, data] of Object.entries(BILLING)) {
    await prisma.contract.updateMany({ where: { contractNumber }, data })
  }
}

const day = (s) => (s ? new Date(`${s}T00:00:00Z`) : null)

async function main() {
  const count = await prisma.contract.count()
  if (process.argv.includes('--reset')) {
    if (count > 50) throw new Error(`Database heeft ${count} contracten: dit is geen demodatabase, --reset geweigerd`)
    await prisma.interfaceMessage.deleteMany()
    await prisma.unit4Invoice.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.contractNote.deleteMany()
    await prisma.contract.deleteMany()
    await prisma.customer.deleteMany()
    await prisma.btwCode.deleteMany()
  } else if (count > 0) {
    // Eenmalig bijwerken zodra deze velden erbij komen; latere wijzigingen in de demo blijven staan
    const billed = await prisma.contract.count({ where: { kadastraalInkomen: { not: null } } })
    const demoData = await prisma.contract.count({ where: { contractNumber: 'DEMO-BE-01' } })
    if (demoData && !billed) {
      await applyBilling()
      console.log('seed-demo: facturatievelden toegevoegd')
    }
    if (demoData && !(await prisma.contract.count({ where: { wozWaarde: { not: null } } }))) {
      await applyOzb()
      console.log('seed-demo: OZB-velden toegevoegd')
    }
    // Adressen voor het factuurdocument
    for (const c of CUSTOMERS) {
      await prisma.customer.updateMany({ where: { debiteurnummer: c.debiteurnummer, address: null }, data: { address: c.address, city: c.city } })
    }
    // Facturen van vóór de koppeling (verzonden of geboekt zonder factuurdatum) hebben geen tegenhanger in Unit4: opruimen
    const oud = await prisma.invoice.count({ where: { status: { in: ['verzonden', 'geboekt'] }, invoiceDate: null } })
    if (oud) {
      const { count: weg } = await prisma.invoice.deleteMany({ where: { status: { not: 'aangemaakt' } } })
      await prisma.invoice.updateMany({ where: { credited: true }, data: { credited: false } })
      console.log(`seed-demo: ${weg} facturen van vóór de koppeling verwijderd`)
    }
    // Belasting staat niet meer op de contractfactuur; oude voorbeeldfacturen die dat nog deden vervallen
    const { count: removed } = await prisma.invoice.deleteMany({ where: { type: 'contract', lines: { array_contains: [{ code: 'OV' }] } } })
    if (removed) console.log(`seed-demo: ${removed} oude factuur/facturen met voorheffing verwijderd`)
    return
  }

  await prisma.customer.createMany({ data: CUSTOMERS })
  await prisma.btwCode.createMany({ data: BTW_CODES })
  const nameByDebiteur = Object.fromEntries(CUSTOMERS.map((c) => [c.debiteurnummer, c.name]))
  const idByNumber = {}
  for (const c of CONTRACTS) {
    const created = await prisma.contract.create({
      data: { ...c, customerName: nameByDebiteur[c.debiteurnummer], startDate: day(c.startDate), endDate: day(c.endDate) },
    })
    idByNumber[c.contractNumber] = created.id
  }
  await applyBilling()
  await applyOzb()
  for (const n of NOTES) {
    await prisma.contractNote.create({ data: { contractId: idByNumber[n.contractNumber], text: n.text, team: n.team, author: 'Demo' } })
  }
  console.log(`seed-demo: ${CONTRACTS.length} contracten, ${CUSTOMERS.length} klanten en ${NOTES.length} notities aangemaakt`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
