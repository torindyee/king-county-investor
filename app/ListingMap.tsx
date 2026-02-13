"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Point = {
  id: number
  lat: number
  lng: number
  label: string
}

export default function ListingMap(props: {
  points: Point[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const [tileError, setTileError] = useState(false)

  const hasPoints = props.points && props.points.length > 0

  useEffect(() => {
    let cancelled = false

    const loadCss = () =>
      new Promise<void>((resolve) => {
        const id = "leaflet-css"
        if (document.getElementById(id)) return resolve()
        const link = document.createElement("link")
        link.id = id
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        link.onload = () => resolve()
        document.head.appendChild(link)
      })

    const loadJs = () =>
      new Promise<void>((resolve) => {
        if ((window as any).L) return resolve()
        const id = "leaflet-js"
        if (document.getElementById(id)) {
          const interval = setInterval(() => {
            if ((window as any).L) {
              clearInterval(interval)
              resolve()
            }
          }, 50)
          return
        }
        const script = document.createElement("script")
        script.id = id
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.onload = () => resolve()
        document.body.appendChild(script)
      })

    const init = async () => {
      await loadCss()
      await loadJs()
      if (cancelled) return
      if (!mapDivRef.current) return

      const L = (window as any).L

      if (!mapRef.current) {
        mapRef.current = L.map(mapDivRef.current, {
          zoomControl: true,
        })

        const layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        })

        layer.on("tileerror", () => setTileError(true))
        layer.addTo(mapRef.current)

        markersLayerRef.current = L.layerGroup().addTo(mapRef.current)
      }

      // If the container mounted while hidden, Leaflet needs a resize nudge.
      setTimeout(() => {
        try {
          mapRef.current?.invalidateSize?.()
        } catch {}
      }, 200)
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const L = (window as any).L
    if (!L || !mapRef.current || !markersLayerRef.current) return

    markersLayerRef.current.clearLayers()

    const bounds: any[] = []

    props.points.forEach((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return
      const marker = L.marker([p.lat, p.lng]).addTo(markersLayerRef.current)
      marker.bindPopup(p.label)
      marker.on("click", () => props.onSelect(p.id))
      bounds.push([p.lat, p.lng])
    })

    if (bounds.length > 0 && !props.selectedId) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30] })
    }

    if (props.selectedId) {
      const chosen = props.points.find((x) => x.id === props.selectedId)
      if (chosen) mapRef.current.setView([chosen.lat, chosen.lng], 14)
    }
  }, [props.points, props.selectedId, props.onSelect])

  return (
    <div className="rounded-xl border border-emerald-100 bg-white shadow-sm overflow-hidden relative">
      {/* Fixed height so it never collapses to grey */}
      <div ref={mapDivRef} className="h-[560px] w-full" />

      {!hasPoints && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 p-6 text-center">
          <div>
            <div className="text-sm font-semibold text-zinc-900">No listings to show</div>
            <div className="mt-1 text-xs text-zinc-600">
              Adjust filters or add lat/lng to your fake listings.
            </div>
          </div>
        </div>
      )}

      {tileError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 p-6 text-center">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Map tiles blocked</div>
            <div className="mt-1 text-xs text-zinc-600">
              Your network may block OpenStreetMap tiles. Try a different network.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
