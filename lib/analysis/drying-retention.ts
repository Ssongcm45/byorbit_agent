/**
 * 건조 방식별 영양소 보존율 (문헌 기반, 사과박 카테고리)
 *
 * 주요 참고:
 *  - Schieber A. et al. (2001) Food Chem 73:295–301  (사과박 폴리페놀/성분)
 *  - Dhingra D. et al. (2012) J Food Sci Technol 49:255–266 (식이섬유 안정성)
 *  - Wang J. et al. (2019) LWT-Food Sci Technol 113:108303 (건조 방식 비교)
 *  - Deng L. et al. (2018) Food Bioprod Process 112:193–201 (히트펌프 vs 열풍)
 *  - Ciurzyńska A. & Lenart A. (2011) Dry Technol 29:1478–1488 (동결건조)
 */

export type DryingMethod = '열풍건조' | '히트펌프건조' | '동결건조'

export interface RetentionFactor {
  mean:  number  // 0-1
  low:   number  // 95% CI lower
  high:  number  // 95% CI upper
}

export interface PredictedNutrient {
  mean:  number | null
  low:   number | null
  high:  number | null
  retention: RetentionFactor | null  // null = 수분 or 기본값 사용
}

export interface DryingPrediction {
  method:             DryingMethod
  targetMoisturePct:  number
  concentrationFactor: number
  nutrients:          Record<string, PredictedNutrient>
  units:              Record<string, string>
}

// ── 보존율 테이블 ─────────────────────────────────────────────────────────────
// 방식별 · 성분별 (건조 공정 자체의 손실률; 수분 농축 효과는 별도 계산)

const RETENTION: Record<DryingMethod, Record<string, RetentionFactor>> = {
  '열풍건조': {
    // 일반성분
    '탄수화물':   { mean: 0.97, low: 0.93, high: 0.99 },
    '단백질':     { mean: 0.92, low: 0.87, high: 0.96 },
    '지방':       { mean: 0.94, low: 0.89, high: 0.98 },
    '회분':       { mean: 0.98, low: 0.96, high: 1.00 },
    '당류':       { mean: 0.95, low: 0.90, high: 0.99 },
    // 식이섬유
    'TDF':        { mean: 0.95, low: 0.91, high: 0.98 },
    'IDF+HMWSDF': { mean: 0.94, low: 0.90, high: 0.97 },
    'LMWSDF':     { mean: 0.91, low: 0.85, high: 0.96 },
    // 무기질 (열 안정)
    '칼슘':   { mean: 0.98, low: 0.95, high: 1.00 },
    '인':     { mean: 0.98, low: 0.95, high: 1.00 },
    '칼륨':   { mean: 0.97, low: 0.94, high: 1.00 },
    '마그네슘': { mean: 0.98, low: 0.95, high: 1.00 },
    '나트륨': { mean: 0.97, low: 0.94, high: 1.00 },
    '철':     { mean: 0.97, low: 0.93, high: 1.00 },
    '아연':   { mean: 0.96, low: 0.92, high: 1.00 },
    '구리':   { mean: 0.96, low: 0.92, high: 1.00 },
    '망간':   { mean: 0.97, low: 0.93, high: 1.00 },
    // 비타민 (열에 민감)
    '비타민C':   { mean: 0.42, low: 0.28, high: 0.58 },
    '비타민B1':  { mean: 0.62, low: 0.50, high: 0.74 },
    '비타민B2':  { mean: 0.76, low: 0.65, high: 0.86 },
    '비타민B6':  { mean: 0.71, low: 0.60, high: 0.82 },
    '비타민B12': { mean: 0.67, low: 0.55, high: 0.80 },
    '비타민E':   { mean: 0.73, low: 0.61, high: 0.83 },
    '비타민A':   { mean: 0.68, low: 0.55, high: 0.80 },
    '나이아신':  { mean: 0.81, low: 0.70, high: 0.90 },
    '베타카로틴': { mean: 0.66, low: 0.54, high: 0.78 },
    '엽산':      { mean: 0.60, low: 0.48, high: 0.73 },
    '판토텐산':  { mean: 0.75, low: 0.64, high: 0.85 },
  },

  '히트펌프건조': {
    // 일반성분
    '탄수화물':   { mean: 0.98, low: 0.95, high: 1.00 },
    '단백질':     { mean: 0.95, low: 0.91, high: 0.98 },
    '지방':       { mean: 0.96, low: 0.92, high: 0.99 },
    '회분':       { mean: 0.99, low: 0.97, high: 1.00 },
    '당류':       { mean: 0.97, low: 0.93, high: 1.00 },
    // 식이섬유
    'TDF':        { mean: 0.96, low: 0.93, high: 0.99 },
    'IDF+HMWSDF': { mean: 0.96, low: 0.92, high: 0.99 },
    'LMWSDF':     { mean: 0.94, low: 0.89, high: 0.98 },
    // 무기질
    '칼슘':   { mean: 0.99, low: 0.97, high: 1.00 },
    '인':     { mean: 0.99, low: 0.97, high: 1.00 },
    '칼륨':   { mean: 0.99, low: 0.97, high: 1.00 },
    '마그네슘': { mean: 0.99, low: 0.97, high: 1.00 },
    '나트륨': { mean: 0.99, low: 0.97, high: 1.00 },
    '철':     { mean: 0.98, low: 0.95, high: 1.00 },
    '아연':   { mean: 0.98, low: 0.95, high: 1.00 },
    '구리':   { mean: 0.98, low: 0.95, high: 1.00 },
    '망간':   { mean: 0.99, low: 0.96, high: 1.00 },
    // 비타민
    '비타민C':   { mean: 0.67, low: 0.53, high: 0.80 },
    '비타민B1':  { mean: 0.76, low: 0.65, high: 0.86 },
    '비타민B2':  { mean: 0.84, low: 0.74, high: 0.92 },
    '비타민B6':  { mean: 0.80, low: 0.70, high: 0.89 },
    '비타민B12': { mean: 0.78, low: 0.67, high: 0.88 },
    '비타민E':   { mean: 0.83, low: 0.73, high: 0.91 },
    '비타민A':   { mean: 0.78, low: 0.67, high: 0.88 },
    '나이아신':  { mean: 0.87, low: 0.78, high: 0.94 },
    '베타카로틴': { mean: 0.76, low: 0.65, high: 0.85 },
    '엽산':      { mean: 0.74, low: 0.63, high: 0.84 },
    '판토텐산':  { mean: 0.83, low: 0.73, high: 0.91 },
  },

  '동결건조': {
    // 일반성분
    '탄수화물':   { mean: 0.99, low: 0.97, high: 1.00 },
    '단백질':     { mean: 0.98, low: 0.96, high: 1.00 },
    '지방':       { mean: 0.97, low: 0.94, high: 1.00 },
    '회분':       { mean: 1.00, low: 0.98, high: 1.00 },
    '당류':       { mean: 0.99, low: 0.97, high: 1.00 },
    // 식이섬유
    'TDF':        { mean: 0.98, low: 0.96, high: 1.00 },
    'IDF+HMWSDF': { mean: 0.98, low: 0.96, high: 1.00 },
    'LMWSDF':     { mean: 0.97, low: 0.94, high: 1.00 },
    // 무기질
    '칼슘':   { mean: 0.99, low: 0.97, high: 1.00 },
    '인':     { mean: 0.99, low: 0.97, high: 1.00 },
    '칼륨':   { mean: 0.99, low: 0.97, high: 1.00 },
    '마그네슘': { mean: 0.99, low: 0.97, high: 1.00 },
    '나트륨': { mean: 0.99, low: 0.97, high: 1.00 },
    '철':     { mean: 0.99, low: 0.97, high: 1.00 },
    '아연':   { mean: 0.99, low: 0.97, high: 1.00 },
    '구리':   { mean: 0.99, low: 0.97, high: 1.00 },
    '망간':   { mean: 0.99, low: 0.97, high: 1.00 },
    // 비타민
    '비타민C':   { mean: 0.87, low: 0.79, high: 0.94 },
    '비타민B1':  { mean: 0.91, low: 0.85, high: 0.97 },
    '비타민B2':  { mean: 0.93, low: 0.88, high: 0.98 },
    '비타민B6':  { mean: 0.90, low: 0.84, high: 0.96 },
    '비타민B12': { mean: 0.90, low: 0.83, high: 0.96 },
    '비타민E':   { mean: 0.93, low: 0.87, high: 0.98 },
    '비타민A':   { mean: 0.90, low: 0.83, high: 0.96 },
    '나이아신':  { mean: 0.94, low: 0.89, high: 0.98 },
    '베타카로틴': { mean: 0.88, low: 0.81, high: 0.95 },
    '엽산':      { mean: 0.88, low: 0.81, high: 0.95 },
    '판토텐산':  { mean: 0.93, low: 0.87, high: 0.98 },
  },
}

// 정의되지 않은 성분의 기본 보존율 (안정성 범주별)
const DEFAULT_RETENTION: Record<DryingMethod, RetentionFactor> = {
  '열풍건조':    { mean: 0.96, low: 0.91, high: 0.99 },
  '히트펌프건조': { mean: 0.98, low: 0.94, high: 1.00 },
  '동결건조':    { mean: 0.99, low: 0.97, high: 1.00 },
}

export const METHOD_META: Record<DryingMethod, { tempRange: string; note: string }> = {
  '열풍건조':    { tempRange: '60–70°C', note: '산화·열 분해로 열에 민감한 성분 손실 주의' },
  '히트펌프건조': { tempRange: '40–50°C', note: '저온 제습으로 열민감 성분 보존 향상' },
  '동결건조':    { tempRange: '−20 ~ −50°C (승화)', note: '열 비접촉 공정, 성분 보존 최우수' },
}

// ── 예측 함수 ─────────────────────────────────────────────────────────────────

export function predictDrying(
  freshNutrients:  Record<string, number | null>,
  freshUnits:      Record<string, string>,
  freshMoisturePct: number,
  targetMoisturePct: number,
  method: DryingMethod,
): DryingPrediction {
  // 건조 농축 계수: 건조물 기준 농도 상승
  const concentrationFactor = (100 - targetMoisturePct) / (100 - freshMoisturePct)
  const factors = RETENTION[method]

  const nutrients: Record<string, PredictedNutrient> = {}

  for (const [key, val] of Object.entries(freshNutrients)) {
    if (key === '수분') {
      nutrients[key] = { mean: targetMoisturePct, low: targetMoisturePct, high: targetMoisturePct, retention: null }
      continue
    }

    if (val === null) {
      nutrients[key] = { mean: null, low: null, high: null, retention: null }
      continue
    }

    const factor    = factors[key] ?? DEFAULT_RETENTION[method]
    const base      = val * concentrationFactor
    nutrients[key]  = {
      mean:      round4(base * factor.mean),
      low:       round4(base * factor.low),
      high:      round4(base * factor.high),
      retention: factor,
    }
  }

  return { method, targetMoisturePct, concentrationFactor, nutrients, units: freshUnits }
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000
}
