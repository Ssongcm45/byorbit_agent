import type { CoAFormData } from '../coa/schema'

// 품목별 규칙 (byproduct-rules.json 구조)
export interface RuleCondition {
  field:      string
  operator:   'gte' | 'lte' | 'lt' | 'gt' | 'eq' | 'neq'
  threshold?: number
  value?:     string | boolean | number
  unit?:      string
  flag?:      'warning' | 'critical'
  logic?:     'OR'
  note?:      string
}

export interface ByproductRule {
  name:        string
  conditions:  RuleCondition[]
  pass_action?:   string
  fail_action?:   string
  competitor?:    string
  market_benchmark?: Record<string, { min: number; max: number }>
}

export interface ByproductRules {
  R1: ByproductRule
  R2: ByproductRule
  R3: ByproductRule
  R4: ByproductRule
  R5: ByproductRule
}

// R1~R5 단건 결과
export interface RuleResult {
  code:       'R1' | 'R2' | 'R3' | 'R4' | 'R5'
  name:       string
  pass:       boolean
  confidence: 'high' | 'medium' | 'low'
  flags:      Array<{ field: string; level: 'warning' | 'critical'; message: string }>
  action:     string
  details:    string[]
}

// 전체 추론 결과
export interface InferenceOutput {
  byproduct_type: string
  R1: RuleResult
  R2: RuleResult
  R3: RuleResult
  R4: RuleResult
  R5: RuleResult
  heavy_metals_ok:  boolean
  microbial_ok:     boolean
  coa_complete:     boolean
  computed_at:      string
}

// CoA 폼 데이터 확장 (품목별 추가 필드)
export interface ExtendedCoAData extends CoAFormData {
  lignocellulose_pct?:       number
  oil_pct?:                  number
  glucosinolate_mg_per_100g?: number
  pesticide_test_done?:       boolean
  pesticide_ok?:              boolean
}

// 7점수 구조
export interface SevenScores {
  score_resource_potential:      number  // 0~100
  score_composition_value:       number
  score_pretreatment_difficulty: number
  score_logistics_risk:          number
  score_market_match:            number
  score_economics:               number
  score_regulatory_risk:         number
  weighted_total:                number
  final_grade:                   'A' | 'B' | 'C' | 'D'
}

// 가중치 구조 (scoring-weights.json)
export interface ScoreWeightEntry {
  weight: number
  desc?:  string
}

export interface ScoringWeights {
  score_resource_potential:      ScoreWeightEntry
  score_composition_value:       ScoreWeightEntry
  score_pretreatment_difficulty: ScoreWeightEntry
  score_logistics_risk:          ScoreWeightEntry
  score_market_match:            ScoreWeightEntry
  score_economics:               ScoreWeightEntry
  score_regulatory_risk:         ScoreWeightEntry
}

// 라벨
export interface LabelSet {
  component_trait: string[]
  risk:            string[]
  application:     string[]
  evidence:        string[]
}
