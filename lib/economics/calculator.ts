export interface EconomicsInput {
  monthly_volume_kg:      number  // 월 발생량
  current_disposal_cost:  number  // 현재 폐기비 (원/kg)
  drying_cost_per_kg:     number  // 건조비 추정 (원/kg)
  transport_cost_per_kg:  number  // 운송비 추정 (원/kg)
  expected_sell_price:    number  // 예상 판매가 (원/kg)
  moisture_reduction_pct: number  // 건조 시 감량률 (%) 0~100
}

export interface EconomicsResult {
  monthly_disposal_saving: number   // 월 폐기비 절감
  monthly_net_revenue:     number   // 월 순수익 예상
  breakeven_volume_kg:     number   // 손익분기 발생량
  annual_value:            number   // 연간 총 가치
  grade:                   'positive' | 'marginal' | 'negative'
  summary:                 string   // 한줄 요약
}

export function calculateEconomics(input: EconomicsInput): EconomicsResult {
  const {
    monthly_volume_kg,
    current_disposal_cost,
    drying_cost_per_kg,
    transport_cost_per_kg,
    expected_sell_price,
    moisture_reduction_pct,
  } = input

  // 건조 후 중량 = 원래 중량 × (1 - 감량률/100)
  const dried_volume_kg = monthly_volume_kg * (1 - moisture_reduction_pct / 100)

  // 폐기비 절감 = 폐기비 × 발생량
  const monthly_disposal_saving = current_disposal_cost * monthly_volume_kg

  // 수익 = 판매가 × 건조 중량
  const monthly_revenue = expected_sell_price * dried_volume_kg

  // 비용 = (건조비 + 운송비) × 건조 중량
  const monthly_cost = (drying_cost_per_kg + transport_cost_per_kg) * dried_volume_kg

  // 순수익 = 수익 + 폐기비 절감 - 비용
  const monthly_net_revenue = monthly_revenue + monthly_disposal_saving - monthly_cost

  // 손익분기량 (순수익 0이 되는 원료 발생량)
  // (sell_price × dried_ratio - drying_cost - transport) × breakeven = 0 + disposal × breakeven
  // -> 사실상 순수익이 0이 되는 발생량
  const dried_ratio = 1 - moisture_reduction_pct / 100
  const revenue_per_fresh_kg = expected_sell_price * dried_ratio + current_disposal_cost
  const cost_per_fresh_kg    = (drying_cost_per_kg + transport_cost_per_kg) * dried_ratio
  const profit_per_fresh_kg  = revenue_per_fresh_kg - cost_per_fresh_kg

  const breakeven_volume_kg =
    profit_per_fresh_kg > 0
      ? Math.ceil(-monthly_net_revenue / profit_per_fresh_kg + monthly_volume_kg)
      : Infinity

  const annual_value = monthly_net_revenue * 12

  const grade: EconomicsResult['grade'] =
    monthly_net_revenue > 100_000  ? 'positive' :
    monthly_net_revenue > -50_000  ? 'marginal'  : 'negative'

  const summary =
    grade === 'positive'
      ? `월 ${Math.round(monthly_net_revenue / 10000)}만원 순수익 예상 (연 ${Math.round(annual_value / 10000)}만원)`
      : grade === 'marginal'
      ? `손익분기 근접 — 건조 원가 절감 또는 판매가 협상 필요`
      : `현 조건에서 경제성 낮음 — 폐기비 절감 효과 위주로 검토`

  return {
    monthly_disposal_saving: Math.round(monthly_disposal_saving),
    monthly_net_revenue:     Math.round(monthly_net_revenue),
    breakeven_volume_kg:     isFinite(breakeven_volume_kg) ? Math.round(breakeven_volume_kg) : 0,
    annual_value:            Math.round(annual_value),
    grade,
    summary,
  }
}
