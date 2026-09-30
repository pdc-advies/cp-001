import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseKadastrale } from '@/lib/kadastrale'
import { parcelKey, resolveParcels } from '@/lib/pdok'
import { resolveCapakeys } from '@/lib/cadgis'

export const dynamic = 'force-dynamic'

// Zelfde rekenregel als de contractlijst: vaste prijs → contractValue, anders m² × prijs/m²
function annualPrice(c) {
  if (c.fixedPrice) return c.contractValue ?? null
  if (c.m2 != null && c.pricePerM2 != null) return Math.round(c.m2 * c.pricePerM2 * 100) / 100
  return c.contractValue ?? null
}

const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : null)

// Contracten met hun percelen als GeoJSON (RFC 7946, WGS84).
// match: 'volledig' | 'deels' | 'geen' (wel herkend, niets in het kadaster) | 'onleesbaar' (aanduiding niet te parsen)
// NL-percelen via PDOK (BRK), BE-percelen (CaPaKey) via de federale kadasterdienst.
export async function GET() {
  try {
    const [contracts, customers] = await Promise.all([
      prisma.contract.findMany({ orderBy: { contractNumber: 'asc' } }),
      prisma.customer.findMany(),
    ])
    // Klantnaam via debiteurnummer (ook het oude nummer), zoals in de contractlijst
    const customerByDebiteur = {}
    for (const k of customers) {
      customerByDebiteur[k.debiteurnummer] = k
      if (k.debiteurnummerOud) customerByDebiteur[k.debiteurnummerOud] = k
    }
    const parsed = contracts.map((c) => ({ contract: c, parcels: parseKadastrale(c.kadastrale) }))
    const all = parsed.flatMap((p) => p.parcels)
    const [nl, be] = await Promise.all([
      resolveParcels(all.filter((p) => p.land === 'NL')),
      resolveCapakeys(all.filter((p) => p.land === 'BE').map((p) => p.capakey)),
    ])
    const lookup = (p) => (p.land === 'BE' ? be.get(p.capakey) : nl.get(parcelKey(p)))

    const features = parsed.map(({ contract: c, parcels }) => {
      const found = parcels.map((p) => ({ ...p, hit: lookup(p) }))
      const hits = found.filter((p) => p.hit)
      const polygons = hits.flatMap((p) =>
        p.hit.geometry.type === 'MultiPolygon' ? p.hit.geometry.coordinates : [p.hit.geometry.coordinates]
      )
      const kadasterM2 = hits.length ? hits.reduce((s, p) => s + (p.hit.grootte || 0), 0) : null
      const match = !parcels.length ? 'onleesbaar' : hits.length === parcels.length ? 'volledig' : hits.length ? 'deels' : 'geen'

      return {
        type: 'Feature',
        id: c.id,
        geometry: polygons.length ? { type: 'MultiPolygon', coordinates: polygons } : null,
        properties: {
          id: c.id,
          contractNumber: c.contractNumber,
          customerName: customerByDebiteur[c.debiteurnummer]?.name ?? c.customerName,
          debiteurnummer: c.debiteurnummer,
          contractType: c.contractType,
          status: c.status,
          kadastrale: c.kadastrale,
          startDate: day(c.startDate),
          endDate: day(c.endDate),
          m2: c.m2,
          kadasterM2,
          jaarprijs: annualPrice(c),
          kostenplaats: c.kostenplaats,
          match,
          heeftGedeeltelijk: parcels.some((p) => p.partial),
          land: [...new Set(parcels.map((p) => p.land))].sort().join('+') || null,
          percelen: found.map((p) => ({
            label: p.land === 'BE' ? p.capakey : `${p.gemeente} ${p.sectie} ${p.perceelnummer}${p.partial ? ' (ged.)' : ''}`,
            land: p.land,
            brk: p.hit?.aanduiding ?? null,
            grootte: p.hit?.grootte ?? null,
            gevonden: Boolean(p.hit),
          })),
        },
      }
    })

    return NextResponse.json({ type: 'FeatureCollection', features })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
