export type Scenario = {
  downPaymentPct: number // 0.25 = 25%
  interestRatePct: number // 6.75 = 6.75%
  termYears: number // 30
  propertyTaxRatePct: number // annual % of price
  insuranceMonthly: number
  hoaMonthly: number
  vacancyPct: number
  managementPct: number
  maintenancePct: number
}

export function mortgagePaymentMonthly(params: {
  price: number
  downPaymentPct: number
  interestRatePct: number
  termYears: number
}) {
  const { price, downPaymentPct, interestRatePct, termYears } = params
  const loanAmount = price * (1 - downPaymentPct)
  const monthlyRate = (interestRatePct / 100) / 12
  const n = termYears * 12

  if (monthlyRate === 0) return Math.round(loanAmount / n)

  const payment =
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1)

  return Math.round(payment)
}

export function underwriting(params: {
  price: number
  rentMonthly: number
  scenario: Scenario
}) {
  const { price, rentMonthly, scenario } = params

  const mortgage = mortgagePaymentMonthly({
    price,
    downPaymentPct: scenario.downPaymentPct,
    interestRatePct: scenario.interestRatePct,
    termYears: scenario.termYears,
  })

  const taxesMonthly = Math.round((price * (scenario.propertyTaxRatePct / 100)) / 12)
  const insuranceMonthly = Math.round(scenario.insuranceMonthly)
  const hoaMonthly = Math.round(scenario.hoaMonthly)

  const vacancy = Math.round(rentMonthly * scenario.vacancyPct)
  const management = Math.round(rentMonthly * scenario.managementPct)
  const maintenance = Math.round(rentMonthly * scenario.maintenancePct)

  const totalMonthlyCost =
    mortgage + taxesMonthly + insuranceMonthly + hoaMonthly + vacancy + management + maintenance

  const cashFlow = Math.round(rentMonthly - totalMonthlyCost)

  const annualCashFlow = cashFlow * 12

  const downPayment = price * scenario.downPaymentPct
  const closingCosts = price * 0.03
  const cashInvested = downPayment + closingCosts

  const cocReturnPct = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0

  const noiMonthly = Math.round(rentMonthly - vacancy - management - maintenance - taxesMonthly - insuranceMonthly - hoaMonthly)
  const capRatePct = price > 0 ? ((noiMonthly * 12) / price) * 100 : 0

  const rentToPayment = totalMonthlyCost > 0 ? rentMonthly / totalMonthlyCost : 0

  return {
    mortgage,
    taxesMonthly,
    insuranceMonthly,
    hoaMonthly,
    vacancy,
    management,
    maintenance,
    totalMonthlyCost,
    cashFlow,
    cocReturnPct,
    capRatePct,
    rentToPayment,
    downPayment,
    closingCosts,
    cashInvested,
  }
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

export function fmtPct(n: number) {
  return `${n.toFixed(2)}%`
}
