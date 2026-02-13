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
  const markersRef = useRef<any[]>([])
  const [tileError, setTileError] = useState(false)

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
      }
    }

    loadLeaflet()

    return () => {
      cancelled = true
    }
  }, [])

  const center = useMemo(() => {
    if (props.points.length === 0) return { lat: 47.6062, lng: -122.3321 }
    return { lat: props.points[0].lat, lng: props.points[0].lng }
  }, [props.points])

  useEffect(() => {
    const L = (window as any).L
    const map = mapRef.current
    if (!L || !map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (props.points.length === 0) {
      map.setView([center.lat, center.lng], 10)
      return
    }

    const bounds = L.latLngBounds(props.points.map((p: Point) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40] })

    props.points.forEach((p) => {
      const marker = L.marker([p.lat, p.lng]).addTo(map)
      marker.on("click", () => props.onSelect(p.id))
      markersRef.current.push(marker)
    })
  }, [props.points, props.onSelect, center.lat, center.lng])

  useEffect(() => {
    const L = (window as any).L
    const map = mapRef.current
    if (!L || !map) return
    if (props.selectedId == null) return

    const selected = props.points.find((p) => p.id === props.selectedId)
    if (!selected) return

    map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), 12))
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
