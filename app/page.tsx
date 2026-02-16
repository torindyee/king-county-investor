"use client"

import Link from "next/link"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { LISTINGS, ListingType } from "./lib/listings"
import ListingMap from "./ListingMap"
import { Scenario, fmtMoney, fmtPct, underwriting } from "./lib/finance"
import { getFavorites, toggleFavorite } from "./lib/favorites"

type SortKey = "cashFlow" | "coc" | "cap" | "rentToPayment" | "price" | "rent"
type DownPaymentMode = "percent" | "amount"

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

/** ---------- Utils / UI helpers ---------- */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function Chevron(props: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-4 w-4 text-zinc-600 transition", props.open && "rotate-180")}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.937a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function Chip(props: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:border-emerald-200 hover:bg-emerald-50"
    >
      {props.label}
    </button>
  )
}

function GhostButton(props: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
    >
      {props.children}
    </button>
  )
}

function NumberField(props: {
  label: string
  value: number
  onChange: (v: number) => void
  placeholder?: string
  suffix?: string
  smallHint?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-600">{props.label}</div>
        {props.smallHint && <div className="text-[11px] text-zinc-500">{props.smallHint}</div>}
      </div>

      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={Number.isFinite(props.value) ? props.value : ""}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(Number(e.target.value))}
          className={cn(
            "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm outline-none",
            "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          )}
        />
        {props.suffix && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
            {props.suffix}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * "Two-handle" range slider:
 * - One slider for min
 * - One slider for max
 * - Guardrails prevent crossing
 */
function RangeSlider(props: {
  label: string
  min: number
  max: number
  step: number
  valueMin: number
  valueMax: number
  onChange: (nextMin: number, nextMax: number) => void
  format: (n: number) => string
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState<"min" | "max" | null>(null)

  const safeMin = clamp(Math.min(props.valueMin, props.valueMax), props.min, props.max)
  const safeMax = clamp(Math.max(props.valueMin, props.valueMax), props.min, props.max)

  const range = props.max - props.min
  const leftPct = range === 0 ? 0 : ((safeMin - props.min) / range) * 100
  const rightPct = range === 0 ? 0 : ((safeMax - props.min) / range) * 100

  const snap = (v: number) => {
    const stepped = Math.round((v - props.min) / props.step) * props.step + props.min
    return clamp(stepped, props.min, props.max)
  }

  const valueFromClientX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return props.min
    const r = el.getBoundingClientRect()
    const t = clamp((clientX - r.left) / r.width, 0, 1)
    return snap(props.min + t * (props.max - props.min))
  }

  useEffect(() => {
    if (!active) return

    const onMove = (e: PointerEvent) => {
      const v = valueFromClientX(e.clientX)
      if (active === "min") props.onChange(Math.min(v, safeMax), safeMax)
      if (active === "max") props.onChange(safeMin, Math.max(v, safeMin))
    }

    const onUp = () => setActive(null)

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)

    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, safeMin, safeMax])

  const onTrackPointerDown = (e: React.PointerEvent) => {
    const v = valueFromClientX(e.clientX)
    const distToMin = Math.abs(v - safeMin)
    const distToMax = Math.abs(v - safeMax)
    const which: "min" | "max" = distToMin <= distToMax ? "min" : "max"
    setActive(which)
    if (which === "min") props.onChange(Math.min(v, safeMax), safeMax)
    else props.onChange(safeMin, Math.max(v, safeMin))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-600">{props.label}</div>
        <div className="text-xs text-zinc-700">
          <span className="font-semibold">{props.format(safeMin)}</span>
          <span className="mx-1 text-zinc-400">—</span>
          <span className="font-semibold">{props.format(safeMax)}</span>
        </div>
      </div>

      <div className="relative h-9">
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 cursor-pointer rounded-full bg-zinc-200"
        />

        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-700"
          style={{ left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
        />

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActive("min")
          }}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-700 bg-white shadow-sm"
          style={{ left: `${leftPct}%`, width: 18, height: 18 }}
          aria-label={`${props.label} minimum`}
        />

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActive("max")
          }}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-700 bg-white shadow-sm"
          style={{ left: `${rightPct}%`, width: 18, height: 18 }}
          aria-label={`${props.label} maximum`}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>{props.format(props.min)}</span>
        <span>{props.format(props.max)}</span>
      </div>
    </div>
  )
}

/** ---------- Per-listing estimates (demo heuristic) ---------- */

function estimateTaxRatePct(listing: (typeof LISTINGS)[number]) {
  let rate = 1.02
  const city = listing.city.toLowerCase()
  if (city.includes("seattle")) rate -= 0.05
  if (city.includes("bellevue")) rate += 0.06
  if (city.includes("kirkland")) rate += 0.03
  if (city.includes("sammamish")) rate += 0.02
  if (city.includes("renton")) rate += 0.01
  if (listing.type === "Condo") rate -= 0.03
  return clamp(rate, 0.85, 1.35)
}

function estimateInsuranceMonthly(listing: (typeof LISTINGS)[number]) {
  let annualPct = 0.0032
  if (listing.type === "Condo") annualPct = 0.0020
  if (listing.type === "Townhome") annualPct = 0.0026
  // Houses remain baseline
  const price = listing.price
  if (price < 600000) annualPct += 0.0004
  if (price > 1200000) annualPct -= 0.0004
  const annual = price * annualPct
  return Math.round(annual / 12 / 10) * 10
}

/** ---------- Hover popover that won’t clip ---------- */

function HoverCard(props: { anchor: React.ReactNode; children: React.ReactNode; width?: number }) {
  // Important: wrapper must be overflow-visible and positioned
  return (
    <div className="relative overflow-visible">
      <div className="group inline-block overflow-visible">
        {props.anchor}
        <div
          className="pointer-events-none absolute right-0 top-full z-[999] mt-2 hidden rounded-xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-700 shadow-xl group-hover:block"
          style={{ width: props.width ?? 360 }}
        >
          {props.children}
        </div>
      </div>
    </div>
  )
}

/** ---------- Page ---------- */

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [sortKey, setSortKey] = useState<SortKey>("cashFlow")
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [favorites, setFavorites] = useState<number[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  const [filtersOpen, setFiltersOpen] = useState(true)
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)

  // New: Beds/Baths/Type filters
  const [bedsMin, setBedsMin] = useState<number>(0) // 0 = any
  const [bathsMin, setBathsMin] = useState<number>(0) // 0 = any
  const [types, setTypes] = useState<Record<ListingType, boolean>>({
    House: true,
    Condo: true,
    Townhome: true,
  })

  // Down payment input
  const [dpMode, setDpMode] = useState<DownPaymentMode>("percent")
  const [dpInput, setDpInput] = useState(Math.round(DEFAULT_SCENARIO.downPaymentPct * 100))

  const basePriceForDownPayment = useMemo(() => {
    const prices = LISTINGS.map((l) => l.price).slice().sort((a, b) => a - b)
    const mid = Math.floor(prices.length / 2)
    return prices.length % 2 === 0 ? Math.round((prices[mid - 1] + prices[mid]) / 2) : prices[mid]
  }, [])

  const stats = useMemo(() => {
    const prices = LISTINGS.map((l) => l.price)
    const rents = LISTINGS.map((l) => l.rentEstimate)
    const hoas = LISTINGS.map((l) => l.hoaMonthly ?? 0)

    const mortgages = LISTINGS.map((l) => {
      const s: Scenario = {
        ...scenario,
        hoaMonthly: (l.hoaMonthly ?? 0) + scenario.hoaMonthly,
        propertyTaxRatePct: estimateTaxRatePct(l),
        insuranceMonthly: estimateInsuranceMonthly(l),
      }
      const u = underwriting({ price: l.price, rentMonthly: l.rentEstimate, scenario: s })
      // “Mortgage” slider here means “All-in payment” (P&I + tax + ins + HOA) for filtering
      return u.mortgage + u.taxesMonthly + u.insuranceMonthly + u.hoaMonthly
    })

    const min = (arr: number[]) => Math.min(...arr)
    const max = (arr: number[]) => Math.max(...arr)

    return {
      priceMin: min(prices),
      priceMax: max(prices),
      rentMin: min(rents),
      rentMax: max(rents),
      hoaMin: min(hoas),
      hoaMax: max(hoas),
      paymentMin: min(mortgages),
      paymentMax: max(mortgages),
    }
  }, [scenario])

  // Range state
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(0)
  const [rentMin, setRentMin] = useState(0)
  const [rentMax, setRentMax] = useState(0)
  const [hoaMin, setHoaMin] = useState(0)
  const [hoaMax, setHoaMax] = useState(0)
  const [paymentMin, setPaymentMin] = useState(0)
  const [paymentMax, setPaymentMax] = useState(0)

  const [minCashFlow, setMinCashFlow] = useState(0)

  useEffect(() => {
    if (priceMin === 0 && priceMax === 0) {
      setPriceMin(stats.priceMin)
      setPriceMax(stats.priceMax)
    } else {
      setPriceMin((v) => clamp(v, stats.priceMin, stats.priceMax))
      setPriceMax((v) => clamp(v, stats.priceMin, stats.priceMax))
    }

    if (rentMin === 0 && rentMax === 0) {
      setRentMin(stats.rentMin)
      setRentMax(stats.rentMax)
    } else {
      setRentMin((v) => clamp(v, stats.rentMin, stats.rentMax))
      setRentMax((v) => clamp(v, stats.rentMin, stats.rentMax))
    }

    if (hoaMin === 0 && hoaMax === 0) {
      setHoaMin(stats.hoaMin)
      setHoaMax(stats.hoaMax)
    } else {
      setHoaMin((v) => clamp(v, stats.hoaMin, stats.hoaMax))
      setHoaMax((v) => clamp(v, stats.hoaMin, stats.hoaMax))
    }

    if (paymentMin === 0 && paymentMax === 0) {
      setPaymentMin(stats.paymentMin)
      setPaymentMax(stats.paymentMax)
    } else {
      setPaymentMin((v) => clamp(v, stats.paymentMin, stats.paymentMax))
      setPaymentMax((v) => clamp(v, stats.paymentMin, stats.paymentMax))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats])

  useEffect(() => {
    setFavorites(getFavorites())
  }, [])

  useEffect(() => {
    if (dpMode === "percent") {
      const pct = dpInput / 100
      if (Number.isFinite(pct) && pct > 0) setScenario((s) => ({ ...s, downPaymentPct: pct }))
    } else {
      const pct = dpInput / basePriceForDownPayment
      if (Number.isFinite(pct) && pct > 0) setScenario((s) => ({ ...s, downPaymentPct: pct }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpInput, dpMode, basePriceForDownPayment])

  useEffect(() => {
    if (dpMode === "percent") setDpInput(Math.round(scenario.downPaymentPct * 100))
    else setDpInput(Math.round(scenario.downPaymentPct * basePriceForDownPayment))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.downPaymentPct])

  const rows = useMemo(() => {
    const computed = LISTINGS.map((l) => {
      const estTaxRatePct = estimateTaxRatePct(l)
      const estInsuranceMonthly = estimateInsuranceMonthly(l)

      const s: Scenario = {
        ...scenario,
        hoaMonthly: (l.hoaMonthly ?? 0) + scenario.hoaMonthly,
        propertyTaxRatePct: estTaxRatePct,
        insuranceMonthly: estInsuranceMonthly,
      }

      const u = underwriting({ price: l.price, rentMonthly: l.rentEstimate, scenario: s })

      // “Payment” = mortgage (P&I) + tax + insurance + HOA (NO vacancy/management/maintenance)
      const allInPayment = u.mortgage + u.taxesMonthly + u.insuranceMonthly + u.hoaMonthly
      const rentMinusPayment = l.rentEstimate - allInPayment

      // Cash flow already includes vacancy/management/maintenance (reserves)
      return { listing: l, u, allInPayment, rentMinusPayment, estTaxRatePct, estInsuranceMonthly }
    })

    const filtered = computed.filter(({ listing, u, allInPayment }) => {
      const priceOk = listing.price >= priceMin && listing.price <= priceMax
      const rentOk = listing.rentEstimate >= rentMin && listing.rentEstimate <= rentMax

      const hoa = listing.hoaMonthly ?? 0
      const hoaOk = hoa >= hoaMin && hoa <= hoaMax

      const paymentOk = allInPayment >= paymentMin && allInPayment <= paymentMax
      const cashFlowOk = minCashFlow ? u.cashFlow >= minCashFlow : true
      const favOk = onlyFavorites ? favorites.includes(listing.id) : true

      const bedsOk = bedsMin ? listing.beds >= bedsMin : true
      const bathsOk = bathsMin ? listing.baths >= bathsMin : true

      const typeOk = types[listing.type] === true

      return priceOk && rentOk && hoaOk && paymentOk && cashFlowOk && favOk && bedsOk && bathsOk && typeOk
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
    priceMin,
    priceMax,
    rentMin,
    rentMax,
    hoaMin,
    hoaMax,
    paymentMin,
    paymentMax,
    minCashFlow,
    onlyFavorites,
    favorites,
    bedsMin,
    bathsMin,
    types,
  ])

  const mapPoints = useMemo(() => {
    return rows.map((r) => ({
      id: r.listing.id,
      lat: r.listing.lat,
      lng: r.listing.lng,
      label: `${r.listing.address}, ${r.listing.city}`,
    }))
  }, [rows])

  const activeChips = useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = []

    if (priceMin !== stats.priceMin || priceMax !== stats.priceMax) {
      chips.push({
        label: `Price ${fmtMoney(priceMin)}—${fmtMoney(priceMax)}`,
        clear: () => {
          setPriceMin(stats.priceMin)
          setPriceMax(stats.priceMax)
        },
      })
    }

    if (rentMin !== stats.rentMin || rentMax !== stats.rentMax) {
      chips.push({
        label: `Rent ${fmtMoney(rentMin)}—${fmtMoney(rentMax)}`,
        clear: () => {
          setRentMin(stats.rentMin)
          setRentMax(stats.rentMax)
        },
      })
    }

    if (hoaMin !== stats.hoaMin || hoaMax !== stats.hoaMax) {
      chips.push({
        label: `HOA ${fmtMoney(hoaMin)}—${fmtMoney(hoaMax)}`,
        clear: () => {
          setHoaMin(stats.hoaMin)
          setHoaMax(stats.hoaMax)
        },
      })
    }

    if (paymentMin !== stats.paymentMin || paymentMax !== stats.paymentMax) {
      chips.push({
        label: `All-in payment ${fmtMoney(paymentMin)}—${fmtMoney(paymentMax)}`,
        clear: () => {
          setPaymentMin(stats.paymentMin)
          setPaymentMax(stats.paymentMax)
        },
      })
    }

    if (bedsMin) chips.push({ label: `Beds ≥ ${bedsMin}`, clear: () => setBedsMin(0) })
    if (bathsMin) chips.push({ label: `Baths ≥ ${bathsMin}`, clear: () => setBathsMin(0) })

    const typeOff = (Object.keys(types) as ListingType[]).filter((t) => !types[t])
    if (typeOff.length > 0 && typeOff.length < 3) {
      chips.push({
        label: `Type: ${(Object.keys(types) as ListingType[]).filter((t) => types[t]).join(", ")}`,
        clear: () => setTypes({ House: true, Condo: true, Townhome: true }),
      })
    }

    if (minCashFlow) chips.push({ label: `Cash flow ≥ ${fmtMoney(minCashFlow)}`, clear: () => setMinCashFlow(0) })
    if (onlyFavorites) chips.push({ label: `Favorites only`, clear: () => setOnlyFavorites(false) })

    return chips
  }, [
    priceMin,
    priceMax,
    rentMin,
    rentMax,
    hoaMin,
    hoaMax,
    paymentMin,
    paymentMax,
    bedsMin,
    bathsMin,
    types,
    minCashFlow,
    onlyFavorites,
    stats,
  ])

  function clearAll() {
    setPriceMin(stats.priceMin)
    setPriceMax(stats.priceMax)
    setRentMin(stats.rentMin)
    setRentMax(stats.rentMax)
    setHoaMin(stats.hoaMin)
    setHoaMax(stats.hoaMax)
    setPaymentMin(stats.paymentMin)
    setPaymentMax(stats.paymentMax)
    setBedsMin(0)
    setBathsMin(0)
    setTypes({ House: true, Condo: true, Townhome: true })
    setMinCashFlow(0)
    setOnlyFavorites(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-zinc-50 to-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">King County Investment Finder</h1>
              <p className="mt-1 text-sm text-zinc-700">Scan deals fast. Sort by performance. Adjust assumptions to match your strategy.</p>
              <p className="mt-1 text-xs text-zinc-500">{favorites.length} saved properties</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-md border border-emerald-100 bg-white">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn("px-3 py-2 text-sm", viewMode === "list" ? "bg-emerald-800 text-white" : "text-zinc-700")}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={cn("px-3 py-2 text-sm", viewMode === "map" ? "bg-emerald-800 text-white" : "text-zinc-700")}
                >
                  Map
                </button>
              </div>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="cashFlow">Sort: Cash flow</option>
                <option value="coc">Sort: Cash-on-cash</option>
                <option value="cap">Sort: Cap rate</option>
                <option value="rentToPayment">Sort: Rent ÷ Payment</option>
                <option value="price">Sort: Price</option>
                <option value="rent">Sort: Rent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sticky controls (solid backdrop + divider so you can't see listings behind) */}
        <div className="sticky top-0 z-40 mt-6">
          <div className="rounded-xl border border-emerald-100 bg-white/95 backdrop-blur shadow-sm">
            {/* Results + chips */}
            <div className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold text-zinc-700">
                    Showing {rows.length} result{rows.length === 1 ? "" : "s"}
                  </div>

                  {activeChips.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {activeChips.map((c) => (
                        <Chip key={c.label} label={`✕ ${c.label}`} onClick={c.clear} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">No filters applied</div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={onlyFavorites}
                      onChange={(e) => setOnlyFavorites(e.target.checked)}
                      className="accent-emerald-800"
                    />
                    Favorites only
                  </label>
                  <GhostButton onClick={clearAll}>Clear all</GhostButton>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100" />

            {/* Filters + Assumptions */}
            <div className="grid gap-4 p-3 lg:grid-cols-12">
              {/* Filters */}
              <div className="lg:col-span-8">
                <div className="rounded-xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50"
                  >
                    <div className="text-sm font-semibold text-zinc-900">Filters</div>
                    <Chevron open={filtersOpen} />
                  </button>

                  {filtersOpen && (
                    <div className="border-t border-zinc-100 p-4">
                      <div className="flex items-center justify-between pb-3">
                        <div className="text-xs font-semibold text-zinc-700">Quick filters</div>
                        <button
                          onClick={() => {
                            setPriceMin(stats.priceMin)
                            setPriceMax(stats.priceMax)
                            setRentMin(stats.rentMin)
                            setRentMax(stats.rentMax)
                            setHoaMin(stats.hoaMin)
                            setHoaMax(stats.hoaMax)
                            setPaymentMin(stats.paymentMin)
                            setPaymentMax(stats.paymentMax)
                            setBedsMin(0)
                            setBathsMin(0)
                            setTypes({ House: true, Condo: true, Townhome: true })
                            setMinCashFlow(0)
                            setOnlyFavorites(false)
                          }}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                          type="button"
                        >
                          Reset filters
                        </button>
                      </div>

                      {/* Beds / Baths / Type */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-zinc-600">Beds</div>
                          <select
                            value={bedsMin}
                            onChange={(e) => setBedsMin(Number(e.target.value))}
                            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                          >
                            <option value={0}>Any</option>
                            <option value={1}>1+</option>
                            <option value={2}>2+</option>
                            <option value={3}>3+</option>
                            <option value={4}>4+</option>
                            <option value={5}>5+</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-medium text-zinc-600">Baths</div>
                          <select
                            value={bathsMin}
                            onChange={(e) => setBathsMin(Number(e.target.value))}
                            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                          >
                            <option value={0}>Any</option>
                            <option value={1}>1+</option>
                            <option value={1.5}>1.5+</option>
                            <option value={2}>2+</option>
                            <option value={2.5}>2.5+</option>
                            <option value={3}>3+</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-medium text-zinc-600">Type</div>
                          <div className="flex flex-wrap gap-2">
                            {(Object.keys(types) as ListingType[]).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setTypes((prev) => ({ ...prev, [t]: !prev[t] }))}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-semibold",
                                  types[t]
                                    ? "border-emerald-800 bg-emerald-800 text-white"
                                    : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300"
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <RangeSlider
                          label="Price"
                          min={stats.priceMin}
                          max={stats.priceMax}
                          step={5000}
                          valueMin={priceMin}
                          valueMax={priceMax}
                          onChange={(a, b) => {
                            setPriceMin(a)
                            setPriceMax(b)
                          }}
                          format={fmtMoney}
                        />

                        <RangeSlider
                          label="Rent"
                          min={stats.rentMin}
                          max={stats.rentMax}
                          step={50}
                          valueMin={rentMin}
                          valueMax={rentMax}
                          onChange={(a, b) => {
                            setRentMin(a)
                            setRentMax(b)
                          }}
                          format={fmtMoney}
                        />

                        <RangeSlider
                          label="HOA"
                          min={stats.hoaMin}
                          max={stats.hoaMax}
                          step={5}
                          valueMin={hoaMin}
                          valueMax={hoaMax}
                          onChange={(a, b) => {
                            setHoaMin(a)
                            setHoaMax(b)
                          }}
                          format={fmtMoney}
                        />

                        <RangeSlider
                          label="All-in payment (PITI + HOA)"
                          min={stats.paymentMin}
                          max={stats.paymentMax}
                          step={25}
                          valueMin={paymentMin}
                          valueMax={paymentMax}
                          onChange={(a, b) => {
                            setPaymentMin(a)
                            setPaymentMax(b)
                          }}
                          format={fmtMoney}
                        />

                        <div className="sm:col-span-2">
                          <NumberField
                            label="Cash flow min"
                            value={minCashFlow}
                            onChange={setMinCashFlow}
                            placeholder="e.g. 200"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Assumptions */}
              <div className="lg:col-span-4">
                <div className="rounded-xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAssumptionsOpen((v) => !v)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50"
                  >
                    <div className="text-sm font-semibold text-zinc-900">Assumptions</div>
                    <Chevron open={assumptionsOpen} />
                  </button>

                  {assumptionsOpen && (
                    <div className="border-t border-zinc-100 p-4">
                      <div className="flex items-center justify-end pb-3">
                        <button
                          onClick={() => setScenario(DEFAULT_SCENARIO)}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                          type="button"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <NumberField
                          label="Interest rate"
                          value={scenario.interestRatePct}
                          onChange={(v) => setScenario({ ...scenario, interestRatePct: v })}
                          placeholder="e.g. 6.75"
                          suffix="%"
                        />

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-zinc-600">Down payment</div>
                            <button
                              type="button"
                              onClick={() => setDpMode((m) => (m === "percent" ? "amount" : "percent"))}
                              className="text-[11px] font-semibold text-emerald-800 underline"
                            >
                              Use {dpMode === "percent" ? "$ amount" : "%"}
                            </button>
                          </div>

                          <NumberField
                            label={dpMode === "percent" ? "Percent" : "Amount"}
                            value={dpInput}
                            onChange={setDpInput}
                            placeholder={dpMode === "percent" ? "e.g. 20" : "e.g. 150000"}
                            suffix={dpMode === "percent" ? "%" : "$"}
                            smallHint={
                              dpMode === "percent"
                                ? `≈ ${fmtMoney(basePriceForDownPayment * (dpInput / 100))} on ${fmtMoney(basePriceForDownPayment)}`
                                : `≈ ${((dpInput / basePriceForDownPayment) * 100).toFixed(1)}% on ${fmtMoney(basePriceForDownPayment)}`
                            }
                          />

                          <div className="text-[11px] text-zinc-500">
                            Tax + insurance are estimated per listing (demo heuristic).
                          </div>
                        </div>

                        <div className="border-t border-zinc-100 pt-4">
                          <div className="text-xs font-semibold text-zinc-600">Operating reserves</div>

                          <div className="mt-3 space-y-4">
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
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom divider like Realtor */}
            <div className="border-t border-zinc-200" />
          </div>
        </div>

        {/* Main content */}
        <div className="mt-6">
          {viewMode === "list" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map(({ listing, u, allInPayment, rentMinusPayment, estInsuranceMonthly, estTaxRatePct }) => {
                const isSaved = favorites.includes(listing.id)
                const cashFlowColor = u.cashFlow >= 0 ? "text-emerald-700" : "text-rose-600"
                const deltaColor = rentMinusPayment >= 0 ? "text-emerald-700" : "text-rose-600"

                return (
                  <div key={listing.id} className="overflow-visible">
                    <Link
                      href={`/listing/${String(listing.id)}`}
                      className="block overflow-visible rounded-xl border border-emerald-100 bg-white shadow-sm transition hover:shadow-md"
                    >
                      {/* Image */}
                      <div className="relative h-56 w-full overflow-hidden rounded-t-xl">
                        <img src={listing.images[0]} alt="Listing" className="h-full w-full object-cover" />

                        {/* Save */}
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const next = toggleFavorite(listing.id)
                            setFavorites(next)
                          }}
                          className={cn(
                            "absolute right-3 top-3 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm",
                            isSaved
                              ? "border-emerald-800 bg-emerald-800 text-white"
                              : "border-zinc-200 bg-white text-zinc-900 hover:border-emerald-300"
                          )}
                        >
                          {isSaved ? "Saved" : "Save"}
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-4 overflow-visible">
                        <div className="flex items-start justify-between gap-4 overflow-visible">
                          <div className="min-w-0">
                            <div className="text-2xl font-bold text-zinc-900">{fmtMoney(listing.price)}</div>
                            <div className="mt-1 text-sm text-zinc-700">
                              {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft
                            </div>
                            <div className="mt-1 text-sm font-semibold text-zinc-900 truncate">
                              {listing.address}, {listing.city}
                            </div>
                          </div>

                          {/* Cash flow hover (NOT clipped) */}
                          <HoverCard
                            width={360}
                            anchor={
                              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-right shadow-sm">
                                <div className="text-xs text-zinc-600">Est cash flow</div>
                                <div className={cn("text-sm font-bold", cashFlowColor)}>{fmtMoney(u.cashFlow)}/mo</div>
                              </div>
                            }
                          >
                            <div className="text-xs font-semibold text-zinc-900">Cash flow breakdown</div>
                            <div className="mt-2 grid grid-cols-2 gap-y-1">
                              <div>Rent</div>
                              <div className="text-right font-semibold">{fmtMoney(listing.rentEstimate)}</div>

                              <div>Mortgage (P&I)</div>
                              <div className="text-right font-semibold">{fmtMoney(u.mortgage)}</div>

                              <div>Taxes (est)</div>
                              <div className="text-right font-semibold">
                                {fmtMoney(u.taxesMonthly)}{" "}
                                <span className="text-[10px] text-zinc-500">({estTaxRatePct.toFixed(2)}%)</span>
                              </div>

                              <div>Insurance (est)</div>
                              <div className="text-right font-semibold">{fmtMoney(estInsuranceMonthly)}</div>

                              <div>HOA</div>
                              <div className="text-right font-semibold">{fmtMoney(u.hoaMonthly)}</div>

                              <div>Vacancy</div>
                              <div className="text-right font-semibold">{fmtMoney(u.vacancy)}</div>

                              <div>Management</div>
                              <div className="text-right font-semibold">{fmtMoney(u.management)}</div>

                              <div>Maintenance</div>
                              <div className="text-right font-semibold">{fmtMoney(u.maintenance)}</div>
                            </div>

                            <div className="mt-2 border-t pt-2 flex items-center justify-between">
                              <div className="text-xs font-semibold text-zinc-900">Cash flow</div>
                              <div className={cn("text-xs font-bold", cashFlowColor)}>{fmtMoney(u.cashFlow)}/mo</div>
                            </div>
                            <div className="mt-1 text-[10px] text-zinc-500">
                              Payment includes P&I + tax + insurance + HOA. Cash flow also includes operating reserves.
                            </div>
                          </HoverCard>
                        </div>

                        <div className="mt-3 text-sm text-zinc-600 line-clamp-3">{listing.description}</div>

                        {/* Investor metrics */}
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                            <div className="text-xs text-zinc-600">Rent − Payment</div>
                            <div className={cn("mt-1 text-lg font-extrabold", deltaColor)}>{fmtMoney(rentMinusPayment)}/mo</div>
                            <div className="mt-1 text-[11px] text-zinc-500">Rent minus PITI + HOA</div>
                          </div>

                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                            <div className="text-xs text-zinc-600">Est cash flow</div>
                            <div className={cn("mt-1 text-lg font-extrabold", cashFlowColor)}>{fmtMoney(u.cashFlow)}/mo</div>
                            <div className="mt-1 text-[11px] text-zinc-500">Includes reserves</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-700">
                          <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2">
                            <div className="text-[11px] text-zinc-500">Est rent</div>
                            <div className="font-semibold">{fmtMoney(listing.rentEstimate)}</div>
                          </div>
                          <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2">
                            <div className="text-[11px] text-zinc-500">Est payment</div>
                            <div className="font-semibold">{fmtMoney(allInPayment)}</div>
                          </div>
                          <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2">
                            <div className="text-[11px] text-zinc-500">Type</div>
                            <div className="font-semibold">{listing.type}</div>
                          </div>
                        </div>

                        <div className="mt-3 text-[11px] text-zinc-500">
                          CoC {fmtPct(u.cocReturnPct)} · Cap {fmtPct(u.capRatePct)}
                        </div>
                      </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <ListingMap points={mapPoints} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} />
                {!selectedId && <div className="mt-2 text-xs text-zinc-600">Pins show all filtered listings. Click a pin to focus.</div>}
              </div>

              <div className="lg:col-span-5 space-y-3">
                {rows.map(({ listing, u }) => {
                  const isSelected = listing.id === selectedId
                  const isSaved = favorites.includes(listing.id)

                  return (
                    <div
                      key={listing.id}
                      className={cn(
                        "cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition",
                        isSelected ? "border-emerald-800 ring-2 ring-emerald-100" : "border-emerald-100 hover:border-emerald-200"
                      )}
                      onClick={() => setSelectedId(listing.id)}
                      onMouseEnter={() => setSelectedId(listing.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900 truncate">
                            {listing.address}, {listing.city}
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            {listing.type} · {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft
                          </div>
                        </div>

                        <div className={cn("text-sm font-extrabold", u.cashFlow >= 0 ? "text-emerald-700" : "text-rose-600")}>
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
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            isSaved ? "border-emerald-800 bg-emerald-800 text-white" : "border-zinc-200 bg-white text-zinc-900 hover:border-emerald-300"
                          )}
                        >
                          {isSaved ? "Saved" : "Save"}
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
            Demo data only. Replace LISTINGS with real MLS/API data and parcel-based tax + insurance sources.
          </div>
        </div>
      </div>
    </div>
  )
}

/** SliderRow */
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
