/**
 * 착즙박 보정 계수 엔진 — Python correction_engine.py 포팅
 *
 * 계산 흐름:
 *   원과 RDA 데이터 + 보정 계수 → 건조박 성분 추정
 *   추정값 vs CoA 실측값 비교 → 보정 계수 캘리브레이션
 */

import type { RDAFoodItem } from './rda-client'
import type { CoAFormData } from '../coa/schema'
import correctionFactorsData from '../../config/correction-factors.json'

export interface ComponentRetention {
  mean: number
  min:  number
  max:  number
  note?: string
}

export interface CorrectionFactors {
  juice_yield_pct?:           number  // 착즙율 (사과박, 감귤박)
  extraction_yield_pct?:      number  // 추출 수율 (커피박)
  fresh_pomace_moisture_pct?: number  // 생박 수분율
  fresh_grounds_moisture_pct?: number
  fresh_residue_moisture_pct?: number
  dry_target_moisture_pct:    number  // 건조 목표 수분율
  component_retention: Record<string, ComponentRetention>
  // 사과박 특화
  apple_TDF_by_variety?: Record<string, { TDF_g_per_100g: number; note?: string }>
  apple_TPC_default_mgGAE_per_g?: number
}

export interface PomaceEstimate {
  byproduct_type:     string
  TDF_g_per_100g_dry:     number | null
  TDF_range_low:          number | null
  TDF_range_high:         number | null
  TPC_estimated_mgGAE:    number | null
  TPC_range_low:          number | null
  TPC_range_high:         number | null
  pectin_g_per_100g_dry:  number | null
  protein_g_per_100g_dry: number | null
  sugar_g_per_100g_dry:   number | null
  fat_g_per_100g_dry:     number | null
  // 중간 계산값
  drying_concentration_factor: number
  pomace_fraction:             number
  basis: 'dry_basis'
  computed_at: string
}

export interface ComparisonResult {
  [component: string]: {
    estimated:  number | null
    actual:     number | null
    delta_pct:  number | null
    status?:    'GOOD' | 'ACCEPTABLE' | 'UNDERESTIMATED' | 'OVERESTIMATED'
  }
}

export interface CalibrationRecord {
  apple_data: RDAFoodItem
  coa_data:   CoAFormData
}

// 보정 계수 로드 (config/correction-factors.json)
export function getCorrectionFactors(byproductType: string): CorrectionFactors {
  const data = correctionFactorsData as unknown as Record<string, CorrectionFactors>
  const factors = data[byproductType] ?? data['apple_pomace']
  if (!factors) throw new Error(`보정 계수 없음: ${byproductType}`)
  return factors
}

function getFreshMoisture(f: CorrectionFactors): number {
  return (
    f.fresh_pomace_moisture_pct ??
    f.fresh_grounds_moisture_pct ??
    f.fresh_residue_moisture_pct ??
    65.0
  )
}

function getDryingConcentrationFactor(f: CorrectionFactors): number {
  const freshDM = 1.0 - getFreshMoisture(f) / 100.0
  const dryDM   = 1.0 - f.dry_target_moisture_pct / 100.0
  return freshDM / dryDM
}

function getPomaceFraction(f: CorrectionFactors): number {
  const juiceYield = f.juice_yield_pct ?? 0
  return 1.0 - juiceYield / 100.0
}

function calcDryComponent(
  sourceVal: number | null,
  retention: ComponentRetention,
  pomaceFraction: number,
  dryingFactor: number,
): { mid: number | null; low: number | null; high: number | null } {
  if (sourceVal === null || sourceVal === undefined) return { mid: null, low: null, high: null }

  // pomaceFraction이 0이면 (커피박 같이 착즙 없는 경우) 직접 농축만 적용
  const divPomace = pomaceFraction > 0 ? pomaceFraction : 1.0

  const toMid  = sourceVal * retention.mean / divPomace / dryingFactor
  const toLow  = sourceVal * retention.min  / divPomace / dryingFactor
  const toHigh = sourceVal * retention.max  / divPomace / dryingFactor

  return {
    mid:  Math.round(toMid  * 100) / 100,
    low:  Math.round(toLow  * 100) / 100,
    high: Math.round(toHigh * 100) / 100,
  }
}

/** 원과 RDA 데이터 + 보정 계수 → 건조박 성분 추정 */
export function estimate(
  sourceData: RDAFoodItem,
  factors: CorrectionFactors,
  byproductType: string,
  options?: { variety?: string; appleTPC?: number; applePectin?: number },
): PomaceEstimate {
  const dryingFactor  = getDryingConcentrationFactor(factors)
  const pomaceFraction = getPomaceFraction(factors)
  const retention = factors.component_retention

  const est: PomaceEstimate = {
    byproduct_type:              byproductType,
    TDF_g_per_100g_dry:          null,
    TDF_range_low:               null,
    TDF_range_high:              null,
    TPC_estimated_mgGAE:         null,
    TPC_range_low:               null,
    TPC_range_high:              null,
    pectin_g_per_100g_dry:       null,
    protein_g_per_100g_dry:      null,
    sugar_g_per_100g_dry:        null,
    fat_g_per_100g_dry:          null,
    drying_concentration_factor: Math.round(dryingFactor * 1000) / 1000,
    pomace_fraction:             Math.round(pomaceFraction * 1000) / 1000,
    basis:                       'dry_basis',
    computed_at:                 new Date().toISOString(),
  }

  // TDF
  let tdfSource = sourceData.dietary_fiber_g
  // 사과박: 품종별 TDF 우선 사용
  if (byproductType === 'apple_pomace' && options?.variety && factors.apple_TDF_by_variety) {
    const varietyData = factors.apple_TDF_by_variety[options.variety]
      ?? factors.apple_TDF_by_variety['default']
    if (varietyData) tdfSource = varietyData.TDF_g_per_100g
  }

  if (tdfSource !== null && retention['TDF']) {
    const { mid, low, high } = calcDryComponent(tdfSource, retention['TDF'], pomaceFraction, dryingFactor)
    est.TDF_g_per_100g_dry = mid
    est.TDF_range_low      = low
    est.TDF_range_high     = high
  }

  // TPC — 농진청 DB에 없으므로 추정값 사용
  if (byproductType === 'apple_pomace' && retention['TPC']) {
    const appleTPC = options?.appleTPC ?? factors.apple_TPC_default_mgGAE_per_g ?? 1.0
    // mgGAE/g → g/100g 변환 (×0.1), 계산 후 역변환 (×10)
    const tpcG100g = appleTPC * 0.1
    const { mid, low, high } = calcDryComponent(tpcG100g, retention['TPC'], pomaceFraction, dryingFactor)
    est.TPC_estimated_mgGAE = mid !== null ? Math.round(mid * 10 * 100) / 100 : null
    est.TPC_range_low       = low  !== null ? Math.round(low  * 10 * 100) / 100 : null
    est.TPC_range_high      = high !== null ? Math.round(high * 10 * 100) / 100 : null
  }

  // 펙틴
  if (retention['pectin']) {
    const pectinSource = options?.applePectin ?? 0.75
    const { mid } = calcDryComponent(pectinSource, retention['pectin'], pomaceFraction, dryingFactor)
    est.pectin_g_per_100g_dry = mid
  }

  // 단백질
  if (sourceData.protein_g !== null && retention['protein']) {
    const { mid } = calcDryComponent(sourceData.protein_g, retention['protein'], pomaceFraction, dryingFactor)
    est.protein_g_per_100g_dry = mid
  }

  // 당류
  if (sourceData.sugar_g !== null && retention['sugar']) {
    const { mid } = calcDryComponent(sourceData.sugar_g, retention['sugar'], pomaceFraction, dryingFactor)
    est.sugar_g_per_100g_dry = mid
  }

  // 지방
  if (sourceData.fat_g !== null && retention['fat']) {
    const { mid } = calcDryComponent(sourceData.fat_g, retention['fat'], pomaceFraction, dryingFactor)
    est.fat_g_per_100g_dry = mid
  }

  return est
}

function deltaStatus(deltaPct: number): 'GOOD' | 'ACCEPTABLE' | 'UNDERESTIMATED' | 'OVERESTIMATED' {
  if (Math.abs(deltaPct) <= 10) return 'GOOD'
  if (Math.abs(deltaPct) <= 25) return 'ACCEPTABLE'
  if (deltaPct > 0)             return 'UNDERESTIMATED'
  return 'OVERESTIMATED'
}

/** 추정값 vs CoA 실측값 비교 */
export function compare(est: PomaceEstimate, coa: CoAFormData): ComparisonResult {
  const pairs: [string, number | null, number | undefined][] = [
    ['TDF',     est.TDF_g_per_100g_dry,     coa.TDF_g_per_100g],
    ['TPC',     est.TPC_estimated_mgGAE,    coa.TPC_mgGAE_per_g],
    ['pectin',  est.pectin_g_per_100g_dry,  coa.pectin_g_per_100g],
    ['protein', est.protein_g_per_100g_dry, coa.protein_g_per_100g],
    ['sugar',   est.sugar_g_per_100g_dry,   coa.sugar_g_per_100g],
  ]

  const result: ComparisonResult = {}
  for (const [name, estimated, actual] of pairs) {
    if (estimated === null || actual === undefined || actual === null) {
      result[name] = { estimated: estimated ?? null, actual: actual ?? null, delta_pct: null }
      continue
    }
    const delta = ((actual - estimated) / estimated) * 100
    result[name] = {
      estimated,
      actual,
      delta_pct: Math.round(delta * 10) / 10,
      status:    deltaStatus(delta),
    }
  }
  return result
}

/** 다수 CoA 배치로 보정 계수 역산 (Python calibrate_factors 포팅) */
export function calibrate(
  records: CalibrationRecord[],
  currentFactors: CorrectionFactors,
  byproductType: string,
): CorrectionFactors {
  const pomaceFraction = getPomaceFraction(currentFactors)
  const dryingFactor   = getDryingConcentrationFactor(currentFactors)

  const newTDFRetentions: number[] = []
  const newTPCRetentions: number[] = []

  for (const rec of records) {
    const appleData = rec.apple_data
    const coaData   = rec.coa_data

    if (appleData.dietary_fiber_g && coaData.TDF_g_per_100g) {
      const rTDF = (coaData.TDF_g_per_100g * pomaceFraction * dryingFactor) / appleData.dietary_fiber_g
      newTDFRetentions.push(Math.min(Math.max(rTDF, 0.5), 1.0))
    }
  }

  const updated = JSON.parse(JSON.stringify(currentFactors)) as CorrectionFactors

  if (newTDFRetentions.length > 0) {
    const meanTDF = newTDFRetentions.reduce((a, b) => a + b, 0) / newTDFRetentions.length
    if (updated.component_retention['TDF']) {
      updated.component_retention['TDF'].mean = Math.round(meanTDF * 1000) / 1000
    }
    console.log(`[보정] TDF 잔류율 → ${Math.round(meanTDF * 1000) / 1000} (n=${newTDFRetentions.length})`)
  }

  if (newTPCRetentions.length > 0) {
    const meanTPC = newTPCRetentions.reduce((a, b) => a + b, 0) / newTPCRetentions.length
    if (updated.component_retention['TPC']) {
      updated.component_retention['TPC'].mean = Math.round(meanTPC * 1000) / 1000
    }
    console.log(`[보정] TPC 잔류율 → ${Math.round(meanTPC * 1000) / 1000} (n=${newTPCRetentions.length})`)
  }

  return updated
}

/** 01_byorbit-pomace-pipeline_API 연동 — Python 파이프라인 호환 결과 포맷 */
export function toPythonCompatibleOutput(est: PomaceEstimate): Record<string, unknown> {
  return {
    TDF_g_per_100g_dry:     est.TDF_g_per_100g_dry,
    TDF_range:              [est.TDF_range_low, est.TDF_range_high],
    TPC_estimated_mgGAE:    est.TPC_estimated_mgGAE,
    TPC_range:              [est.TPC_range_low, est.TPC_range_high],
    pectin_g_per_100g_dry:  est.pectin_g_per_100g_dry,
    protein_g_per_100g_dry: est.protein_g_per_100g_dry,
    sugar_g_per_100g_dry:   est.sugar_g_per_100g_dry,
    fat_g_per_100g_dry:     est.fat_g_per_100g_dry,
    drying_concentration_factor: est.drying_concentration_factor,
    pomace_fraction:             est.pomace_fraction,
    basis:                       'dry_basis',
    source:                      'byorbit-coa-v2-correction-engine',
  }
}
