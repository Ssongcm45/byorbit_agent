import type { InferenceOutput, SevenScores, ScoringWeights } from './types'
import type { DiagnosisInput } from '@/lib/coa/schema'

type Grade = 'A' | 'B' | 'C' | 'D'

function gradeFromTotal(total: number): Grade {
  if (total >= 85) return 'A'
  if (total >= 70) return 'B'
  if (total >= 50) return 'C'
  return 'D'
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

// R1~R5 → 7점수 매핑 계산
export function computeSevenScores(
  inference: InferenceOutput,
  input: Pick<DiagnosisInput, 'moisture_level' | 'odor_issue' | 'monthly_volume_kg' | 'current_disposal_cost'>,
  weights: ScoringWeights,
): SevenScores {
  const { R1, R2, R3, R4, R5, heavy_metals_ok, microbial_ok } = inference

  // 1. 원료화 가능성 (R1 + R3 영향)
  const score_resource_potential = clamp(
    (R1.pass ? 80 : 30) +
    (R3.pass ? 20 : -20) +
    (R3.flags.some(f => f.level === 'critical') ? -15 : 0)
  )

  // 2. 성분가치 (R1 + R2 영향)
  const score_composition_value = clamp(
    (R1.pass ? 60 : 20) +
    (R2.pass ? 40 : 10) +
    (R1.confidence === 'high' ? 5 : 0)
  )

  // 3. 전처리 난이도 (수분, 건조 영향 — 낮을수록 좋음)
  const moistureScore =
    input.moisture_level === 'low'    ? 90 :
    input.moisture_level === 'medium' ? 60 : 25
  const odorPenalty = input.odor_issue ? -15 : 0
  const score_pretreatment_difficulty = clamp(moistureScore + odorPenalty)

  // 4. 보관/물류 위험 (R3 + shelf_life 영향 — 낮은 위험 = 높은 점수)
  const r3Warning = R3.flags.some(f => f.level === 'warning')
  const r3Critical = R3.flags.some(f => f.level === 'critical')
  const score_logistics_risk = clamp(
    100 -
    (r3Critical ? 60 : 0) -
    (r3Warning  ? 30 : 0) -
    (input.moisture_level === 'high' ? 20 : 0)
  )

  // 5. 수요처 매칭 (R5 영향)
  const score_market_match = clamp(
    (R5.pass ? 85 : 30) +
    (R5.confidence === 'high' ? 10 : 0)
  )

  // 6. 경제성 (R4 + 투입 비용 영향)
  let economicBase = R4.pass ? 65 : 25
  if (input.current_disposal_cost !== undefined && input.current_disposal_cost > 0) {
    // 폐기비가 높을수록 경제성 점수 상승
    const savingBonus = Math.min(30, Math.floor(input.current_disposal_cost / 10))
    economicBase += savingBonus
  }
  const score_economics = clamp(economicBase)

  // 7. 규제/품질 리스크 (중금속, 미생물 영향 — 낮은 위험 = 높은 점수)
  const score_regulatory_risk = clamp(
    100 -
    (heavy_metals_ok ? 0 : 50) -
    (microbial_ok    ? 0 : 40)
  )

  // 가중 합산
  const rawScores = {
    score_resource_potential,
    score_composition_value,
    score_pretreatment_difficulty,
    score_logistics_risk,
    score_market_match,
    score_economics,
    score_regulatory_risk,
  }

  const weighted_total = clamp(
    Object.entries(rawScores).reduce((sum, [key, score]) => {
      const w = weights[key as keyof ScoringWeights]?.weight ?? 0
      return sum + score * w
    }, 0)
  )

  return {
    ...rawScores,
    weighted_total,
    final_grade: gradeFromTotal(weighted_total),
  }
}

export function computeFinalGrade(scores: SevenScores): Grade {
  return gradeFromTotal(scores.weighted_total)
}

export function loadScoringWeights(
  allWeights: Record<string, ScoringWeights>,
  byproductType: string,
): ScoringWeights {
  return allWeights[byproductType] ?? allWeights['default']
}
