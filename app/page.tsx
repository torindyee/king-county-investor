"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { LISTINGS } from "./lib/listings"
import { Scenario, fmtMoney, fmtPct, underwriting } from "./lib/finance"
import { getFavorites, toggleFavorite } from "./lib/favorites"

type SortKey = "cashFlow" | "coc" | "cap" | "rentToPayment" | "price" | "rent"

const DEFAULT_SCENARIO: Scenario = {
  downPaymentPct: 0.25,
  interestRatePct: 6.75,
  termYears: 30,
  propertyTaxRatePct: 1.0,
  insuranceMonthly: 180,
  hoaMonthly: 0,
  vacancyPct: 0.06,
  managementPct: 0.08,
  maintenancePct: 0.07,
}

function SliderRow(props: {
  label: string
  valueLabel: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-800">{props.label}</div>
        <div className="text-sm text-zinc-600">{props.valueLabel}</div>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-emerald-700"
      />
    </div>
  )
}

function NumberField(props: {
  label: string
  value: number
  onChange: (v: number) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-zinc-600">{props.label}</div>
      <input
        inputMode="numeric"
        value={props.value ? props.value : ""}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  )
}

// Leaflet Map (CDN) — no installs
function ListingMap(props: {
  points: { id: number; lat: number; lng: number; label: string }[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

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
        const id = "leaflet-js"
        if ((window as any).L) return resolve()
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

      const L = (window as any).L
      if (!mapDivRef.current) return
      if (!mapRef.current) {
        mapRef.current = L.map(mapDivRef.current, {
          zoomControl: true,
          attributionControl: true,
        })

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(mapRef.current)

        markersLayerRef.current = L.layerGroup().addTo(mapRef.current)
      }
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
      const marker = L.marker([p.lat, p.lng]).addTo(markersLayerRef.current)
      marker.bindPopup(p.label)
      marker.on("click", () => props.onSelect(p.id))
      bounds.push([p.lat, p.lng])
    })

    if (props.points.length > 0 && !props.selectedId) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30] })
    }

    if (props.selectedId) {
      const chosen = props.points.find((x) => x.id === props.selectedId)
      if (chosen) {
        mapRef.current.setView([chosen.lat, chosen.lng], 14)
      }
    }
  }, [props.points, props.selectedId, props.onSelect])

  return (
    <div className="rounded-xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
      <div ref={mapDivRef} className="h-[560px] w-full" />
    </div>
  )
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [sortKey, setSortKey] = useState<SortKey>("cashFlow")
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [favorites, setFavorites] = useState<number[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)
  const [minRent, setMinRent] = useState(0)
  const [maxRent, setMaxRent] = useState(0)
  const [minMortgage, setMinMortgage] = useState(0)
  const [maxMortgage, setMaxMortgage] = useState(0)
  const [minCashFlow, setMinCashFlow] = useState(0)

  useEffect(() => {
    setFavorites(getFavorites())
  }, [])

  const rows = useMemo(() => {
    const computed = LISTINGS.map((l) => {
      const s: Scenario = { ...scenario, hoaMonthly: (l.hoaMonthly ?? 0) + scenario.hoaMonthly }
      const u = underwriting({ price: l.price, rentMonthly: l.rentEstimate, scenario: s })

      const quickRentMinusMortgage = l.rentEstimate - u.mortgage
      const otherCosts =
        u.taxesMonthly +
        u.insuranceMonthly +
        u.hoaMonthly +
        u.vacancy +
        u.management +
        u.maintenance

      return { listing: l, u, quickRentMinusMortgage, otherCosts }
    })

    const filtered = computed.filter(({ listing, u }) => {
      const priceOk =
        (minPrice ? listing.price >= minPrice : true) &&
        (maxPrice ? listing.price <= maxPrice : true)

      const rentOk =
        (minRent ? listing.rentEstimate >= minRent : true) &&
        (maxRent ? listing.rentEstimate <= maxRent : true)

      const mortgageOk =
        (minMortgage ? u.mortgage >= minMortgage : true) &&
        (maxMortgage ? u.mortgage <= maxMortgage : true)

      const cashFlowOk = minCashFlow ? u.cashFlow >= minCashFlow : true
      const favOk = onlyFavorites ? favorites.includes(listing.id) : true

      return priceOk && rentOk && mortgageOk && cashFlowOk && favOk
    })

    const sorted = [...filtered].sort((a, b) => {
      const get = (x: typeof a) => {
        if (sortKey === "cashFlow") return x.u.cashFlow
        if (sortKey === "coc") return x.u.cocReturnPct
        if (sortKey === "cap") return x.u.capRatePct
        if (sortKey === "rentToPayment") return x.u.rentToPayment
        if (sortKey === "price") return x.listing.price
        return x.listing.rentEstimate
      }
      return get(b) - get(a)
    })

    return sorted
  }, [
    scenario,
    sortKey,
    minPrice,
    maxPrice,
    minRent,
    maxRent,
    minMortgage,
    maxMortgage,
    minCashFlow,
    onlyFavorites,
    favorites,
  ])

  const mapPoints = useMemo(() => {
    return rows.map((r) => ({
      id: r.listing.id,
      lat: r.listing.lat,
      lng: r.listing.lng,
      label: `${r.listing.address}, ${r.listing.city}`,
    }))
  }, [rows])

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            King County Investment Finder
          </h1>
          <p className="text-sm text-zinc-700">
            Compare rent vs mortgage fast, then see true all in cash flow with realistic assumptions.
          </p>
          <p className="text-xs text-zinc-500">{favorites.length} saved properties</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left panel */}
          <div className="lg:col-span-4">
            <div className="sticky top-6 space-y-4">
              {/* View + sort */}
              <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900">View</div>

                  <div className="flex overflow-hidden rounded-md border border-emerald-100 bg-white">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-2 text-sm ${
                        viewMode === "list" ? "bg-emerald-800 text-white" : "text-zinc-700"
                      }`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setViewMode("map")}
                      className={`px-3 py-2 text-sm ${
                        viewMode === "map" ? "bg-emerald-800 text-white" : "text-zinc-700"
                      }`}
                    >
                      Map
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="text-xs text-zinc-600">Sort</div>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="cashFlow">Cash flow</option>
                    <option value="coc">Cash-on-cash</option>
                    <option value="cap">Cap rate</option>
                    <option value="rentToPayment">Rent ÷ Payment</option>
                    <option value="price">Price</option>
                    <option value="rent">Rent</option>
                  </select>
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={onlyFavorites}
                    onChange={(e) => setOnlyFavorites(e.target.checked)}
                    className="accent-emerald-800"
                  />
                  Favorites only
                </label>
              </div>

              {/* Assumptions */}
              <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900">Assumptions</div>
                  <button
                    onClick={() => setScenario(DEFAULT_SCENARIO)}
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <SliderRow
                    label="Interest rate"
                    valueLabel={`${scenario.interestRatePct.toFixed(2)}%`}
                    min={3}
                    max={10}
                    step={0.05}
                    value={scenario.interestRatePct}
                    onChange={(v) => setScenario({ ...scenario, interestRatePct: v })}
                  />

                  <SliderRow
                    label="Down payment"
                    valueLabel={`${Math.round(scenario.downPaymentPct * 100)}%`}
                    min={5}
                    max={40}
                    step={1}
                    value={Math.round(scenario.downPaymentPct * 100)}
                    onChange={(v) => setScenario({ ...scenario, downPaymentPct: v / 100 })}
                  />

                  <SliderRow
                    label="Property tax rate (annual)"
                    valueLabel={`${scenario.propertyTaxRatePct.toFixed(2)}%`}
                    min={0.5}
                    max={2.0}
                    step={0.01}
                    value={scenario.propertyTaxRatePct}
                    onChange={(v) => setScenario({ ...scenario, propertyTaxRatePct: v })}
                  />

                  <SliderRow
                    label="Insurance (monthly)"
                    valueLabel={fmtMoney(scenario.insuranceMonthly)}
                    min={50}
                    max={400}
                    step={10}
                    value={scenario.insuranceMonthly}
                    onChange={(v) => setScenario({ ...scenario, insuranceMonthly: v })}
                  />

                  <SliderRow
                    label="Extra HOA (monthly)"
                    valueLabel={fmtMoney(scenario.hoaMonthly)}
                    min={0}
                    max={600}
                    step={25}
                    value={scenario.hoaMonthly}
                    onChange={(v) => setScenario({ ...scenario, hoaMonthly: v })}
                  />

                  {/* Adjustable reserve percentages */}
                  <SliderRow
                    label="Vacancy"
                    valueLabel={`${Math.round(scenario.vacancyPct * 100)}%`}
                    min={0}
                    max={15}
                    step={1}
                    value={Math.round(scenario.vacancyPct * 100)}
                    onChange={(v) => setScenario({ ...scenario, vacancyPct: v / 100 })}
                  />
                  <SliderRow
                    label="Management"
                    valueLabel={`${Math.round(scenario.managementPct * 100)}%`}
                    min={0}
                    max={15}
                    step={1}
                    value={Math.round(scenario.managementPct * 100)}
                    onChange={(v) => setScenario({ ...scenario, managementPct: v / 100 })}
                  />
                  <SliderRow
                    label="Maintenance"
                    valueLabel={`${Math.round(scenario.maintenancePct * 100)}%`}
                    min={0}
                    max={20}
                    step={1}
                    value={Math.round(scenario.maintenancePct * 100)}
                    onChange={(v) => setScenario({ ...scenario, maintenancePct: v / 100 })}
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900">Filters</div>
                  <button
                    onClick={() => {
                      setMinPrice(0); setMaxPrice(0)
                      setMinRent(0); setMaxRent(0)
                      setMinMortgage(0); setMaxMortgage(0)
                      setMinCashFlow(0)
                    }}
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <NumberField label="Price min" value={minPrice} onChange={setMinPrice} placeholder="e.g. 600000" />
                  <NumberField label="Price max" value={maxPrice} onChange={setMaxPrice} placeholder="e.g. 900000" />

                  <NumberField label="Rent min" value={minRent} onChange={setMinRent} placeholder="e.g. 3000" />
                  <NumberField label="Rent max" value={maxRent} onChange={setMaxRent} placeholder="e.g. 5500" />

                  <NumberField label="Mortgage min" value={minMortgage} onChange={setMinMortgage} placeholder="e.g. 2500" />
                  <NumberField label="Mortgage max" value={maxMortgage} onChange={setMaxMortgage} placeholder="e.g. 4500" />

                  <div className="col-span-2">
                    <NumberField label="Cash flow min" value={minCashFlow} onChange={setMinCashFlow} placeholder="e.g. 200" />
                  </div>
                </div>

                <div className="mt-4 text-xs text-zinc-600">{rows.length} results</div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-8">
            {viewMode === "list" ? (
              <div className="grid gap-4">
                {rows.map(({ listing, u, quickRentMinusMortgage, otherCosts }) => {
                  const cashFlowColor = u.cashFlow >= 0 ? "text-emerald-700" : "text-rose-600"
                  const quickColor = quickRentMinusMortgage >= 0 ? "text-emerald-700" : "text-rose-600"

                  return (
                    <Link
                      key={listing.id}
                      href={`/listing/${String(listing.id)}`}
                      className="group overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row">
                        <div className="relative h-56 w-full sm:h-auto sm:w-72">
                          <img src={listing.images[0]} alt="Listing" className="h-full w-full object-cover" />

                          {favorites.includes(listing.id) && (
                            <div className="absolute right-3 top-3 rounded-full bg-emerald-800 px-3 py-1 text-xs font-semibold text-white">
                              Saved
                            </div>
                          )}
                        </div>

                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-lg font-semibold text-zinc-900 group-hover:underline">
                                {listing.address}, {listing.city}
                              </div>
                              <div className="mt-1 text-sm text-zinc-600">
                                {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft
                              </div>
                            </div>

                            {/* smaller save */}
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const next = toggleFavorite(listing.id)
                                setFavorites(next)
                              }}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                favorites.includes(listing.id)
                                  ? "border-emerald-800 bg-emerald-800 text-white"
                                  : "border-zinc-200 bg-white text-zinc-900 hover:border-emerald-300"
                              }`}
                            >
                              {favorites.includes(listing.id) ? "Saved" : "Save"}
                            </button>
                          </div>

                          {/* Price prominent */}
                          <div className="mt-3 flex items-end justify-between">
                            <div>
                              <div className="text-xs text-zinc-600">Price</div>
                              <div className="text-2xl font-bold text-zinc-900">{fmtMoney(listing.price)}</div>
                            </div>

                            <div className="text-right text-xs text-zinc-500">
                              CoC {fmtPct(u.cocReturnPct)} · Cap {fmtPct(u.capRatePct)}
                            </div>
                          </div>

                          {/* Main investor metrics */}
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                              <div className="text-xs text-zinc-600">Est rent</div>
                              <div className="text-sm font-semibold text-zinc-900">{fmtMoney(listing.rentEstimate)}</div>
                            </div>
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                              <div className="text-xs text-zinc-600">Mortgage</div>
                              <div className="text-sm font-semibold text-zinc-900">{fmtMoney(u.mortgage)}</div>
                            </div>
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                              <div className="text-xs text-zinc-600">All in cash flow</div>
                              <div className={`text-sm font-semibold ${cashFlowColor}`}>{fmtMoney(u.cashFlow)}</div>
                            </div>
                          </div>

                          {/* Explain the difference */}
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                              <div className="text-xs text-zinc-600">Rent − Mortgage (quick)</div>
                              <div className={`text-sm font-semibold ${quickColor}`}>{fmtMoney(quickRentMinusMortgage)}</div>
                            </div>

                            <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:col-span-2">
                              <div className="text-xs text-zinc-600">Other costs (tax, ins, HOA, reserves)</div>
                              <div className="text-sm font-semibold text-zinc-900">{fmtMoney(otherCosts)}</div>
                              <div className="mt-1 text-[11px] text-zinc-500">
                                Taxes {fmtMoney(u.taxesMonthly)} · Ins {fmtMoney(u.insuranceMonthly)} · HOA {fmtMoney(u.hoaMonthly)} · Vacancy {fmtMoney(u.vacancy)} · Mgmt {fmtMoney(u.management)} · Maint {fmtMoney(u.maintenance)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-600">
                            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                              Rent ÷ Payment: {u.rentToPayment.toFixed(2)}x
                            </span>
                            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                              Taxes: {fmtMoney(u.taxesMonthly)}/mo
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <ListingMap
                    points={mapPoints}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId(id)}
                  />
                  {!selectedId && (
                    <div className="mt-2 text-xs text-zinc-600">
                      Pins show all filtered listings. Click a pin or listing to focus.
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 space-y-3">
                  {rows.map(({ listing, u }) => {
                    const isSelected = listing.id === selectedId
                    return (
                      <div
                        key={listing.id}
                        className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition ${
                          isSelected ? "border-emerald-800 ring-2 ring-emerald-100" : "border-emerald-100 hover:border-emerald-200"
                        }`}
                        onClick={() => setSelectedId(listing.id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">
                              {listing.address}, {listing.city}
                            </div>
                            <div className="mt-1 text-xs text-zinc-600">
                              {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft
                            </div>
                          </div>
                          <div className={`text-sm font-bold ${u.cashFlow >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                            {fmtMoney(u.cashFlow)}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const next = toggleFavorite(listing.id)
                              setFavorites(next)
                            }}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              favorites.includes(listing.id)
                                ? "border-emerald-800 bg-emerald-800 text-white"
                                : "border-zinc-200 bg-white text-zinc-900 hover:border-emerald-300"
                            }`}
                          >
                            {favorites.includes(listing.id) ? "Saved" : "Save"}
                          </button>

                          <Link
                            href={`/listing/${String(listing.id)}`}
                            className="text-xs font-semibold text-emerald-800 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-10 text-xs text-zinc-500">
              Demo data only. Later you’ll replace LISTINGS with NWMLS feed data.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
