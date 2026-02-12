"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { LISTINGS } from "@/app/lib/listings"
import { Scenario, fmtMoney, fmtPct, underwriting } from "@/app/lib/finance"

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

export default function ListingDetailPage({ params }: { params: { id?: string } }) {
  const rawId = params?.id ?? ""
  const listingId = Number(rawId)
  const listing = LISTINGS.find((l) => l.id === listingId)

  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [activeImage, setActiveImage] = useState<number>(0)

  const results = useMemo(() => {
    if (!listing) return null
    const s: Scenario = { ...scenario, hoaMonthly: (listing.hoaMonthly ?? 0) + scenario.hoaMonthly }
    return underwriting({ price: listing.price, rentMonthly: listing.rentEstimate, scenario: s })
  }, [listing, scenario])

  if (!listing || !results) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold text-zinc-900">Listing not found</div>
            <div className="mt-2 text-sm text-zinc-600">
              This usually means the listing id in the URL doesn’t match any seeded listings.
            </div>
            <div className="mt-4 text-sm text-zinc-700">
              Requested id: <span className="font-semibold">{rawId || "(missing)"}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-700">
              Available ids:{" "}
              <span className="font-semibold">
                {LISTINGS.map((l) => l.id).join(", ")}
              </span>
            </div>
            <Link href="/" className="mt-6 inline-block text-sm font-medium text-zinc-900 underline">
              Back to results
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const cashFlowColor = results.cashFlow >= 0 ? "text-emerald-600" : "text-rose-600"

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
            ← Back to results
          </Link>
          <div className="text-xs text-zinc-500">Demo detail page</div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-zinc-900">
                    {listing.address}, {listing.city}, {listing.state} {listing.zip}
                  </h1>
                  <div className="mt-1 text-sm text-zinc-600">
                    {listing.type} · {listing.beds} bd · {listing.baths} ba ·{" "}
                    {listing.sqft.toLocaleString()} sqft
                    {listing.yearBuilt ? ` · Built ${listing.yearBuilt}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-600">List price</div>
                  <div className="text-2xl font-bold text-zinc-900">{fmtMoney(listing.price)}</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4">
                <div className="overflow-hidden rounded-xl border border-zinc-200">
                  <img src={listing.images[activeImage]} alt="Main" className="h-[360px] w-full object-cover" />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1">
                  {listing.images.map((src, idx) => {
                    const isActive = idx === activeImage
                    return (
                      <button
                        key={src}
                        onClick={() => setActiveImage(idx)}
                        className={`overflow-hidden rounded-lg border ${isActive ? "border-zinc-900" : "border-zinc-200"}`}
                      >
                        <img src={src} alt="Thumb" className="h-20 w-28 object-cover" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold text-zinc-900">Overview</div>
                <p className="mt-2 text-sm leading-6 text-zinc-700">{listing.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.highlights.map((h) => (
                    <span key={h} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">Key facts</div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Fact label="Beds" value={`${listing.beds}`} />
                <Fact label="Baths" value={`${listing.baths}`} />
                <Fact label="Sqft" value={`${listing.sqft.toLocaleString()}`} />
                <Fact label="HOA" value={fmtMoney(listing.hoaMonthly ?? 0)} />
                <Fact label="Est rent" value={fmtMoney(listing.rentEstimate)} />
                <Fact label="Mortgage" value={fmtMoney(results.mortgage)} />
                <Fact label="Cash flow" value={fmtMoney(results.cashFlow)} valueClass={cashFlowColor} />
                <Fact label="CoC return" value={fmtPct(results.cocReturnPct)} />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900">Underwriting</div>
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

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-xs font-medium text-zinc-600">Monthly cash flow</div>
                    <div className={`mt-1 text-2xl font-bold ${cashFlowColor}`}>{fmtMoney(results.cashFlow)}</div>
                    <div className="mt-2 text-xs text-zinc-600">
                      Total cost: <span className="font-semibold text-zinc-900">{fmtMoney(results.totalMonthlyCost)}</span>
                      {" · "}
                      CoC: <span className="font-semibold text-zinc-900">{fmtPct(results.cocReturnPct)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500">
                    Demo assumptions only. Later you’ll load NWMLS data and store scenarios per user.
                  </div>
                </div>
              </div>

              {/* Map on detail page */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">Map</div>
                <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
             <iframe
                title="map"
                className="h-[260px] w-full"
                loading="lazy"
                src={`https://www.google.com/maps?q=${listing.lat},${listing.lng}&z=14&output=embed`}
            />

