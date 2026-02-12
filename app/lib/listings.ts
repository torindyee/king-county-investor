export type Listing = {
  id: number
  address: string
  city: string
  state: string
  zip: string
  price: number
  beds: number
  baths: number
  sqft: number
  lat: number
  lng: number
  type: "Single Family" | "Condo" | "Townhome" | "Multi Family"
  yearBuilt?: number
  lotSqft?: number
  hoaMonthly?: number
  propertyTaxRatePct?: number // if you want to override scenario default
  images: string[]
  rentEstimate: number
  description: string
  highlights: string[]
}

export const LISTINGS: Listing[] = [
  {
    id: 1,
    address: "1234 Queen Anne Ave N",
    city: "Seattle",
    state: "WA",
    zip: "98109",
    price: 850000,
    beds: 3,
    baths: 2,
    sqft: 1850,
    lat: 47.6340,
    lng: -122.3565,
    type: "Single Family",
    yearBuilt: 1998,
    lotSqft: 3200,
    hoaMonthly: 0,
    images: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994",
      "https://images.unsplash.com/photo-1501183638710-841dd1904471",
      "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858",
    ],
    rentEstimate: 4200,
    description:
      "Bright, updated home with great natural light and an easy layout. Close to dining, parks, and commuter routes. A solid option for a long-term rental with strong tenant demand.",
    highlights: [
      "Open living and dining",
      "Updated kitchen and baths",
      "Walkable neighborhood",
      "Strong rental demand area",
    ],
  },
  {
    id: 2,
    address: "5678 Ballard Ave NW",
    city: "Seattle",
    state: "WA",
    zip: "98107",
    price: 725000,
    beds: 2,
    baths: 2,
    sqft: 1400,
    lat: 47.6687,
    lng: -122.3860,
    type: "Townhome",
    yearBuilt: 2012,
    hoaMonthly: 185,
    images: [
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
      "https://images.unsplash.com/photo-1565182999561-18d7dc61c393",
    ],
    rentEstimate: 3600,
    description:
      "Modern townhome with functional floorplan and low maintenance. Easy access to shops, food, and transit. Good candidate for stable rent with predictable expenses.",
    highlights: [
      "Low maintenance exterior",
      "Near shops and restaurants",
      "Good layout for roommates",
      "HOA covers common areas",
    ],
  },
  {
    id: 3,
    address: "9012 Kirkland Ave",
    city: "Kirkland",
    state: "WA",
    zip: "98033",
    price: 995000,
    beds: 4,
    baths: 3,
    sqft: 2300,
    lat: 47.6769,
    lng: -122.2050,
    type: "Single Family",
    yearBuilt: 1987,
    lotSqft: 5400,
    hoaMonthly: 0,
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7",
      "https://images.unsplash.com/photo-1554995207-c18c203602cb",
      "https://images.unsplash.com/photo-1549497538-303791108f95",
    ],
    rentEstimate: 5200,
    description:
      "Spacious home in a high-demand area with strong school proximity. Great for families seeking long-term rentals. Higher price point, but also stronger rent ceiling.",
    highlights: [
      "Large living space",
      "Family-friendly neighborhood",
      "Strong long-term demand",
      "Potential for value-add updates",
    ],
  },
]
