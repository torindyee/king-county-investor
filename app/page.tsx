"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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
  propertyTaxRatePct: 1.0,
  insuranceMonthly: 180,
  hoaMonthly: 0,
  vacancyPct: 0.06,
  managementPct: 0.08,
  maintenancePct: 0.07,
}

function NumberInput(props: {
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-700">{props.label}</div>
        {props.hint && <div className="text-[11px] text-zinc-500">{props.hint}</div>}
      </div>
      <div className="relative">
        <input
          type="number"
          value={Number.isFinite(props.value) ? props.value : ""}
          onChange={(e) => props.onChange(Number(e.target.value))}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [sortKey, setSortKey] = useState<SortKey>("cashFlow")
  const [viewMode, setViewMode] = useState<"list" | "map">("list")

  const [favorites, setFavorites] = useState<number[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  const [showAssumptions, setShowAssumptions] = useState(false)

  const [downPaymentMode, setDownPaymentMode] = useState<DownPaymentMode>("percent")
  const [downPaymentInput, setDownPaymentInput] = useState(25)

  const avgPrice = useMemo(
    () => LISTINGS.reduce((sum, l) => sum + l.price, 0) / LISTINGS.length,
    []
  )

  useEffect(() => {
    setFavorites(getFavorites())
  }, [])

  useEffect(() => {
    if (downPaymentMode === "percent") {
      setScenario({ ...scenario, downPaymentPct: downPaymentInput / 100 })
    } else {
      setScenario({ ...scenario, downPaymentPct: downPaymentInput / avgPrice })
    }
  }, [downPaymentInput, downPaymentMode])

  const rows = useMemo(() => {
    return LISTINGS.map((l) => {
      const s: Scenario = { ...scenario, hoaMonthly: (l.hoaMonthly ?? 0) }
      const u = underwriting({ price: l.price, rentMonthly: l.rentEstimate, scenario: s })
      return { listing: l, u }
    }).sort((a, b) => {
      const get = (x: typeof a) =>
        sortKey === "cashFlow"
          ? x.u.cashFlow
          : sortKey === "coc"
          ? x.u.cocReturnPct
          : sortKey === "cap"
          ? x.u.capRatePct
          : sortKey === "rentToPayment"
          ? x.u.rentToPayment
          : sortKey === "price"
          ? x.listing.price
          : x.listing.rentEstimate

      return get(b) - get(a)
    })
  }, [scenario, sortKey])

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* TOP FILTER BAR */}
      <div className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-6">
            <NumberInput
              label="Interest Rate"
              value={scenario.interestRatePct}
              onChange={(v) => setScenario({ ...scenario, interestRatePct: v })}
              suffix="%"
            />

            <div>
              <div className="mb-1 flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-700">Down Payment</div>
                <button
                  onClick={() =>
                    setDownPaymentMode(downPaymentMode === "percent" ? "amount" : "percent")
                  }
                  className="text-[11px] text-emerald-700 underline"
                >
                  {downPaymentMode === "percent" ? "Use $" : "Use %"}
                </button>
              </div>

              <NumberInput
                label=""
                value={downPaymentInput}
                onChange={setDownPaymentInput}
                suffix={downPaymentMode === "percent" ? "%" : "$"}
                hint={
                  downPaymentMode === "percent"
                    ? `≈ ${fmtMoney(avgPrice * (downPaymentInput / 100))}`
                    : `≈ ${((downPaymentInput / avgPrice) * 100).toFixed(1)}%`
                }
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowAssumptions((v) => !v)}
                className="w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm hover:bg-zinc-200"
              >
                Assumptions
              </button>
            </div>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="cashFlow">Cash flow</option>
              <option value="coc">Cash-on-cash</option>
              <option value="cap">Cap rate</option>
              <option value="rentToPayment">Rent ÷ Payment</option>
              <option value="price">Price</option>
              <option value="rent">Rent</option>
            </select>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyFavorites}
                onChange={(e) => setOnlyFavorites(e.target.checked)}
              />
              Favorites
            </label>
          </div>

          {showAssumptions && (
            <div className="mt-4 rounded-xl border bg-white p-4 text-sm">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <NumberInput
                  label="Vacancy"
                  value={scenario.vacancyPct * 100}
                  onChange={(v) => setScenario({ ...scenario, vacancyPct: v / 100 })}
                  suffix="%"
                />
                <NumberInput
                  label="Management"
                  value={scenario.managementPct * 100}
                  onChange={(v) => setScenario({ ...scenario, managementPct: v / 100 })}
                  suffix="%"
                />
                <NumberInput
                  label="Maintenance"
                  value={scenario.maintenancePct * 100}
                  onChange={(v) => setScenario({ ...scenario, maintenancePct: v / 100 })}
                  suffix="%"
                />
                <NumberInput
                  label="Insurance"
                  value={scenario.insuranceMonthly}
                  onChange={(v) => setScenario({ ...scenario, insuranceMonthly: v })}
                  suffix="$"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {viewMode === "list" ? (
          <div className="grid gap-4">
            {rows.map(({ listing, u }) => (
              <Link
                key={listing.id}
                href={`/listing/${listing.id}`}
                className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="text-lg font-semibold">
                      {listing.address}, {listing.city}
                    </div>
                    <div className="text-sm text-zinc-600">
                      {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft
                    </div>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      u.cashFlow >= 0 ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {fmtMoney(u.cashFlow)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <ListingMap points={[]} selectedId={null} onSelect={() => {}} />
        )}
      </div>
    </div>
  )
}
