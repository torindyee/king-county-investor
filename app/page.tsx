"use client"

import Link from "next/link"

type Listing = {
  id: number
  address: string
  price: number
  beds: number
  baths: number
  sqft: number
  image: string
  rentEstimate: number
}

const listings: Listing[] = [
  {
    id: 1,
    address: "1234 Queen Anne Ave N, Seattle, WA",
    price: 850000,
    beds: 3,
    baths: 2,
    sqft: 1850,
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994",
    rentEstimate: 4200,
  },
  {
    id: 2,
    address: "5678 Ballard Ave NW, Seattle, WA",
    price: 725000,
    beds: 2,
    baths: 2,
    sqft: 1400,
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
    rentEstimate: 3600,
  },
]

function calculateMortgage(price: number) {
  const downPayment = 0.25
  const rate = 0.0675
  const loanAmount = price * (1 - downPayment)
  const monthlyRate = rate / 12
  const numPayments = 30 * 12

  const mortgage =
    (loanAmount *
      monthlyRate *
      Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)

  return Math.round(mortgage)
}

export default function Home() {
  return (
    <div className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">
        King County Investment Finder
      </h1>

      <div className="grid gap-6">
        {listings.map((listing) => {
          const mortgage = calculateMortgage(listing.price)
          const cashFlow = listing.rentEstimate - mortgage

          return (
            <Link
              href={`/listing/${listing.id}`}
              key={listing.id}
              className="flex border rounded-lg overflow-hidden shadow-sm"
            >
              <img
                src={listing.image}
                alt="home"
                className="w-60 h-40 object-cover"
              />

              <div className="p-4 flex-1">
                <h2 className="text-xl font-semibold">
                  {listing.address}
                </h2>

                <p>
                  {listing.beds} bd | {listing.baths} ba | {listing.sqft} sqft
                </p>

                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-500">Price</p>
                    <p className="font-bold">
                      ${listing.price.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Est Rent</p>
                    <p className="font-bold">
                      ${listing.rentEstimate.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Mortgage</p>
                    <p className="font-bold">
                      ${mortgage.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <p
                    className={`font-bold ${
                      cashFlow > 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    Cash Flow: ${cashFlow.toLocaleString()}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
