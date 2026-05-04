/**
 * JSON-LD 온톨로지 빌더
 * Python ontology_writer.py 포팅 + 다중 품목 지원
 */

import type { PomaceEstimate, ComparisonResult } from './correction'
import type { CoAFormData } from '@/lib/coa/schema'
import type { InferenceOutput, SevenScores, LabelSet } from '@/lib/inference/types'

const CONTEXT = {
  '@vocab':  'https://byorbit.io/ontology/',
  schema:    'https://schema.org/',
  rda:       'https://koreanfood.rda.go.kr/vocab/',
  xsd:       'http://www.w3.org/2001/XMLSchema#',
}

const BYPRODUCT_NAMES: Record<string, { ko: string; en: string; process: string }> = {
  apple_pomace:    { ko: '사과박',     en: 'apple pomace',     process: '착즙 (screw press)' },
  coffee_grounds:  { ko: '커피박',     en: 'coffee grounds',   process: '추출 (espresso/drip)' },
  citrus_pomace:   { ko: '감귤박',     en: 'citrus pomace',    process: '착즙 (press)' },
  cabbage_residue: { ko: '배추 부산물', en: 'cabbage residue', process: '김치 가공 부산물' },
}

export interface JSONLDInput {
  form:        CoAFormData
  estimate?:   PomaceEstimate | null
  comparison?: ComparisonResult | null
  inference?:  InferenceOutput | null
  sevenScores?: SevenScores | null
  labels?:     LabelSet | null
}

export function buildJSONLD(input: JSONLDInput): Record<string, unknown> {
  const { form, estimate, comparison, inference, sevenScores, labels } = input
  const bpInfo = BYPRODUCT_NAMES[form.byproduct_type] ?? { ko: form.byproduct_type, en: form.byproduct_type, process: '' }

  const doc: Record<string, unknown> = {
    '@context': CONTEXT,
    '@type':    'Byproduct',
    '@id':      `byorbit:${form.byproduct_type}-${form.batch_id}`,

    generatedAt:    new Date().toISOString(),
    batchId:        form.batch_id,
    byproductType:  form.byproduct_type,
    commonName:     bpInfo.ko,
    localName_en:   bpInfo.en,
    variety:        form.variety,
    region:         form.region,
    sourceProcess:  bpInfo.process,
    harvestSeason:  form.harvest_season,

    physicalProperty: {
      dryingMethod:      form.drying_method,
      dryingTempC:       form.drying_temp_c,
      dryingTimeH:       form.drying_time_h,
      freshMoisturePct:  form.fresh_moisture_pct,
      dryMoisturePct:    form.dry_moisture_pct,
      shelfLifeH:        form.shelf_life_h,
      ph:                form.ph,
      odorLevel:         form.odor_level,
      colorState:        form.color_state,
    },

    chemicalComposition: {
      basis:          'dry_basis',
      TDF_g_per_100g: form.TDF_g_per_100g,
      TPC_mgGAE_per_g: form.TPC_mgGAE_per_g,
      pectin_g_per_100g:  form.pectin_g_per_100g,
      protein_g_per_100g: form.protein_g_per_100g,
      sugar_g_per_100g:   form.sugar_g_per_100g,
      fat_g_per_100g:     form.fat_g_per_100g,
    },

    safetyData: {
      heavyMetal: {
        Pb_ppm: form.Pb_ppm,
        Cd_ppm: form.Cd_ppm,
        As_ppm: form.As_ppm,
        Hg_ppm: form.Hg_ppm,
      },
      microbial: {
        Ecoli:      form.Ecoli,
        Salmonella: form.Salmonella,
        Listeria:   form.Listeria,
        total_aerobic_CFU_g: form.total_aerobic_CFU_g,
      },
    },

    dataSource: {
      lab:        form.lab,
      measuredAt: form.measured_at,
      evidenceGrade: 'B',
      sourceType: 'coa_internal',
    },
  }

  // 추정값 (보정 계수 계산 결과)
  if (estimate) {
    doc['rdaEstimate'] = {
      basis:              'dry_basis',
      source:             'byorbit-correction-engine',
      TDF_g_per_100g_dry: estimate.TDF_g_per_100g_dry,
      TDF_range:          [estimate.TDF_range_low, estimate.TDF_range_high],
      TPC_mgGAE_estimated: estimate.TPC_estimated_mgGAE,
      TPC_range:          [estimate.TPC_range_low, estimate.TPC_range_high],
      pectin_g_per_100g:  estimate.pectin_g_per_100g_dry,
      dryingFactor:       estimate.drying_concentration_factor,
      pomaceFraction:     estimate.pomace_fraction,
    }
  }

  // 비교 결과
  if (comparison) {
    doc['calibrationReport'] = {
      basis: 'estimate_vs_coa',
      items: Object.entries(comparison).map(([component, v]) => ({
        component,
        estimated:  v.estimated,
        actual:     v.actual,
        delta_pct:  v.delta_pct,
        status:     v.status,
      })),
    }
  }

  // R1~R5 추론 결과
  if (inference) {
    doc['inferenceResults'] = {
      byproductType: form.byproduct_type,
      rules: (['R1', 'R2', 'R3', 'R4', 'R5'] as const).map(code => ({
        code,
        name:       inference[code].name,
        pass:       inference[code].pass,
        confidence: inference[code].confidence,
        action:     inference[code].action,
        flags:      inference[code].flags,
      })),
      heavyMetalsOk: inference.heavy_metals_ok,
      microbialOk:   inference.microbial_ok,
      coaComplete:   inference.coa_complete,
    }
  }

  // 7점수
  if (sevenScores) {
    doc['marketabilityScore'] = {
      finalGrade:           sevenScores.final_grade,
      weightedTotal:        sevenScores.weighted_total,
      resourcePotential:    sevenScores.score_resource_potential,
      compositionValue:     sevenScores.score_composition_value,
      pretreatmentDifficulty: sevenScores.score_pretreatment_difficulty,
      logisticsRisk:        sevenScores.score_logistics_risk,
      marketMatch:          sevenScores.score_market_match,
      economics:            sevenScores.score_economics,
      regulatoryRisk:       sevenScores.score_regulatory_risk,
    }
  }

  // 라벨
  if (labels) {
    doc['labels'] = {
      componentTrait: labels.component_trait,
      risk:           labels.risk,
      application:    labels.application,
      evidence:       labels.evidence,
    }
  }

  return doc
}
