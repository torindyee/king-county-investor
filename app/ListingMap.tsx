"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Point = { id: number; lat: number; lng: number; label: string }

export default function ListingMap(props: {
  points: Point[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const [tileError, setTileError] = useState(false)

  // Track whether the user has manually moved the map so we don't constantly refit bounds.
  const userMovedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadLeaflet() {
      if (typeof window === "undefined") return

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link")
        link.id = "leaflet-css"
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        document.head.appendChild(link)
      }

      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script")
          s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          s.onload = () => resolve()
          s.onerror = () => reject(new Error("Leaflet failed to load"))
          document.body.appendChild(s)
        })
      }

      if (cancelled) return
      const L = (window as any).L
      if (!L || !mapDivRef.current) return

      if (!mapRef.current) {
        const map = L.map(mapDivRef.current, { zoomControl: true })
        mapRef.current = map

        const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        })

        tiles.on("tileerror", () => setTileError(true))
        tiles.addTo(map)

        // Selection layer
        layerRef.current = L.layerGroup().addTo(map)

        // If user pans/zooms, don't keep snapping back on every filter change.
        map.on("movestart", () => {
          userMovedRef.current = true
        })
      }
    }

    loadLeaflet()

    return () => {
      cancelled = true
    }
  }, [])

  const defaultCenter = useMemo(() => ({ lat: 47.6062, lng: -122.3321 }), [])

  useEffect(() => {
    const L = (window as any).L
    const map = mapRef.current
    const layer = layerRef.current
    if (!L || !map || !layer) return

    layer.clearLayers()

    // If no points, show a reasonable default view.
    if (props.points.length === 0) {
      map.setView([defaultCenter.lat, defaultCenter.lng], 10)
      return
    }

    // Draw markers (circle markers so we can visually highlight selected)
    props.points.forEach((p) => {
      const isSelected = props.selectedId === p.id

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: isSelected ? 10 : 7,
        weight: isSelected ? 3 : 2,
        opacity: 1,
        fillOpacity: 0.9,
      })

      marker.on("click", () => props.onSelect(p.id))
      marker.addTo(layer)
    })

    // Fit bounds only when:
    // - there is NO selection
    // - and the user hasn't manually moved the map yet
    if (props.selectedId == null && !userMovedRef.current) {
      const bounds = L.latLngBounds(props.points.map((p: Point) => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [props.points, props.selectedId, props.onSelect, defaultCenter.lat, defaultCenter.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (props.selectedId == null) return

    const selected = props.points.find((p) => p.id === props.selectedId)
    if (!selected) return

    // When user selects, we DO move the map (intentional).
    map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), 12), { animate: true })
  }, [props.selectedId, props.points])

  return (
    <div className="rounded-xl border border-emerald-100 bg-white shadow-sm overflow-hidden relative">
      <div ref={mapDivRef} className="h-[560px] w-full" />

      {tileError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 p-6 text-center">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Map tiles blocked</div>
            <div className="mt-1 text-xs text-zinc-600">
              Your network may be blocking OpenStreetMap tiles. Pins still work when tiles are available.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
