import Graphic from '@arcgis/core/Graphic.js'
import Polygon from '@arcgis/core/geometry/Polygon.js'

export const STATUS_CONFIG = {
  active: { label: 'Actief', color: '#22c55e', dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 ring-green-600/20' },
  expired: { label: 'Verlopen', color: '#9ca3af', dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 ring-gray-500/20' },
  draft: { label: 'Concept', color: '#fbbf24', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
}

// Veldschema zoals ArcGIS het nodig heeft voor een FeatureLayer (ook bruikbaar als schema in ArcGIS Online)
export const contractFields = [
  { name: 'ObjectID', alias: 'ObjectID', type: 'oid' },
  { name: 'contract_nr', alias: 'Contractnummer', type: 'string' },
  { name: 'klant', alias: 'Klant', type: 'string' },
  { name: 'debiteurnummer', alias: 'Debiteurnummer', type: 'string' },
  { name: 'contract_type', alias: 'Type', type: 'string' },
  { name: 'status', alias: 'Statuscode', type: 'string' },
  { name: 'status_label', alias: 'Status', type: 'string' },
  { name: 'land', alias: 'Land', type: 'string' },
  { name: 'kadastrale', alias: 'Kadastrale aanduiding', type: 'string' },
  { name: 'koppeling', alias: 'Koppeling kadaster', type: 'string' },
  { name: 'm2_contract', alias: 'm² contract', type: 'double' },
  { name: 'm2_kadaster', alias: 'm² kadaster (gevonden percelen)', type: 'double' },
  { name: 'jaarprijs', alias: 'Jaarprijs (EUR)', type: 'double' },
  { name: 'startdatum', alias: 'Startdatum', type: 'date-only' },
  { name: 'einddatum', alias: 'Einddatum', type: 'date-only' },
]

const MATCH_LABEL = { volledig: 'Alle percelen gevonden', deels: 'Deels gevonden', geen: 'Niet gevonden', onleesbaar: 'Aanduiding onleesbaar' }

// GeoJSON (buitenring tegen de klok in) → Esri (buitenring met de klok mee): ringen omdraaien
function toEsriPolygon(geometry) {
  const rings = geometry.coordinates.flatMap((poly) => poly.map((ring) => [...ring].reverse()))
  return new Polygon({ rings, spatialReference: { wkid: 4326 } })
}

export function toGraphics(features) {
  return features
    .filter((f) => f.geometry)
    .map(({ geometry, properties: p }) => new Graphic({
      geometry: toEsriPolygon(geometry),
      attributes: {
        ObjectID: p.id,
        contract_nr: p.contractNumber,
        klant: p.customerName,
        debiteurnummer: p.debiteurnummer,
        contract_type: p.contractType,
        status: p.status,
        status_label: STATUS_CONFIG[p.status]?.label ?? p.status,
        land: p.land,
        kadastrale: p.kadastrale,
        koppeling: MATCH_LABEL[p.match],
        m2_contract: p.m2,
        m2_kadaster: p.kadasterM2,
        jaarprijs: p.jaarprijs,
        startdatum: p.startDate,
        einddatum: p.endDate,
      },
    }))
}

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
}

export const statusRenderer = {
  type: 'unique-value',
  field: 'status',
  defaultSymbol: { type: 'simple-fill', color: rgba('#3b82f6', 0.35), outline: { color: '#3b82f6', width: 1.5 } },
  uniqueValueInfos: Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({
    value,
    label: cfg.label,
    symbol: { type: 'simple-fill', color: rgba(cfg.color, 0.45), outline: { color: cfg.color, width: 1.5 } },
  })),
}

export const contractLabels = [
  {
    labelExpressionInfo: { expression: '$feature.contract_nr' },
    minScale: 25000,
    symbol: { type: 'text', color: '#1f2937', haloColor: 'white', haloSize: 1.5, font: { size: 10, weight: 'bold' } },
  },
]

const alias = Object.fromEntries(contractFields.map((f) => [f.name, f.alias]))
const field = (fieldName, format) => ({ fieldName, label: alias[fieldName], ...(format && { format }) })

export const EDIT_ACTION_ID = 'contract-bewerken'

export const contractPopup = {
  title: '{contract_nr} · {klant}',
  actions: [{ type: 'button', id: EDIT_ACTION_ID, title: 'Contract bewerken', icon: 'pencil' }],
  content: [
    {
      type: 'fields',
      fieldInfos: [
        field('contract_type'),
        field('status_label'),
        field('land'),
        field('kadastrale'),
        field('koppeling'),
        field('m2_contract', { digitSeparator: true, places: 0 }),
        field('m2_kadaster', { digitSeparator: true, places: 0 }),
        field('jaarprijs', { digitSeparator: true, places: 0 }),
        field('startdatum'),
        field('einddatum'),
      ],
    },
  ],
}
