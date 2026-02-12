"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { LISTINGS } from "./lib/listings"
import { Scenario, fmtMoney, fmtPct, underwriting } from "./lib/finance"

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
        className="w-full"
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
        value={Number.isFinite(props.value) ? props.value : 0}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
      />
    </div>
  )
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [sortKey, setSortKey] = useState<SortKey>("cashFlow")

  const [minPrice, setMinPrice] = useState<number>(0)
  const [maxPrice, setMaxPrice] = useState<number>(0)
  const [minRent, setMinRent] = useState<number>(0)
  const [maxRent, setMaxRent] = useState<number>(0)
  const [minMortgage, setMinMortgage] = useState<number>(0)
  const [maxMortgage, setMaxMortgage] = useState<number>(0)
  const [minCashFlow, setMinCashFlow] = useState<number>(0)

  const rows = useMemo(() => {
    const computed = LISTINGS.map((l) => {
      const s: Scenario = { ...scenario, hoaMonthly: (l.hoaMonthly ?? 0) + scenario.hoaMonthly }
      const u = underwriting({ price: l.price, rentMonthly: l.rentEstimate, scenario: s })
      return { listing: l, u }
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

      return priceOk && rentOk && mortgageOk && cashFlowOk
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
  ])

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            King County Investment Finder
          </h1>
          <p className="text-sm text-zinc-600">
            Zillow-style browsing with investor underwriting built in. Adjust assumptions and sort by real outcomes.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: controls */}
          <div className="lg:col-span-4">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
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

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs text-zinc-600">Vacancy</div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {Math.round(scenario.vacancyPct * 100)}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs text-zinc-600">Mgmt</div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {Math.round(scenario.managementPct * 100)}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs text-zinc-600">Maint</div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {Math.round(scenario.maintenancePct * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">Filters</div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <NumberField label="Price min" value={minPrice} onChange={setMinPrice} placeholder="e.g. 600000" />
                  <NumberField label="Price max" value={maxPrice} onChange={setMaxPrice} placeholder="e.g. 900000" />
                  <NumberField label="Rent min" value={minRent} onChange={setMinRent} placeholder="e.g. 3000" />
                  <NumberField label="Rent max" value={maxRent} onChange={setMaxRent} placeholder="e.g. 5500" />
                  <NumberField
                    label="Mortgage min"
                    value={minMortgage}
                    onChange={setMinMortgage}
                    placeholder="e.g. 2500"
                  />
                  <NumberField
                    label="Mortgage max"
                    value={maxMortgage}
                    onChange={setMaxMortgage}
                    placeholder="e.g. 4500"
                  />
                  <div className="col-span-2">
                    <NumberField
                      label="Cash flow min"
                      value={minCashFlow}
                      onChange={setMinCashFlow}
                      placeholder="e.g. 200"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-zinc-600">{rows.length} results</div>
                  <button
                    onClick={() => {
                      setMinPrice(0); setMaxPrice(0); setMinRent(0); setMaxRent(0)
                      setMinMortgage(0); setMaxMortgage(0); setMinCashFlow(0)
                    }}
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: results */}
          <div className="lg:col-span-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900">Listings</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-zinc-600">Sort</div>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="cashFlow">Cash flow</option>
                  <option value="coc">Cash-on-cash</option>
                  <option value="cap">Cap rate</option>
                  <option value="rentToPayment">Rent to payment</option>
                  <option value="price">Price</option>
                  <option value="rent">Rent</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4">
              {rows.map(({ listing, u }) => {
                const cashFlowColor =
                  u.cashFlow >= 0 ? "text-emerald-600" : "text-rose-600"

                return (
                  <Link
                    key={listing.id}
                    href={`/listing/${listing.id}`}
                    className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row">
                      <div className="relative h-52 w-full sm:h-auto sm:w-72">
                        <img
                          src={listing.images[0]}
                          alt="Listing"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-900">
                          {listing.type}
                        </div>
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

                          <div className="text-right">
                            <div className="text-sm text-zinc-600">Price</div>
                            <div className="text-lg font-bold text-zinc-900">{fmtMoney(listing.price)}</div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                            <div className="text-xs text-zinc-600">Est rent</div>
                            <div className="text-sm font-semibold text-zinc-900">{fmtMoney(listing.rentEstimate)}</div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                            <div className="text-xs text-zinc-600">Mortgage</div>
                            <div className="text-sm font-semibold text-zinc-900">{fmtMoney(u.mortgage)}</div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                            <div className="text-xs text-zinc-600">Cash flow</div>
                            <div className={`text-sm font-semibold ${cashFlowColor}`}>{fmtMoney(u.cashFlow)}</div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                            <div className="text-xs text-zinc-600">CoC</div>
                            <div className="text-sm font-semibold text-zinc-900">{fmtPct(u.cocReturnPct)}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-600">
                          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                            Cap: {fmtPct(u.capRatePct)}
                          </span>
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

            <div className="mt-10 text-xs text-zinc-500">
              Demo data only. Later you’ll replace LISTINGS with NWMLS feed data.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
