'use client'

import { useEffect, useRef, useState } from 'react'
import Map from '@arcgis/core/Map.js'
import MapView from '@arcgis/core/views/MapView.js'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js'
import WMSLayer from '@arcgis/core/layers/WMSLayer.js'
import MapImageLayer from '@arcgis/core/layers/MapImageLayer.js'
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js'
import '@arcgis/core/assets/esri/themes/light/main.css'
import { EDIT_ACTION_ID, STATUS_CONFIG, contractFields, contractLabels, contractPopup, statusRenderer, toGraphics } from '@/lib/esriContracts'

const CADASTRAL_WMS = 'https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0'
const BE_CADASTRE = 'https://ccff02.minfin.fgov.be/geoservices/arcgis/rest/services/WMS/Cadastral_Layers/MapServer'

// ArcGIS-kaart met de contracten als FeatureLayer. Alleen client-side laden (next/dynamic, ssr: false).
export default function ArcgisContractMap({ features, visibleIds, selectedId, onSelect, onEdit }) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const layerRef = useRef(null)
  const cadastreRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const onEditRef = useRef(onEdit)
  const [layerView, setLayerView] = useState(null)
  const [showCadastre, setShowCadastre] = useState(true)

  useEffect(() => {
    onSelectRef.current = onSelect
    onEditRef.current = onEdit
  }, [onSelect, onEdit])

  useEffect(() => {
    const cadastreNL = new WMSLayer({
      url: CADASTRAL_WMS,
      sublayers: [{ name: 'Kadastralekaart' }],
      title: 'Kadastrale kaart NL (PDOK)',
      opacity: 0.7,
    })
    // Federale kadasterdienst België: perceelgrenzen (11) en gebouwen (12), alleen bij inzoomen
    const cadastreBE = new MapImageLayer({
      url: BE_CADASTRE,
      title: 'Kadastrale percelen BE (FOD Financiën)',
      sublayers: [{ id: 12, visible: true }, { id: 11, visible: true }],
      minScale: 6000,
      opacity: 0.7,
    })
    cadastreRef.current = [cadastreNL, cadastreBE]

    const view = new MapView({
      container: containerRef.current,
      map: new Map({ basemap: 'osm', layers: [cadastreNL, cadastreBE] }),
      center: [3.8, 51.28], // Kanaalzone Vlissingen–Terneuzen–Gent
      zoom: 10,
    })
    viewRef.current = view
    view.when().catch(() => {}) // kaart al opgeruimd voordat hij klaar was (AbortError)

    view.on('click', async (event) => {
      const { results } = await view.hitTest(event)
      const hit = results.find((r) => r.graphic?.layer?.id === 'contracten')
      onSelectRef.current(hit ? hit.graphic.attributes.ObjectID : null)
    })

    // Knop "Contract bewerken" in de popup
    const actionHandle = reactiveUtils.on(
      () => view.popup,
      'trigger-action',
      (event) => {
        const id = view.popup?.selectedFeature?.attributes?.ObjectID
        if (event.action.id === EDIT_ACTION_ID && id != null) onEditRef.current?.(id)
      }
    )

    return () => {
      actionHandle.remove()
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    const graphics = toGraphics(features)
    if (!view || graphics.length === 0) return

    const layer = new FeatureLayer({
      id: 'contracten',
      title: 'Contracten',
      source: graphics,
      objectIdField: 'ObjectID',
      fields: contractFields,
      geometryType: 'polygon',
      spatialReference: { wkid: 4326 },
      renderer: statusRenderer,
      labelingInfo: contractLabels,
      popupTemplate: contractPopup,
    })
    view.map.add(layer)
    layerRef.current = layer

    let cancelled = false
    view
      .whenLayerView(layer)
      .then((lv) => {
        if (cancelled) return
        setLayerView(lv)
        view.goTo(graphics, { duration: 800 }).catch(() => {})
      })
      .catch(() => {}) // laag of kaart is al opgeruimd (AbortError)

    return () => {
      cancelled = true
      setLayerView(null)
      layerRef.current = null
      view.map?.remove(layer)
      layer.destroy()
    }
  }, [features])

  useEffect(() => {
    if (!layerView || !layerRef.current) return
    const ids = [...visibleIds]
    layerRef.current.definitionExpression = ids.length ? `ObjectID IN (${ids.join(',')})` : '1=0'
  }, [layerView, visibleIds])

  useEffect(() => {
    if (!layerView) return
    if (selectedId == null) {
      viewRef.current?.closePopup()
      return
    }
    const handle = layerView.highlight(selectedId)
    layerRef.current
      ?.queryFeatures({ objectIds: [selectedId], returnGeometry: true })
      .then(({ features: hits }) => {
        if (hits.length) viewRef.current?.goTo(hits[0].geometry.extent.clone().expand(1.6), { duration: 600 }).catch(() => {})
      })
      .catch(() => {}) // laag is al opgeruimd (AbortError)
    return () => handle.remove()
  }, [layerView, selectedId])

  useEffect(() => {
    for (const layer of cadastreRef.current ?? []) layer.visible = showCadastre
  }, [showCadastre])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-6 left-3 bg-white/95 rounded-lg border border-gray-200 shadow-sm px-3 py-2 text-xs space-y-1.5">
        {Object.values(STATUS_CONFIG).map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: s.color, backgroundColor: `${s.color}73` }} />
            <span className="text-gray-700">{s.label}</span>
          </div>
        ))}
        <label className="flex items-center gap-2 pt-1.5 border-t border-gray-100 cursor-pointer">
          <input type="checkbox" checked={showCadastre} onChange={(e) => setShowCadastre(e.target.checked)} />
          <span className="text-gray-700">Kadastrale kaart <span className="text-gray-400">(vanaf 1:6.000)</span></span>
        </label>
      </div>
    </div>
  )
}
