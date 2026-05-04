export type NutrientCategory = 'energy' | 'macro' | 'mineral' | 'vitamin' | 'lipid' | 'other'
export type DensityCluster = 'high' | 'moderate' | 'low' | 'trace'
export type FunctionalType = '식이섬유 공급원' | '미네랄 공급원' | '비타민 공급원' | '균형 영양소'

// ── 카테고리 매핑 ─────────────────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, NutrientCategory> = {
  '에너지': 'energy', 'Energy': 'energy',
  '수분': 'macro', '단백질': 'macro', '지방': 'macro', '탄수화물': 'macro',
  '당류': 'macro', '총 식이섬유': 'macro', '식이섬유': 'macro',
  '칼슘': 'mineral', '철': 'mineral', '인': 'mineral', '칼륨': 'mineral',
  '나트륨': 'mineral', '아연': 'mineral', '마그네슘': 'mineral',
  '셀레늄': 'mineral', '구리': 'mineral', '망간': 'mineral', '요오드': 'mineral',
  '비타민 A': 'vitamin', '베타카로틴': 'vitamin', '티아민': 'vitamin',
  '비타민 B1': 'vitamin', '리보플라빈': 'vitamin', '비타민 B2': 'vitamin',
  '나이아신': 'vitamin', '비타민 B6': 'vitamin', '비타민 B12': 'vitamin',
  '엽산': 'vitamin', '비타민 C': 'vitamin', '비타민 D': 'vitamin',
  '비타민 E': 'vitamin', '비타민 K': 'vitamin', '판토텐산': 'vitamin', '비오틴': 'vitamin',
  '포화지방산': 'lipid', '트랜스지방산': 'lipid', '콜레스테롤': 'lipid',
  '단불포화지방산': 'lipid', '다불포화지방산': 'lipid', '오메가-3': 'lipid',
}

// ── 한국 영양소 섭취기준 (DRV, 성인 기준) ────────────────────────────────────
export const DRV: Record<string, number> = {
  '에너지': 2000,
  '수분': 2000,
  '단백질': 55,
  '지방': 54,
  '탄수화물': 324,
  '총 식이섬유': 25,
  '식이섬유': 25,
  '당류': 100,
  '칼슘': 700,
  '철': 12,
  '인': 700,
  '칼륨': 3500,
  '나트륨': 2000,
  '아연': 8.5,
  '마그네슘': 315,
  '셀레늄': 0.055,
  '구리': 0.8,
  '망간': 3.5,
  '비타민 A': 700,
  '베타카로틴': 4200,
  '티아민': 1.1,
  '비타민 B1': 1.1,
  '리보플라빈': 1.2,
  '비타민 B2': 1.2,
  '나이아신': 14,
  '비타민 B6': 1.5,
  '비타민 C': 100,
  '비타민 D': 10,
  '비타민 E': 12,
  '비타민 K': 70,
  '엽산': 400,
  '판토텐산': 5,
  '콜레스테롤': 300,
  '포화지방산': 15,
}

export interface NutrientEntry {
  name:     string
  value:    number
  unit:     string
  category: NutrientCategory
  drvPct:   number | null
  cluster:  DensityCluster
  zScore:   number
}

export interface MacroSegment {
  name:  string
  g:     number
  kcal:  number
  pct:   number   // % of total caloric macro
  color: string
}

export interface FunctionalScore {
  total:   number
  grade:   'A' | 'B' | 'C' | 'D'
  breakdown: Array<{ label: string; weight: number; rawScore: number }>
}

export interface KNNResult {
  type:       FunctionalType
  similarity: number   // 0-1 cosine similarity
  description: string
}

export interface NutrientProfile {
  entries:          NutrientEntry[]
  byCategory:       Record<NutrientCategory, NutrientEntry[]>
  macroSegments:    MacroSegment[]
  radarAxes:        Array<{ label: string; value: number; key: string }>
  functionalScore:  FunctionalScore
  knnResult:        KNNResult
  clusterSummary:   Record<DensityCluster, number>
}

// ── KNN 참조 프로파일 (% DRV 벡터) ───────────────────────────────────────────
const KNN_PROFILES: Record<FunctionalType, Record<string, number>> = {
  '식이섬유 공급원': { '총 식이섬유': 80, '식이섬유': 80, '칼슘': 20, '칼륨': 20, '비타민 C': 15, '단백질': 10, '철': 10 },
  '미네랄 공급원':   { '칼슘': 70, '철': 60, '칼륨': 50, '인': 40, '마그네슘': 40, '나트륨': 30, '아연': 25 },
  '비타민 공급원':   { '비타민 C': 80, '비타민 A': 50, '엽산': 40, '비타민 B1': 30, '비타민 B2': 30, '나이아신': 25 },
  '균형 영양소':     { '단백질': 30, '총 식이섬유': 25, '칼슘': 25, '비타민 C': 25, '칼륨': 20, '철': 15 },
}

const KNN_DESCRIPTIONS: Record<FunctionalType, string> = {
  '식이섬유 공급원': '장 건강·혈당 조절 기능성 소재 적합. 식이섬유 농축 공정 검토 권장.',
  '미네랄 공급원':   '뼈·혈액·신경계 기능성 소재 적합. 미네랄 농축·정제 공정 검토 권장.',
  '비타민 공급원':   '항산화·면역 기능성 소재 적합. 비타민 안정화 공정 검토 권장.',
  '균형 영양소':     '복합 기능성 원료로 활용 가능. 다기능 건강기능식품 소재 검토 권장.',
}

// ── 유틸리티 ──────────────────────────────────────────────────────────────────
function getCategory(name: string): NutrientCategory {
  return CATEGORY_MAP[name] ?? 'other'
}

function getDRVPct(name: string, value: number): number | null {
  const ref = DRV[name]
  if (ref == null || ref === 0) return null
  return Math.min(200, (value / ref) * 100)
}

function clusterByDRV(pct: number | null): DensityCluster {
  if (pct === null) return 'trace'
  if (pct >= 50) return 'high'
  if (pct >= 20) return 'moderate'
  if (pct >= 5)  return 'low'
  return 'trace'
}

function cosine(a: Record<string, number>, b: Record<string, number>): number {
  const keys = Object.keys(a)
  const dot  = keys.reduce((s, k) => s + (a[k] ?? 0) * (b[k] ?? 0), 0)
  const magA = Math.sqrt(keys.reduce((s, k) => s + (a[k] ** 2), 0))
  const magB = Math.sqrt(Object.values(b).reduce((s, v) => s + v ** 2, 0))
  if (magA === 0 || magB === 0) return 0
  return dot / (magA * magB)
}

// ── 공개 분석 함수 ────────────────────────────────────────────────────────────
export function analyzeNutrients(
  nutrients: Record<string, number | null>,
  units:     Record<string, string>,
): NutrientProfile {

  // 1. 기본 엔트리 생성
  const entries: NutrientEntry[] = []
  for (const [name, rawVal] of Object.entries(nutrients)) {
    if (rawVal === null) continue
    entries.push({
      name, value: rawVal, unit: units[name] ?? '',
      category: getCategory(name),
      drvPct: getDRVPct(name, rawVal),
      cluster: 'trace',
      zScore: 0,
    })
  }

  // 2. Z-score (모수 검정 — 이 식품 내 영양소 밀도 표준화)
  const drvPcts = entries.filter(e => e.drvPct !== null).map(e => e.drvPct as number)
  const mean    = drvPcts.length ? drvPcts.reduce((a, b) => a + b, 0) / drvPcts.length : 0
  const variance = drvPcts.length > 1
    ? drvPcts.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / drvPcts.length : 1
  const std = Math.sqrt(variance) || 1

  for (const e of entries) {
    e.cluster = clusterByDRV(e.drvPct)
    e.zScore  = e.drvPct !== null ? (e.drvPct - mean) / std : -2
  }

  // 3. 카테고리별 그룹화
  const byCategory: Record<NutrientCategory, NutrientEntry[]> = {
    energy: [], macro: [], mineral: [], vitamin: [], lipid: [], other: [],
  }
  for (const e of entries) byCategory[e.category].push(e)

  // 4. 거대영양소 구성비 (열량 기준)
  const MACRO_KCAL: Record<string, number> = { '탄수화물': 4, '단백질': 4, '지방': 9 }
  const MACRO_COLOR: Record<string, string> = {
    '탄수화물': '#f59e0b', '단백질': '#3b82f6', '지방': '#ef4444', '총 식이섬유': '#22c55e',
  }
  const macroGrams: Record<string, number> = {
    '탄수화물':  nutrients['탄수화물'] ?? 0,
    '단백질':    nutrients['단백질']   ?? 0,
    '지방':      nutrients['지방']     ?? 0,
    '총 식이섬유': nutrients['총 식이섬유'] ?? nutrients['식이섬유'] ?? 0,
  }
  const totalKcal = Object.entries(macroGrams)
    .filter(([k]) => k !== '총 식이섬유')
    .reduce((s, [k, v]) => s + v * (MACRO_KCAL[k] ?? 0), 0)

  const macroSegments: MacroSegment[] = Object.entries(macroGrams)
    .filter(([, g]) => g > 0)
    .map(([name, g]) => {
      const kcal = (MACRO_KCAL[name] ?? 0) * g
      return { name, g, kcal, pct: totalKcal > 0 ? (kcal / totalKcal) * 100 : 0, color: MACRO_COLOR[name] ?? '#6b7280' }
    })
    .filter(m => m.name !== '총 식이섬유' ? true : true)

  // 5. 레이더 축 (8개 핵심 영양소 DRV%)
  const RADAR_KEYS = [
    { key: '단백질',    label: '단백질' },
    { key: '총 식이섬유', label: '식이섬유' },
    { key: '칼슘',     label: '칼슘' },
    { key: '철',       label: '철' },
    { key: '칼륨',     label: '칼륨' },
    { key: '비타민 C', label: '비타민C' },
    { key: '비타민 A', label: '비타민A' },
    { key: '나트륨',   label: '나트륨' },
  ]
  const radarAxes = RADAR_KEYS.map(({ key, label }) => {
    const val = nutrients[key] ?? nutrients[key === '총 식이섬유' ? '식이섬유' : key] ?? 0
    return { key, label, value: Math.min(100, getDRVPct(key, val) ?? 0) }
  })

  // 6. KNN 분류 (코사인 유사도)
  const foodVector: Record<string, number> = {}
  for (const e of entries) {
    if (e.drvPct !== null) foodVector[e.name] = e.drvPct
  }

  let bestType: FunctionalType = '균형 영양소'
  let bestSim = -1
  for (const [type, refVec] of Object.entries(KNN_PROFILES) as [FunctionalType, Record<string, number>][]) {
    const sim = cosine(foodVector, refVec)
    if (sim > bestSim) { bestSim = sim; bestType = type }
  }
  const knnResult: KNNResult = { type: bestType, similarity: bestSim, description: KNN_DESCRIPTIONS[bestType] }

  // 7. 기능성 점수 (bi 가중 채점 방식, 지도학습 구조)
  const tdfPct = Math.min(100, getDRVPct('총 식이섬유', nutrients['총 식이섬유'] ?? nutrients['식이섬유'] ?? 0) ?? 0)
  const mineralEntries = byCategory.mineral.filter(e => e.drvPct !== null)
  const mineralDensity = mineralEntries.length > 0
    ? Math.min(100, mineralEntries.reduce((s, e) => s + (e.drvPct ?? 0), 0) / mineralEntries.length)
    : 0
  const vitaminEntries = byCategory.vitamin.filter(e => e.drvPct !== null)
  const vitaminDensity = vitaminEntries.length > 0
    ? Math.min(100, vitaminEntries.reduce((s, e) => s + (e.drvPct ?? 0), 0) / vitaminEntries.length)
    : 0
  const proteinPct = Math.min(100, getDRVPct('단백질', nutrients['단백질'] ?? 0) ?? 0)
  const sugarRatio  = (nutrients['당류'] ?? 0) / Math.max(1, nutrients['탄수화물'] ?? 1)
  const sugarScore  = Math.max(0, 100 - sugarRatio * 150)

  const breakdown = [
    { label: '식이섬유 밀도',  weight: 35, rawScore: tdfPct },
    { label: '미네랄 복합 밀도', weight: 25, rawScore: mineralDensity },
    { label: '비타민 복합 밀도', weight: 20, rawScore: vitaminDensity },
    { label: '단백질 함량',    weight: 10, rawScore: proteinPct },
    { label: '저당 비율',      weight: 10, rawScore: sugarScore },
  ]
  const total = Math.min(100, Math.round(breakdown.reduce((s, b) => s + b.rawScore * b.weight / 100, 0)))
  const grade: 'A' | 'B' | 'C' | 'D' = total >= 70 ? 'A' : total >= 50 ? 'B' : total >= 30 ? 'C' : 'D'
  const functionalScore: FunctionalScore = { total, grade, breakdown }

  // 8. 군집 요약
  const clusterSummary: Record<DensityCluster, number> = { high: 0, moderate: 0, low: 0, trace: 0 }
  for (const e of entries) {
    if (e.category !== 'energy') clusterSummary[e.cluster]++
  }

  return { entries, byCategory, macroSegments, radarAxes, functionalScore, knnResult, clusterSummary }
}
