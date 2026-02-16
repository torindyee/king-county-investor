"use client"

import Link from "next/link"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { LISTINGS } from "./lib/listings"
import ListingMap from "./ListingMap"
import { Scenario, fmtMoney, fmtPct, underwriting } from "./lib/finance"
import { getFavorites, toggleFavorite } from "./lib/favorites"

type SortKey = "cashFlow" | "coc" | "cap" | "rentToPayment" | "price" | "rent"
type DownPaymentMode = "percent" | "amount"

const DEFAULT_SCENARIO: Scenario = {
  downPaymentPct: 0.25,
  interestRatePct: 6.75,
  termYears: 30,
  // NOTE: we keep these fields to satisfy the Scenario type,
  // but we do NOT use them as user-entered assumptions anymore.
  // We override them per listing with estimateTaxRatePct + estimateInsuranceMonthly.
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

function PanelShell(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
        {props.right}
      </div>
      <div className="p-4">{props.children}</div>
    </div>
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

function CollapsibleSection(props: {
  title: string
  right?: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={props.onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50"
      >
        <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
        <div className="flex items-center gap-3">
          {props.right}
          <Chevron open={props.open} />
        </div>
      </button>

      {props.open && <div className="border-t border-zinc-100 p-4">{props.children}</div>}
    </div>
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
          value={
            Number.isFinite(props.value) && props.value !== 0
              ? props.value
              : props.value === 0
                ? 0
                : ""
          }
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
 * "Two-handle" range slider without extra libraries:
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
        {/* Track */}
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 cursor-pointer rounded-full bg-zinc-200"
        />

        {/* Fill */}
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-700"
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(0, rightPct - leftPct)}%`,
          }}
        />

        {/* Min thumb */}
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

        {/* Max thumb */}
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

/**
 * IMPORTANT: This is not “real tax” like Zillow (they use parcel/county sources).
 * For demo, we produce stable, believable estimates based on location + type.
 */
function estimateTaxRatePct(listing: (typeof LISTINGS)[number]) {
  // baseline effective rate (demo)
  let rate = 1.02

  // small location nudges (demo only, not a factual claim)
  const city = listing.city.toLowerCase()
  if (city.includes("seattle")) rate -= 0.05
  if (city.includes("bellevue")) rate += 0.06
  if (city.includes("kirkland")) rate += 0.03
  if (city.includes("sammamish")) rate += 0.02
  if (city.includes("renton")) rate += 0.01

  // condos often have slightly different effective rates (demo)
  if (listing.type === "Condo") rate -= 0.03

  return clamp(rate, 0.85, 1.35)
}

function estimateInsuranceMonthly(listing: (typeof LISTINGS)[number]) {
  // annual insurance percent of price (demo)
  let annualPct = 0.0032 // 0.32% baseline

  if (listing.type === "Condo") annualPct = 0.0020
  if (listing.type === "Townhome") annualPct = 0.0026
  if (listing.type === "Multi Family") annualPct = 0.0038

  // price scaling: cheaper homes tend to have higher % insurance, expensive lower %
  const price = listing.price
  if (price < 600000) annualPct += 0.0004
  if (price > 1200000) annualPct -= 0.0004

  const annual = price * annualPct
  return Math.round(annual / 12 / 10) * 10 // round to nearest $10
}

/** ---------- Metric card w/ hover tooltip ---------- */

function MetricCard(props: {
  label: string
  value: string
  valueClass?: string
  hoverTitle?: string
  hoverBody?: React.ReactNode
}) {
  const hasHover = Boolean(props.hoverBody)

  return (
    <div className="relative overflow-visible">
      <div className={cn("rounded-lg border border-zinc-200 bg-white p-3", hasHover && "group/metric cursor-help")}>
        <div className="text-xs text-zinc-600">{props.label}</div>
        <div className={cn("mt-1 text-sm font-semibold", props.valueClass ?? "text-zinc-900")}>{props.value}</div>

        {hasHover && (
          <div className="pointer-events-none absolute right-0 top-full z-[100] mt-2 hidden w-[340px] rounded-xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-700 shadow-xl group-hover/metric:block">
            <div className="text-xs font-semibold text-zinc-900">{props.hoverTitle ?? props.label}</div>
            <div className="mt-2">{props.hoverBody}</div>
          </div>
        )}
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

  // dropdown caret panels
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)

  // Down payment input
  const [dpMode, setDpMode] = useState<DownPaymentMode>("percent")
  const [dpInput, setDpInput] = useState(Math.round(DEFAULT_SCENARIO.downPaymentPct * 100))

  // Reference price for $ <-> % conversion display
  const basePriceForDownPayment = useMemo(() => {
    const prices = LISTINGS.map((l) => l.price).slice().sort((a, b) => a - b)
    const mid = Math.floor(prices.length / 2)
    return prices.length % 2 === 0 ? Math.round((prices[mid - 1] + prices[mid]) / 2) : prices[mid]
  }, [])

  // Range stats (from data + current assumptions for mortgage)
  const stats = useMemo(() => {
    const prices = LISTINGS.map((l) => l.price)
    const rents = LISTINGS.map((l) => l.rentEstimate)
    const hoas = LISTINGS.map((l) => l.hoaMonthly ?? 0)

    // mortgage depends on rate + DP, and now on per-listing tax/insurance estimates
    const mortgages = LISTINGS.map((l) => {
      const s: Scenario = {
        ...scenario,
        hoaMonthly: (l.hoaMonthly ?? 0) + scenario.hoaMonthly,
        propertyTaxRatePct: estimateTaxRatePct(l),
        insuranceMonthly: estimateInsuranceMonthly(l),
      }
      const u = underwriting({ price: l.price, rentMonthly: l.rentEstimate, scenario: s })
      return u.mortgage
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
      mortgageMin: min(mortgages),
      mortgageMax: max(mortgages),
    }
  }, [scenario])

  // Range state (initialize once stats exist)
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(0)
  const [rentMin, setRentMin] = useState(0)
  const [rentMax, setRentMax] = useState(0)
  const [hoaMin, setHoaMin] = useState(0)
  const [hoaMax, setHoaMax] = useState(0)
  const [mortgageMin, setMortgageMin] = useState(0)
  const [mortgageMax, setMortgageMax] = useState(0)

  const [minCashFlow, setMinCashFlow] = useState(0)

  // When stats change (notably mortgage ranges), ensure our current values remain valid
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

    if (mortgageMin === 0 && mortgageMax === 0) {
      setMortgageMin(stats.mortgageMin)
      setMortgageMax(stats.mortgageMax)
    } else {
      setMortgageMin((v) => clamp(v, stats.mortgageMin, stats.mortgageMax))
      setMortgageMax((v) => clamp(v, stats.mortgageMin, stats.mortgageMax))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats])

  useEffect(() => {
    setFavorites(getFavorites())
  }, [])

  // Keep dpInput and scenario.downPaymentPct in sync
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

  // If scenario changes (reset), reflect into dpInput
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

      const quickRentMinusMortgage = l.rentEstimate - u.mortgage
      const otherCosts = u.taxesMonthly + u.insuranceMonthly + u.hoaMonthly + u.vacancy + u.management + u.maintenance

      return { listing: l, u, quickRentMinusMortgage, otherCosts, estTaxRatePct, estInsuranceMonthly }
    })

    const filtered = computed.filter(({ listing, u }) => {
      const priceOk = listing.price >= priceMin && listing.price <= priceMax
      const rentOk = listing.rentEstimate >= rentMin && listing.rentEstimate <= rentMax

      const hoa = listing.hoaMonthly ?? 0
      const hoaOk = hoa >= hoaMin && hoa <= hoaMax

      const mortgageOk = u.mortgage >= mortgageMin && u.mortgage <= mortgageMax
      const cashFlowOk = minCashFlow ? u.cashFlow >= minCashFlow : true
      const favOk = onlyFavorites ? favorites.includes(listing.id) : true

      return priceOk && rentOk && hoaOk && mortgageOk && cashFlowOk && favOk
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
    mortgageMin,
    mortgageMax,
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

    if (mortgageMin !== stats.mortgageMin || mortgageMax !== stats.mortgageMax) {
      chips.push({
        label: `Mortgage ${fmtMoney(mortgageMin)}—${fmtMoney(mortgageMax)}`,
        clear: () => {
          setMortgageMin(stats.mortgageMin)
          setMortgageMax(stats.mortgageMax)
        },
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
    mortgageMin,
    mortgageMax,
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
    setMortgageMin(stats.mortgageMin)
    setMortgageMax(stats.mortgageMax)
    setMinCashFlow(0)
    setOnlyFavorites(false)
  }

  return (
    // Background: neutral + emerald accents (more premium than a green wash)
    <div className="min-h-screen bg-gradient-to-b from-white via-zinc-50 to-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">King County Investment Finder</h1>
              <p className="mt-1 text-sm text-zinc-700">
                Scan deals fast. Sort by performance. Adjust assumptions to match your strategy.
              </p>
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

        {/* Sticky controls */}
        <div className="sticky top-4 z-30 mt-6 space-y-4">
          {/* Results + chips */}
          <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
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

         {/* Filters + Assumptions (single header that opens content underneath) */}
<div className="grid gap-4 lg:grid-cols-12">
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
          <div className="flex items-center justify-end pb-3">
            <button
              onClick={() => {
                setPriceMin(stats.priceMin)
                setPriceMax(stats.priceMax)
                setRentMin(stats.rentMin)
                setRentMax(stats.rentMax)
                setHoaMin(stats.hoaMin)
                setHoaMax(stats.hoaMax)
                setMortgageMin(stats.mortgageMin)
                setMortgageMax(stats.mortgageMax)
                setMinCashFlow(0)
                setOnlyFavorites(false)
              }}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
              type="button"
            >
              Reset ranges
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              label="Mortgage"
              min={stats.mortgageMin}
              max={stats.mortgageMax}
              step={25}
              valueMin={mortgageMin}
              valueMax={mortgageMax}
              onChange={(a, b) => {
                setMortgageMin(a)
                setMortgageMax(b)
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
                    : `≈ ${((dpInput / basePriceForDownPayment) * 100).toFixed(
                        1
                      )}% on ${fmtMoney(basePriceForDownPayment)}`
                }
              />

              <div className="text-[11px] text-zinc-500">
                Tax + insurance are estimated per listing (demo heuristic), like a Zillow-style estimate.
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


        {/* Main content */}
        <div className="mt-6">
          {viewMode === "list" ? (
            <div className="grid gap-4">
              {rows.map(({ listing, u, quickRentMinusMortgage, otherCosts, estInsuranceMonthly, estTaxRatePct }) => {
                const isSaved = favorites.includes(listing.id)
                const cashFlowColor = u.cashFlow >= 0 ? "text-emerald-700" : "text-rose-600"
                const quickColor = quickRentMinusMortgage >= 0 ? "text-emerald-700" : "text-rose-600"

                return (
                  <Link
                    key={listing.id}
                    href={`/listing/${String(listing.id)}`}
                    className="group rounded-xl border border-emerald-100 bg-white shadow-sm transition hover:shadow-md overflow-visible"
                  >
                    <div className="flex flex-col sm:flex-row">
                      <div className="relative h-48 w-full overflow-hidden rounded-t-xl sm:h-auto sm:w-64 sm:rounded-l-xl sm:rounded-tr-none">
                        <img src={listing.images[0]} alt="Listing" className="h-full w-full object-cover" />
                        {isSaved && (
                          <div className="absolute left-3 top-3 rounded-full bg-emerald-800 px-3 py-1 text-xs font-semibold text-white">
                            Saved
                          </div>
                        )}
                      </div>

                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-lg font-semibold text-zinc-900 group-hover:underline truncate">
                              {listing.address}, {listing.city}
                            </div>
                            <div className="mt-1 text-sm text-zinc-600">
                              {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft · {listing.type}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const next = toggleFavorite(listing.id)
                              setFavorites(next)
                            }}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              isSaved
                                ? "border-emerald-800 bg-emerald-800 text-white"
                                : "border-zinc-200 bg-white text-zinc-900 hover:border-emerald-300"
                            )}
                          >
                            {isSaved ? "Saved" : "Save"}
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                          <div>
                            <div className="text-xs text-zinc-600">Price</div>
                            <div className="text-2xl font-bold text-zinc-900">{fmtMoney(listing.price)}</div>
                          </div>

                          <div>
                            <div className="text-xs text-zinc-600">Est rent</div>
                            <div className="text-lg font-semibold text-zinc-900">{fmtMoney(listing.rentEstimate)}</div>
                          </div>

                          <div className="sm:text-right">
                            <div className="text-xs text-zinc-600">All-in cash flow</div>
                            <div className={cn("text-2xl font-extrabold tracking-tight", cashFlowColor)}>
                              {fmtMoney(u.cashFlow)}/mo
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              CoC {fmtPct(u.cocReturnPct)} · Cap {fmtPct(u.capRatePct)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <MetricCard label="Mortgage" value={fmtMoney(u.mortgage)} />
                          <MetricCard label="Rent − Mortgage" value={fmtMoney(quickRentMinusMortgage)} valueClass={quickColor} />
                          <MetricCard
                            label="Rent coverage"
                            value={`${u.rentToPayment.toFixed(2)}x`}
                            valueClass={u.rentToPayment >= 1 ? "text-emerald-700" : "text-rose-600"}
                          />
                          <MetricCard
                            label="All-in cash flow"
                            value={fmtMoney(u.cashFlow)}
                            valueClass={cashFlowColor}
                            hoverTitle="All in cash flow"
                            hoverBody={
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                  <div>Rent</div>
                                  <div className="text-right font-semibold">{fmtMoney(listing.rentEstimate)}</div>

                                  <div>Mortgage</div>
                                  <div className="text-right font-semibold">{fmtMoney(u.mortgage)}</div>

                                  <div>Taxes (est)</div>
                                  <div className="text-right font-semibold">
                                    {fmtMoney(u.taxesMonthly)}
                                    <span className="ml-1 text-[10px] text-zinc-500">({estTaxRatePct.toFixed(2)}%)</span>
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

                                <div className="border-t pt-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-zinc-900">Cash flow</div>
                                    <div className={cn("text-xs font-bold", cashFlowColor)}>{fmtMoney(u.cashFlow)}</div>
                                  </div>
                                  <div className="mt-1 text-[10px] text-zinc-500">
                                    Estimates shown for demo. Replace with real tax/insurance data when you add NWMLS + parcel sources.
                                  </div>
                                </div>
                              </div>
                            }
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700">
                            HOA: {fmtMoney(listing.hoaMonthly ?? 0)}/mo
                          </span>

                          <div className="relative group/other overflow-visible">
                            <span className="cursor-default rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-zinc-700">
                              Operating costs: {fmtMoney(otherCosts)}
                            </span>

                            <div className="pointer-events-auto absolute left-0 top-full z-[100] mt-2 hidden w-[320px] rounded-xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-700 shadow-xl group-hover/other:block">
                              <div className="text-xs font-semibold text-zinc-900">Operating costs breakdown</div>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <div>Taxes (est): <span className="font-semibold">{fmtMoney(u.taxesMonthly)}</span></div>
                                <div>Insurance (est): <span className="font-semibold">{fmtMoney(u.insuranceMonthly)}</span></div>
                                <div>HOA: <span className="font-semibold">{fmtMoney(u.hoaMonthly)}</span></div>
                                <div>Vacancy: <span className="font-semibold">{fmtMoney(u.vacancy)}</span></div>
                                <div>Management: <span className="font-semibold">{fmtMoney(u.management)}</span></div>
                                <div>Maintenance: <span className="font-semibold">{fmtMoney(u.maintenance)}</span></div>
                              </div>
                              <div className="mt-2 border-t pt-2">
                                Total: <span className="font-semibold">{fmtMoney(otherCosts)}</span>
                              </div>
                            </div>
                          </div>

                          {listing.yearBuilt && (
                            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700">
                              Built: {listing.yearBuilt}
                            </span>
                          )}
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
                <ListingMap points={mapPoints} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} />
                {!selectedId && (
                  <div className="mt-2 text-xs text-zinc-600">
                    Pins show all filtered listings. Click a pin or hover a listing to focus.
                  </div>
                )}
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
                            {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft
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
            Demo data only. Later you’ll replace LISTINGS with NWMLS feed data and real parcel-based tax + insurance sources.
          </div>
        </div>
      </div>
    </div>
  )
}

/** SliderRow (kept for reserves) */
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
