"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [sortKey, setSortKey] = useState<SortKey>("cashFlow")
  const [viewMode, setViewMode] = useState<"list" | "map">("list")
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [favorites, setFavorites] = useState<number[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)

  useEffect(() => {
    setFavorites(getFavorites())
  }, [])

  const rows = useMemo(() => {
    const computed = LISTINGS.map((l) => {
      const s = { ...scenario, hoaMonthly: (l.hoaMonthly ?? 0) + scenario.hoaMonthly }
      const u = underwriting({ price: l.price, rentMonthly: l.rentEstimate, scenario: s })
      return { listing: l, u }
    })

    return computed
      .filter(({ listing }) => {
        const priceOk =
          (minPrice ? listing.price >= minPrice : true) &&
          (maxPrice ? listing.price <= maxPrice : true)

        const favOk = onlyFavorites ? favorites.includes(listing.id) : true

        return priceOk && favOk
      })
      .sort((a, b) => {
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
  }, [scenario, sortKey, minPrice, maxPrice, favorites, onlyFavorites])

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-8">

        <h1 className="text-3xl font-bold">King County Investment Finder</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Zillow-style browsing with investor underwriting.
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          {favorites.length} saved properties
        </p>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-4">

          <div className="flex overflow-hidden rounded-md border border-zinc-200 bg-white">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 text-sm ${viewMode === "list" ? "bg-zinc-900 text-white" : ""}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 text-sm ${viewMode === "map" ? "bg-zinc-900 text-white" : ""}`}
            >
              Map
            </button>
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
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
            Favorites only
          </label>

          <input
            placeholder="Min price"
            value={minPrice || ""}
            onChange={(e) => setMinPrice(Number(e.target.value))}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />

          <input
            placeholder="Max price"
            value={maxPrice || ""}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>

        {/* LIST MODE */}
        {viewMode === "list" && (
          <div className="mt-6 grid gap-4">
            {rows.map(({ listing, u }) => (
              <Link
                key={listing.id}
                href={`/listing/${listing.id}`}
                className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm hover:shadow-md transition"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative h-52 w-full sm:w-72">
                    <img src={listing.images[0]} className="h-full w-full object-cover" />
                    {favorites.includes(listing.id) && (
                      <div className="absolute right-3 top-3 bg-zinc-900 text-white px-3 py-1 text-xs rounded-full">
                        Saved
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-semibold">
                          {listing.address}, {listing.city}
                        </div>
                        <div className="text-sm text-zinc-600">
                          {listing.beds} bd · {listing.baths} ba · {listing.sqft} sqft
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const next = toggleFavorite(listing.id)
                          setFavorites(next)
                        }}
                        className="text-xs border px-3 py-1 rounded-full"
                      >
                        {favorites.includes(listing.id) ? "Saved" : "Save"}
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <Metric label="Price" value={fmtMoney(listing.price)} />
                      <Metric label="Rent" value={fmtMoney(listing.rentEstimate)} />
                      <Metric label="Mortgage" value={fmtMoney(u.mortgage)} />
                      <Metric
                        label="Cash flow"
                        value={fmtMoney(u.cashFlow)}
                        color={u.cashFlow >= 0 ? "text-emerald-600" : "text-rose-600"}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* MAP MODE */}
        {viewMode === "map" && (
          <div className="mt-6 grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 rounded-xl overflow-hidden border">
              <iframe
                className="h-[560px] w-full"
                loading="lazy"
                src={
                  selectedId
                    ? `https://www.google.com/maps?q=${LISTINGS.find(l => l.id === selectedId)?.lat},${LISTINGS.find(l => l.id === selectedId)?.lng}&z=15&output=embed`
                    : `https://www.google.com/maps?q=King%20County%20WA&z=10&output=embed`
                }
              />
            </div>

            <div className="lg:col-span-5 space-y-3">
              {rows.map(({ listing, u }) => (
                <div
                  key={listing.id}
                  onClick={() => setSelectedId(listing.id)}
                  className="cursor-pointer rounded-xl border bg-white p-4"
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="font-semibold text-sm">
                        {listing.address}
                      </div>
                      <div className="text-xs text-zinc-600">
                        {listing.beds} bd · {listing.baths} ba
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${u.cashFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {fmtMoney(u.cashFlow)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function Metric(props: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <div className="text-xs text-zinc-600">{props.label}</div>
      <div className={`font-semibold ${props.color ?? ""}`}>
        {props.value}
      </div>
    </div>
  )
}
