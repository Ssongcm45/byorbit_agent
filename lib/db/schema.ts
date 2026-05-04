/**
 * lib/db/schema.ts
 * ByOrbit 전체 DB 스키마 — Drizzle ORM + Neon PostgreSQL
 *
 * 테이블 그룹:
 *   [A] Journey A     : batches, correction_factor_history, rda_cache
 *   [B] Journey B     : byproducts, raw_materials, compositions, applications,
 *                       byproduct_application_map, economics, diagnosis_inputs, diagnosis_results
 *   [L] 라벨 시스템   : labels, entity_labels, vocab_terms,
 *                       material_synonyms, component_synonyms, unit_conversion_rules
 *   [C] CoA 이력      : coa_documents, traceability_events
 *   [S] 점수/규칙     : scoring_rules
 */

import {
  pgTable, uuid, varchar, text, integer, real, boolean,
  timestamp, jsonb, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Enums ──────────────────────────────────────────────────────────────────

export const byproductTypeEnum = pgEnum('byproduct_type', [
  'apple_pomace',
  'coffee_grounds',
  'citrus_pomace',
  'cabbage_residue',
  'hemp_residue',
  'other',
])

export const dryingMethodEnum = pgEnum('drying_method', [
  '히트펌프건조', '열풍건조', '동결건조', '분무건조', 'none',
])

export const evidenceGradeEnum = pgEnum('evidence_grade', [
  'A', 'B', 'C', 'D', 'E',
])

export const coaStatusEnum = pgEnum('coa_status', [
  'draft', 'pending_review', 'verified', 'rejected', 'expired', 'superseded',
])

export const diagnosisGradeEnum = pgEnum('diagnosis_grade', [
  'A', 'B', 'C', 'D',
])

export const assignmentMethodEnum = pgEnum('assignment_method', [
  'manual', 'rule_based', 'llm_assisted', 'api_imported', 'coa_derived', 'expert_reviewed',
])

export const basisTypeEnum = pgEnum('basis_type', [
  'wet_basis', 'dry_basis', 'as_is', 'edible_portion', 'extract_basis',
])

export const traceabilityEventEnum = pgEnum('traceability_event_type', [
  'collected', 'received', 'washed', 'pressed', 'dried',
  'milled', 'sampled', 'tested', 'stored', 'shipped', 'discarded',
])

// ══════════════════════════════════════════════════════════════════════════
// [A] JOURNEY A — CoA 분석 테이블
// ══════════════════════════════════════════════════════════════════════════

/**
 * batches: CoA 기반 분석 배치
 */
export const batches = pgTable('batches', {
  id:             uuid('id').primaryKey().defaultRandom(),
  batch_id:       varchar('batch_id', { length: 100 }).unique().notNull(),
  byproduct_type: byproductTypeEnum('byproduct_type').notNull().default('apple_pomace'),
  variety:        varchar('variety', { length: 100 }).notNull(),
  region:         varchar('region', { length: 100 }),
  harvest_season: varchar('harvest_season', { length: 7 }),  // YYYY-MM
  coa_data:       jsonb('coa_data').notNull(),              // CoAFormData
  inference:      jsonb('inference'),                        // InferenceOutput (R1~R5)
  seven_scores:   jsonb('seven_scores'),                     // SevenScores
  final_grade:    diagnosisGradeEnum('final_grade'),
  labels:         jsonb('labels'),                           // LabelSet (자동 부여)
  report_md:      text('report_md'),
  jsonld:         jsonb('jsonld'),
  pdf_url:        text('pdf_url'),                          // Vercel Blob URL
  created_at:     timestamp('created_at').defaultNow(),
  updated_at:     timestamp('updated_at').defaultNow(),
}, (t) => ({
  byproductTypeIdx: index('batches_byproduct_type_idx').on(t.byproduct_type),
  varietyIdx:       index('batches_variety_idx').on(t.variety),
}))

/**
 * correction_factor_history: 보정 계수 이력 (캘리브레이션 결과)
 */
export const correctionFactorHistory = pgTable('correction_factor_history', {
  id:             uuid('id').primaryKey().defaultRandom(),
  batch_id:       uuid('batch_id').references(() => batches.id),
  byproduct_type: byproductTypeEnum('byproduct_type').notNull(),
  factors:        jsonb('factors').notNull(),   // CorrectionFactors
  delta:          jsonb('delta'),               // 추정 vs 실측 델타
  sample_count:   integer('sample_count').default(1),
  created_at:     timestamp('created_at').defaultNow(),
})

/**
 * rda_cache: 농진청 API 응답 캐시 (24h TTL)
 */
export const rdaCache = pgTable('rda_cache', {
  food_name:      varchar('food_name', { length: 200 }).primaryKey(),
  byproduct_type: byproductTypeEnum('byproduct_type'),
  data:           jsonb('data').notNull(),
  source:         varchar('source', { length: 50 }).default('rda_koreanfood'),
  expires_at:     timestamp('expires_at').notNull(),
  created_at:     timestamp('created_at').defaultNow(),
})

// ══════════════════════════════════════════════════════════════════════════
// [B] JOURNEY B — 간이 진단 + 지식베이스 테이블
// ══════════════════════════════════════════════════════════════════════════

/**
 * raw_materials: 원물 정보 (사과, 커피, 감귤...)
 */
export const rawMaterials = pgTable('raw_materials', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name_kr:         varchar('name_kr', { length: 100 }).notNull(),
  name_en:         varchar('name_en', { length: 100 }),
  scientific_name: varchar('scientific_name', { length: 200 }),
  category:        varchar('category', { length: 100 }),
  seasonality:     jsonb('seasonality'),        // 월별 수확 시기
  major_regions:   jsonb('major_regions'),      // 주요 산지
  description:     text('description'),
  created_at:      timestamp('created_at').defaultNow(),
})

/**
 * byproducts: 부산물 기본 정보 + 진단 기준값
 */
export const byproducts = pgTable('byproducts', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  byproduct_type:        byproductTypeEnum('byproduct_type').unique().notNull(),
  raw_material_id:       uuid('raw_material_id').references(() => rawMaterials.id),
  name_kr:               varchar('name_kr', { length: 100 }).notNull(),
  name_en:               varchar('name_en', { length: 100 }),
  generation_process:    varchar('generation_process', { length: 200 }),
  typical_moisture_min:  real('typical_moisture_min'),
  typical_moisture_max:  real('typical_moisture_max'),
  main_features:         jsonb('main_features'),  // string[]
  common_disposal:       varchar('common_disposal', { length: 200 }),
  // 간이 진단 기본값 (Journey B - CoA 없을 때)
  estimated_TDF_min:     real('estimated_TDF_min'),
  estimated_TDF_max:     real('estimated_TDF_max'),
  estimated_TPC_min:     real('estimated_TPC_min'),
  estimated_TPC_max:     real('estimated_TPC_max'),
  default_application:   jsonb('default_application'), // string[] 추천 활용처
  seasonality:           jsonb('seasonality'),
  shelf_life_h_typical:  integer('shelf_life_h_typical'),
  description:           text('description'),
  created_at:            timestamp('created_at').defaultNow(),
})

/**
 * compositions: 부산물 성분 데이터 (범위값 + 출처)
 */
export const compositions = pgTable('compositions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  byproduct_id:    uuid('byproduct_id').references(() => byproducts.id).notNull(),
  component_name:  varchar('component_name', { length: 100 }).notNull(),
  component_group: varchar('component_group', { length: 100 }),  // 식이섬유, 폴리페놀...
  value_min:       real('value_min'),
  value_max:       real('value_max'),
  value_typical:   real('value_typical'),
  unit:            varchar('unit', { length: 50 }),
  basis_type:      basisTypeEnum('basis_type').default('dry_basis'),
  source_type:     varchar('source_type', { length: 50 }), // rda_db, paper, coa_internal
  source_ref:      text('source_ref'),
  evidence_grade:  evidenceGradeEnum('evidence_grade').default('C'),
  condition:       text('condition'), // 분석 조건 (건조방식, 온도 등)
  notes:           text('notes'),
  created_at:      timestamp('created_at').defaultNow(),
}, (t) => ({
  byproductIdx: index('compositions_byproduct_idx').on(t.byproduct_id),
  componentIdx: index('compositions_component_idx').on(t.component_name),
}))

/**
 * applications: 활용처 정의
 */
export const applications = pgTable('applications', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  name:                  varchar('name', { length: 200 }).notNull(),
  industry:              varchar('industry', { length: 100 }),
  required_form:         varchar('required_form', { length: 100 }),
  required_moisture_max: real('required_moisture_max'),
  required_quality:      text('required_quality'),
  required_pretreatment: jsonb('required_pretreatment'), // string[]
  value_level:           varchar('value_level', { length: 20 }), // high/medium/low
  difficulty_level:      varchar('difficulty_level', { length: 20 }),
  regulation_sensitivity:varchar('regulation_sensitivity', { length: 20 }),
  description:           text('description'),
  created_at:            timestamp('created_at').defaultNow(),
})

/**
 * byproduct_application_map: 부산물 ↔ 활용처 매핑
 */
export const byproductApplicationMap = pgTable('byproduct_application_map', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  byproduct_id:          uuid('byproduct_id').references(() => byproducts.id).notNull(),
  application_id:        uuid('application_id').references(() => applications.id).notNull(),
  suitability_score:     integer('suitability_score'), // 0~100
  required_pretreatment: jsonb('required_pretreatment'),
  min_TDF:               real('min_TDF'),
  min_TPC:               real('min_TPC'),
  max_moisture:          real('max_moisture'),
  notes:                 text('notes'),
  created_at:            timestamp('created_at').defaultNow(),
})

/**
 * economics: 경제성 기본값 (byproduct별)
 */
export const economics = pgTable('economics', {
  id:                         uuid('id').primaryKey().defaultRandom(),
  byproduct_id:               uuid('byproduct_id').references(() => byproducts.id).notNull(),
  typical_disposal_cost_min:  real('typical_disposal_cost_min'),  // 원/kg
  typical_disposal_cost_max:  real('typical_disposal_cost_max'),
  typical_drying_cost_min:    real('typical_drying_cost_min'),
  typical_drying_cost_max:    real('typical_drying_cost_max'),
  typical_sell_price_min:     real('typical_sell_price_min'),
  typical_sell_price_max:     real('typical_sell_price_max'),
  moisture_reduction_pct:     real('moisture_reduction_pct'),   // 건조 감량률
  unit:                       varchar('unit', { length: 20 }).default('KRW/kg'),
  notes:                      text('notes'),
  updated_at:                 timestamp('updated_at').defaultNow(),
})

/**
 * diagnosis_inputs: Journey B 진단 입력
 */
export const diagnosisInputs = pgTable('diagnosis_inputs', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  user_id:                 varchar('user_id', { length: 100 }),
  byproduct_name:          varchar('byproduct_name', { length: 200 }).notNull(),
  byproduct_type:          byproductTypeEnum('byproduct_type'),
  region:                  varchar('region', { length: 100 }),
  monthly_volume_kg:       real('monthly_volume_kg'),
  current_disposal_method: varchar('current_disposal_method', { length: 200 }),
  current_disposal_cost:   real('current_disposal_cost'),   // 원/kg
  moisture_level:          varchar('moisture_level', { length: 20 }), // low/medium/high
  odor_issue:              boolean('odor_issue').default(false),
  has_photo:               boolean('has_photo').default(false),
  photo_url:               text('photo_url'),
  created_at:              timestamp('created_at').defaultNow(),
})

/**
 * diagnosis_results: Journey B 진단 결과
 */
export const diagnosisResults = pgTable('diagnosis_results', {
  id:                          uuid('id').primaryKey().defaultRandom(),
  diagnosis_input_id:          uuid('diagnosis_input_id').references(() => diagnosisInputs.id).notNull(),
  // 7점수
  score_resource_potential:    integer('score_resource_potential'),  // 원료화 가능성
  score_composition_value:     integer('score_composition_value'),   // 성분가치
  score_pretreatment_difficulty:integer('score_pretreatment_difficulty'),
  score_logistics_risk:        integer('score_logistics_risk'),
  score_market_match:          integer('score_market_match'),        // 수요처 매칭
  score_economics:             integer('score_economics'),
  score_regulatory_risk:       integer('score_regulatory_risk'),
  final_grade:                 diagnosisGradeEnum('final_grade'),
  recommended_applications:    jsonb('recommended_applications'),    // string[] top 3
  recommended_actions:         jsonb('recommended_actions'),         // string[] top 3
  economics_summary:           jsonb('economics_summary'),           // EconomicsResult
  report_text:                 text('report_text'),
  created_at:                  timestamp('created_at').defaultNow(),
})

// ══════════════════════════════════════════════════════════════════════════
// [L] 라벨 시스템
// ══════════════════════════════════════════════════════════════════════════

/**
 * labels: 라벨 정의 (7종 그룹)
 */
export const labels = pgTable('labels', {
  id:             uuid('id').primaryKey().defaultRandom(),
  label_group:    varchar('label_group', { length: 100 }).notNull(), // material/process/component_trait/evidence/application/risk/coa_status
  label_code:     varchar('label_code', { length: 100 }).notNull(),
  label_name_ko:  varchar('label_name_ko', { length: 200 }),
  label_name_en:  varchar('label_name_en', { length: 200 }),
  description:    text('description'),
  parent_label_id:uuid('parent_label_id'),
  status:         varchar('status', { length: 20 }).default('active'),
  created_at:     timestamp('created_at').defaultNow(),
}, (t) => ({
  uniqueCode: uniqueIndex('labels_code_unique').on(t.label_group, t.label_code),
}))

/**
 * entity_labels: 엔티티에 라벨 부여 (다대다)
 */
export const entityLabels = pgTable('entity_labels', {
  id:                uuid('id').primaryKey().defaultRandom(),
  entity_type:       varchar('entity_type', { length: 50 }).notNull(), // batch/sample/byproduct/coa/measurement
  entity_id:         uuid('entity_id').notNull(),
  label_id:          uuid('label_id').references(() => labels.id).notNull(),
  confidence_score:  real('confidence_score'),    // 0~1
  assigned_by:       varchar('assigned_by', { length: 100 }),
  assignment_method: assignmentMethodEnum('assignment_method').default('rule_based'),
  source_id:         varchar('source_id', { length: 200 }),
  created_at:        timestamp('created_at').defaultNow(),
}, (t) => ({
  entityIdx: index('entity_labels_entity_idx').on(t.entity_type, t.entity_id),
  labelIdx:  index('entity_labels_label_idx').on(t.label_id),
}))

/**
 * vocab_terms: Controlled Vocabulary (통제어 사전)
 */
export const vocabTerms = pgTable('vocab_terms', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  vocabulary_name:     varchar('vocabulary_name', { length: 100 }).notNull(), // process/material/component/unit/industry
  preferred_label_ko:  varchar('preferred_label_ko', { length: 200 }).notNull(),
  preferred_label_en:  varchar('preferred_label_en', { length: 200 }),
  alt_labels:          jsonb('alt_labels'),   // string[] — 허용 대체 표현
  parent_term_id:      uuid('parent_term_id'),
  definition:          text('definition'),
  status:              varchar('status', { length: 20 }).default('active'),
  created_at:          timestamp('created_at').defaultNow(),
}, (t) => ({
  labelIdx: index('vocab_terms_label_idx').on(t.vocabulary_name, t.preferred_label_ko),
}))

/**
 * material_synonyms: 원료 유의어
 */
export const materialSynonyms = pgTable('material_synonyms', {
  id:           uuid('id').primaryKey().defaultRandom(),
  material_id:  varchar('material_id', { length: 100 }).notNull(), // e.g. 'APPLE_POMACE'
  synonym:      varchar('synonym', { length: 300 }).notNull(),
  language:     varchar('language', { length: 10 }).default('ko'),
  synonym_type: varchar('synonym_type', { length: 50 }), // preferred/synonym/field_term/excluded
  created_at:   timestamp('created_at').defaultNow(),
}, (t) => ({
  materialIdx: index('material_synonyms_material_idx').on(t.material_id),
}))

/**
 * component_synonyms: 성분명 유의어
 */
export const componentSynonyms = pgTable('component_synonyms', {
  id:            uuid('id').primaryKey().defaultRandom(),
  component_id:  varchar('component_id', { length: 100 }).notNull(), // e.g. 'TDF'
  synonym:       varchar('synonym', { length: 300 }).notNull(),
  language:      varchar('language', { length: 10 }).default('ko'),
  source_system: varchar('source_system', { length: 100 }), // rda/mfds/infoods/internal
  created_at:    timestamp('created_at').defaultNow(),
})

/**
 * unit_conversion_rules: 단위 변환 규칙
 */
export const unitConversionRules = pgTable('unit_conversion_rules', {
  id:                uuid('id').primaryKey().defaultRandom(),
  from_unit:         varchar('from_unit', { length: 50 }).notNull(),
  to_unit:           varchar('to_unit', { length: 50 }).notNull(),
  conversion_factor: real('conversion_factor').notNull(),
  basis_condition:   varchar('basis_condition', { length: 100 }), // 변환 조건 (수분율 등)
  formula:           text('formula'),      // 복잡한 변환식
  note:              text('note'),
  created_at:        timestamp('created_at').defaultNow(),
})

// ══════════════════════════════════════════════════════════════════════════
// [C] CoA 이력 관리
// ══════════════════════════════════════════════════════════════════════════

/**
 * coa_documents: CoA 파일 메타데이터
 */
export const coaDocuments = pgTable('coa_documents', {
  id:              uuid('id').primaryKey().defaultRandom(),
  batch_id:        uuid('batch_id').references(() => batches.id),
  sample_id:       varchar('sample_id', { length: 100 }),
  lab_name:        varchar('lab_name', { length: 200 }),
  analysis_date:   varchar('analysis_date', { length: 20 }),
  test_method:     varchar('test_method', { length: 200 }),
  analyst:         varchar('analyst', { length: 100 }),
  report_file_url: text('report_file_url'),
  coa_status:      coaStatusEnum('coa_status').default('draft'),
  evidence_grade:  evidenceGradeEnum('evidence_grade').default('B'),
  parsed_data:     jsonb('parsed_data'),   // Kordac 파싱 결과
  confidence:      real('confidence'),     // 파싱 신뢰도 0~1
  created_at:      timestamp('created_at').defaultNow(),
  updated_at:      timestamp('updated_at').defaultNow(),
})

/**
 * traceability_events: 배치 이벤트 로그 (ISO 22005 기반)
 */
export const traceabilityEvents = pgTable('traceability_events', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  batch_id:           uuid('batch_id').references(() => batches.id),
  event_type:         traceabilityEventEnum('event_type').notNull(),
  event_time:         timestamp('event_time').notNull(),
  actor:              varchar('actor', { length: 200 }),   // 담당자/기관
  location:           varchar('location', { length: 200 }),
  input_material_id:  varchar('input_material_id', { length: 100 }),
  output_material_id: varchar('output_material_id', { length: 100 }),
  quantity_kg:        real('quantity_kg'),
  document_id:        uuid('document_id').references(() => coaDocuments.id),
  notes:              text('notes'),
  created_at:         timestamp('created_at').defaultNow(),
}, (t) => ({
  batchIdx: index('traceability_batch_idx').on(t.batch_id),
}))

// ══════════════════════════════════════════════════════════════════════════
// [S] 점수 / 추론 규칙 설정
// ══════════════════════════════════════════════════════════════════════════

/**
 * scoring_rules: DB에서 로드하는 추론/점수 규칙
 * byproduct_type별로 다른 임계값 관리
 */
export const scoringRules = pgTable('scoring_rules', {
  id:              uuid('id').primaryKey().defaultRandom(),
  byproduct_type:  byproductTypeEnum('byproduct_type').notNull(),
  rule_code:       varchar('rule_code', { length: 50 }).notNull(), // R1, R2, R3, R4, R5, SCORE_1...
  rule_name:       varchar('rule_name', { length: 200 }),
  condition_json:  jsonb('condition_json').notNull(),  // { field, operator, threshold, unit }
  score_weight:    real('score_weight').default(1.0),  // 7점수 합산 시 가중치
  description:     text('description'),
  is_active:       boolean('is_active').default(true),
  created_at:      timestamp('created_at').defaultNow(),
  updated_at:      timestamp('updated_at').defaultNow(),
}, (t) => ({
  byproductRuleIdx: uniqueIndex('scoring_rules_unique').on(t.byproduct_type, t.rule_code),
}))

// ══════════════════════════════════════════════════════════════════════════
// [F] 식품 성분 DB — NICS 원물 기준 + 전처리별 샘플
// ══════════════════════════════════════════════════════════════════════════

export const extractionMethodEnum = pgEnum('extraction_method', [
  'none', '분쇄', '미생물', '효소', '용매추출', '압착',
])

/**
 * food_references: 외부 DB(NICS 등)에서 조회한 원물 기준 성분 데이터
 * - NICS API 조회 결과를 영구 저장 (쿼터 절약)
 * - 131개+ 성분 모두 JSONB로 보관
 */
export const foodReferences = pgTable('food_references', {
  id:              uuid('id').primaryKey().defaultRandom(),
  food_code:       varchar('food_code', { length: 100 }).unique(),
  food_name:       varchar('food_name', { length: 300 }).notNull(),
  source:          varchar('source', { length: 100 }).notNull().default('nics_v2'),
  basis:           varchar('basis', { length: 50 }).notNull().default('per_100g'),
  nutrients:       jsonb('nutrients').notNull().default({}),       // {성분명: 수치}
  nutrient_units:  jsonb('nutrient_units').notNull().default({}),  // {성분명: 단위}
  saved_at:        timestamp('saved_at').defaultNow(),
}, (t) => ({
  foodNameIdx: index('food_references_name_idx').on(t.food_name),
}))

/**
 * byproduct_samples: 전처리·추출 방식별 실측 성분 데이터
 * - 같은 원물을 건조방식/추출방식별로 비교 분석 가능
 * - CoA 배치와 연동
 */
export const byproductSamples = pgTable('byproduct_samples', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  sample_name:         varchar('sample_name', { length: 300 }).notNull(),
  byproduct_type:      byproductTypeEnum('byproduct_type').notNull(),
  base_food_code:      varchar('base_food_code', { length: 100 })
                         .references(() => foodReferences.food_code),
  coa_batch_id:        varchar('coa_batch_id', { length: 100 }),

  // 전처리 파라미터
  drying_method:       dryingMethodEnum('drying_method').default('none'),
  extraction_method:   extractionMethodEnum('extraction_method').default('none'),
  drying_temp_c:       real('drying_temp_c'),
  drying_time_min:     real('drying_time_min'),
  particle_size_um:    real('particle_size_um'),
  moisture_after_pct:  real('moisture_after_pct'),

  // 측정 성분
  nutrients:           jsonb('nutrients').notNull().default({}),
  nutrient_units:      jsonb('nutrient_units').notNull().default({}),
  // 원물 대비 보존율 (자동 계산): {TDF: 0.95, TPC: 0.82}
  retention_factors:   jsonb('retention_factors').default({}),

  lab_name:            varchar('lab_name', { length: 200 }),
  analysis_date:       varchar('analysis_date', { length: 20 }),
  notes:               text('notes'),
  created_at:          timestamp('created_at').defaultNow(),
}, (t) => ({
  byproductTypeIdx: index('byproduct_samples_type_idx').on(t.byproduct_type),
  baseFoodIdx:      index('byproduct_samples_base_food_idx').on(t.base_food_code),
  dryingMethodIdx:  index('byproduct_samples_drying_idx').on(t.drying_method),
}))

export const foodReferencesRelations = relations(foodReferences, ({ many }) => ({
  samples: many(byproductSamples),
}))

export const byproductSamplesRelations = relations(byproductSamples, ({ one }) => ({
  foodReference: one(foodReferences, {
    fields:     [byproductSamples.base_food_code],
    references: [foodReferences.food_code],
  }),
}))

// ── Relations ───────────────────────────────────────────────────────────

export const batchesRelations = relations(batches, ({ many }) => ({
  correctionHistory: many(correctionFactorHistory),
  coaDocuments:      many(coaDocuments),
  traceability:      many(traceabilityEvents),
  entityLabels:      many(entityLabels),
}))

export const byproductsRelations = relations(byproducts, ({ one, many }) => ({
  rawMaterial:         one(rawMaterials, { fields: [byproducts.raw_material_id], references: [rawMaterials.id] }),
  compositions:        many(compositions),
  applicationMaps:     many(byproductApplicationMap),
  economics:           many(economics),
}))

export const diagnosisInputsRelations = relations(diagnosisInputs, ({ many }) => ({
  results: many(diagnosisResults),
}))
