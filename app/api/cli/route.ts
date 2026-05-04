import { computeInference, loadByproductRules } from '@/lib/inference/rules'
import { computeSevenScores, loadScoringWeights } from '@/lib/inference/scoring'
import { autoLabel } from '@/lib/labeling/auto-label'
import { buildJSONLD } from '@/lib/pipeline/ontology'
import { getCorrectionFactors, estimate } from '@/lib/pipeline/correction'
import { searchRDAFood, MOCK_APPLE_DATA, BYPRODUCT_RAW_MATERIAL_TERMS } from '@/lib/pipeline/rda-client'
import { calculateEconomics } from '@/lib/economics/calculator'
import type { ByproductRules, ScoringWeights, ExtendedCoAData } from '@/lib/inference/types'
import type { DiagnosisInput } from '@/lib/coa/schema'
import byproductRulesData from '@/config/byproduct-rules.json'
import scoringWeightsData from '@/config/scoring-weights.json'

type EmitFn = (event: Record<string, unknown>) => void

// ── Analyze ──────────────────────────────────────────────────────────────────

const MOCK_FORM: ExtendedCoAData = {
  batch_id:            'hongro-2024-09-batch01',
  byproduct_type:      'apple_pomace',
  variety:             'Hongro',
  region:              'Andong',
  harvest_season:      '2024-09',
  drying_method:       'hot_air',
  fresh_moisture_pct:  72,
  dry_moisture_pct:    8,
  shelf_life_h:        48,
  TDF_g_per_100g:      38.2,
  TPC_mgGAE_per_g:     4.7,
  pectin_g_per_100g:   6.5,
  protein_g_per_100g:  4.1,
  sugar_g_per_100g:    9.3,
  Pb_ppm:              0.05,
  Cd_ppm:              0.02,
  As_ppm:              0.08,
  Hg_ppm:              0.005,
  Ecoli:               'ND',
  Salmonella:          'ND',
  Listeria:            'ND',
}

async function runAnalyze(args: Record<string, unknown>, emit: EmitFn) {
  const useMock = args.mock === true

  type ByproductType = 'apple_pomace' | 'coffee_grounds' | 'citrus_pomace' | 'cabbage_residue' | 'other'
  type DryingMethod  = 'none' | 'hot_air' | 'freeze_dry' | 'sun_dry' | 'spray_dry'
  type Detection     = 'ND' | 'DETECTED'

  const formData: ExtendedCoAData = useMock ? { ...MOCK_FORM } : {
    batch_id:           `batch-${Date.now()}`,
    byproduct_type:     ((args.byproduct_type as string) ?? 'apple_pomace') as ByproductType,
    variety:            (args.variety as string) ?? '홍로',
    region:             (args.region as string) ?? '안동',
    harvest_season:     (args.harvest_season as string) ?? new Date().toISOString().slice(0, 7),
    drying_method:      ((args.drying_method as string) ?? 'hot_air') as DryingMethod,
    fresh_moisture_pct: Number(args.fresh_moisture_pct ?? 70),
    dry_moisture_pct:   Number(args.dry_moisture_pct ?? 10),
    shelf_life_h:       Number(args.shelf_life_h ?? 48),
    TDF_g_per_100g:     Number(args.TDF_g_per_100g ?? 30),
    TPC_mgGAE_per_g:    Number(args.TPC_mgGAE_per_g ?? 3),
    pectin_g_per_100g:  args.pectin_g_per_100g !== undefined ? Number(args.pectin_g_per_100g) : undefined,
    protein_g_per_100g: args.protein_g_per_100g !== undefined ? Number(args.protein_g_per_100g) : undefined,
    sugar_g_per_100g:   args.sugar_g_per_100g !== undefined ? Number(args.sugar_g_per_100g) : undefined,
    Pb_ppm:             args.Pb_ppm !== undefined ? Number(args.Pb_ppm) : undefined,
    Cd_ppm:             args.Cd_ppm !== undefined ? Number(args.Cd_ppm) : undefined,
    As_ppm:             args.As_ppm !== undefined ? Number(args.As_ppm) : undefined,
    Hg_ppm:             args.Hg_ppm !== undefined ? Number(args.Hg_ppm) : undefined,
    Ecoli:              ((args.Ecoli as string) ?? 'ND') as Detection,
    Salmonella:         ((args.Salmonella as string) ?? 'ND') as Detection,
    Listeria:           ((args.Listeria as string) ?? 'ND') as Detection,
    odor_level:         args.odor_level as 'none' | 'mild' | 'strong' | undefined,
  }

  // CLI 커맨드 미리보기
  emit({ type: 'cmd', text: `byorbit analyze --byproduct ${formData.byproduct_type} --variety "${formData.variety}" --TDF ${formData.TDF_g_per_100g} --TPC ${formData.TPC_mgGAE_per_g} --moisture ${formData.dry_moisture_pct}${useMock ? ' --mock' : ''}` })
  emit({ type: 'info', text: `배치 ID: ${formData.batch_id}` })

  // RDA 원물 데이터 조회
  emit({ type: 'info', text: 'RDA 원물 데이터 조회 중...' })
  let rdaData = MOCK_APPLE_DATA
  if (!useMock) {
    const rdaResult = await searchRDAFood(
      (BYPRODUCT_RAW_MATERIAL_TERMS[formData.byproduct_type] ?? ['사과, 생것'])[0], 1, 3
    )
    rdaData = rdaResult.items[0] ?? MOCK_APPLE_DATA
    if (rdaResult.status === 'mock') {
      emit({ type: 'warning', text: rdaResult.message ?? 'RDA API 미연결 — 목 데이터 사용' })
    } else {
      emit({ type: 'success', text: `RDA 원물 데이터 로드: ${rdaData.food_name} (TDF ${rdaData.dietary_fiber_g}g)` })
    }
  } else {
    emit({ type: 'info', text: `목 데이터 사용: ${rdaData.food_name}` })
  }

  // 보정 계수 추정
  const factors = getCorrectionFactors(formData.byproduct_type)
  const rdaEstimate = estimate(rdaData, factors, formData.byproduct_type, { variety: formData.variety })
  const tdfRet = factors.component_retention?.['TDF']?.mean ?? 1.0
  const tpcRet = factors.component_retention?.['TPC']?.mean ?? 1.0
  emit({ type: 'info', text: `보정 계수 적용: TDF×${tdfRet.toFixed(2)}, TPC×${tpcRet.toFixed(2)}` })

  // R1~R5 추론
  emit({ type: 'info', text: 'R1~R5 추론 규칙 실행 중...' })
  const rules = loadByproductRules(byproductRulesData as unknown as Record<string, ByproductRules>, formData.byproduct_type)
  const inference = computeInference(formData, rules)

  for (const code of ['R1', 'R2', 'R3', 'R4', 'R5'] as const) {
    const r = inference[code]
    const icon = r.pass ? 'success' : 'warning'
    emit({ type: icon, text: `${code} ${r.name}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.action}` })
    if (r.flags.length > 0) {
      for (const f of r.flags) {
        emit({ type: 'warning', text: `  ⚑ ${f.field}: ${f.message}` })
      }
    }
  }

  // 7점수 계산
  emit({ type: 'info', text: '7점수 시스템 계산 중...' })
  const formMap = formData as unknown as Record<string, unknown>
  const diagInput: DiagnosisInput = {
    byproduct_name:          formData.variety,
    region:                  formData.region,
    monthly_volume_kg:       formMap.monthly_volume_kg as number ?? 5000,
    current_disposal_method: '매립/퇴비화',
    moisture_level:          formData.fresh_moisture_pct > 60 ? 'high' : formData.fresh_moisture_pct > 40 ? 'medium' : 'low',
    odor_issue:              formData.odor_level === 'strong',
  }
  const weights = loadScoringWeights(scoringWeightsData as unknown as Record<string, ScoringWeights>, formData.byproduct_type)
  const seven_scores = computeSevenScores(inference, diagInput, weights)

  const gradeColors: Record<string, string> = { A: '🟢', B: '🔵', C: '🟡', D: '🔴' }
  emit({ type: 'result', text: `최종 등급: ${gradeColors[seven_scores.final_grade] ?? ''} ${seven_scores.final_grade}등급 (${seven_scores.weighted_total.toFixed(1)}점)` })

  const scoreNames: Record<string, string> = {
    score_resource_potential:      '원료화 가능성',
    score_composition_value:       '성분 가치',
    score_pretreatment_difficulty: '전처리 난이도',
    score_logistics_risk:          '물류 위험',
    score_market_match:            '수요처 매칭',
    score_economics:               '경제성',
    score_regulatory_risk:         '규제 리스크',
  }
  const scoresMap = seven_scores as unknown as Record<string, number>
  for (const [key, label] of Object.entries(scoreNames)) {
    const val = scoresMap[key] ?? 0
    const bar = '█'.repeat(Math.round(val / 10)) + '░'.repeat(10 - Math.round(val / 10))
    emit({ type: 'info', text: `  ${label.padEnd(12)} ${bar} ${val.toFixed(0)}점` })
  }

  // 자동 라벨
  const labels = autoLabel(formData)
  emit({ type: 'info', text: `컴포넌트 라벨: ${labels.component_trait.join(', ') || '(없음)'}` })
  if (labels.risk.length > 0) {
    emit({ type: 'warning', text: `위험 라벨: ${labels.risk.join(', ')}` })
  }

  // JSON-LD 생성
  const jsonld = buildJSONLD({ form: formData, estimate: rdaEstimate, inference, sevenScores: seven_scores, labels })

  emit({ type: 'result', text: `JSON-LD 온톨로지 생성 완료 (${Object.keys(jsonld).length}개 필드)` })

  // 결과 데이터 전송
  emit({
    type: 'result_data',
    data: {
      batch_id:    formData.batch_id,
      coa:         formData,
      inference,
      seven_scores,
      labels,
      rda_estimate: rdaEstimate,
      jsonld,
      created_at:  new Date().toISOString(),
    },
  })
}

// ── Diagnose ─────────────────────────────────────────────────────────────────

async function runDiagnose(args: Record<string, unknown>, emit: EmitFn) {
  const byproductName = (args.byproduct_name as string) ?? '사과박'
  const volume        = Number(args.monthly_volume_kg ?? 5000)
  const cost          = Number(args.current_disposal_cost ?? 50)
  const moisture      = (args.moisture_level as 'low' | 'medium' | 'high') ?? 'medium'
  const odor          = args.odor_issue === true || args.odor_issue === 'true'

  emit({ type: 'cmd', text: `byorbit diagnose --byproduct "${byproductName}" --volume ${volume} --cost ${cost} --moisture ${moisture}${odor ? ' --odor' : ''}` })
  emit({ type: 'info', text: `부산물: ${byproductName} | 월 발생량: ${volume.toLocaleString()}kg | 현 처리비: ${cost}원/kg` })
  emit({ type: 'info', text: `수분: ${moisture} | 이취: ${odor ? '있음' : '없음'}` })

  // 간이 7점수 (Journey B)
  emit({ type: 'info', text: '간이 추론 실행 중...' })

  const moistureScore = moisture === 'low' ? 80 : moisture === 'medium' ? 60 : 30
  const odorScore     = odor ? 40 : 80
  const volScore      = volume >= 10000 ? 90 : volume >= 5000 ? 70 : volume >= 1000 ? 50 : 30
  const costSave      = cost * volume

  emit({ type: 'info', text: `수분 점수: ${moistureScore}점` })
  emit({ type: 'info', text: `이취 점수: ${odorScore}점` })
  emit({ type: 'info', text: `물량 점수: ${volScore}점` })

  const totalScore = Math.round((moistureScore * 0.3 + odorScore * 0.2 + volScore * 0.5))
  const grade = totalScore >= 85 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 50 ? 'C' : 'D'
  const gradeColors: Record<string, string> = { A: '🟢', B: '🔵', C: '🟡', D: '🔴' }

  emit({ type: 'result', text: `간이 등급: ${gradeColors[grade]} ${grade}등급 (${totalScore}점)` })
  emit({ type: 'info',   text: '※ 이 결과는 간이 진단 결과이며, 실제 활용 가능성은 CoA 정밀분석 후 확정됩니다.' })

  // 경제성
  emit({ type: 'info', text: '경제성 계산 중...' })
  const economics = calculateEconomics({
    monthly_volume_kg:      volume,
    current_disposal_cost:  cost,
    drying_cost_per_kg:     80,
    transport_cost_per_kg:  30,
    expected_sell_price:    300,
    moisture_reduction_pct: 30,
  })

  emit({ type: 'success', text: `월 폐기비 절감 가능성: ${economics.monthly_disposal_saving.toLocaleString()}원` })
  emit({ type: 'success', text: `월 순수익 예상: ${economics.monthly_net_revenue.toLocaleString()}원` })
  emit({ type: 'info',    text: `손익분기 물량: ${economics.breakeven_volume_kg.toLocaleString()}kg/월` })
  emit({ type: 'result',  text: `연간 가치 가능성: ${(economics.annual_value / 10000).toFixed(0)}만원` })

  // 추천
  const recommendations = grade === 'A' || grade === 'B'
    ? ['식이섬유 식품소재화 가능성 ⭐', '기능성 성분 추출 원료 가능성', 'OEM 공급 검토 가능성']
    : ['건조 처리 후 재검토 권장', '퇴비화 또는 바이오가스 전환 검토', '소량 시험 제조 후 평가 권장']

  emit({ type: 'info', text: '추천 활용 경로:' })
  for (const rec of recommendations) {
    emit({ type: 'success', text: `  • ${rec}` })
  }

  emit({
    type: 'result_data',
    data: { byproduct_name: byproductName, grade, total_score: totalScore, economics, recommendations },
  })
}

// ── RDA Search ───────────────────────────────────────────────────────────────

async function runRDA(args: Record<string, unknown>, emit: EmitFn) {
  const foodName = (args.food_name as string) ?? '사과, 생것'

  emit({ type: 'cmd', text: `byorbit rda fetch --food "${foodName}"` })
  emit({ type: 'info', text: `농진청 국가표준식품성분 DB 조회: "${foodName}"` })

  const result = await searchRDAFood(foodName, 1, 5)

  if (result.status === 'not_found') {
    emit({ type: 'warning', text: result.message ?? `"${foodName}" 검색 결과 없음` })
    if (result.suggestions && result.suggestions.length > 0) {
      emit({ type: 'info', text: '연관 검색어:' })
      for (const s of result.suggestions) {
        emit({ type: 'info', text: `  • ${s}` })
      }
    }
    emit({ type: 'result_data', data: { total: 0, items: [], suggestions: result.suggestions } })
    return
  }

  if (result.status === 'mock') {
    emit({ type: 'warning', text: result.message ?? 'API 미연결 — 목 데이터 사용' })
  } else {
    const src = result.message?.startsWith('DB') ? 'NICS DB' : 'NICS API'
    emit({ type: 'success', text: `${src} ${result.total}건 검색됨` })
  }

  // 핵심 성분만 터미널 출력 (전체 데이터는 result_data로 전달)
  const KEY_NUTRIENTS = ['에너지', '수분', '단백질', '지방', '탄수화물', '당류', '총 식이섬유', '칼슘', '철', '칼륨', '나트륨', '비타민 C']

  for (const item of result.items) {
    emit({ type: 'result', text: `📦 ${item.food_name ?? '—'} (${item.food_code ?? '코드 미확인'})` })

    if (item.nutrients && Object.keys(item.nutrients).length > 0) {
      const units   = item.nutrient_units ?? {}
      const n       = item.nutrients as Record<string, number | null>
      const keyPairs = KEY_NUTRIENTS
        .filter(k => n[k] != null)
        .map(k => `${k}: ${n[k]}${units[k] ? ' ' + units[k] : ''}`)
      // 2개씩 한 줄로 출력
      for (let i = 0; i < keyPairs.length; i += 4) {
        emit({ type: 'info', text: '   ' + keyPairs.slice(i, i + 4).join('  |  ') })
      }
    } else {
      emit({ type: 'info', text: `   TDF: ${item.dietary_fiber_g ?? '—'}g | 단백질: ${item.protein_g ?? '—'}g | 수분: ${item.moisture_g ?? '—'}g` })
      emit({ type: 'info', text: `   칼슘: ${item.calcium_mg ?? '—'}mg | 칼륨: ${item.potassium_mg ?? '—'}mg | 비타민C: ${item.vitamin_c_mg ?? '—'}mg` })
    }
  }

  emit({ type: 'result_data', data: { total: result.total, items: result.items } })
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json() as { command: string; args: Record<string, unknown> }
  const { command, args } = body

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const emit: EmitFn = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        if (command === 'analyze')  await runAnalyze(args, emit)
        else if (command === 'diagnose') await runDiagnose(args, emit)
        else if (command === 'rda')      await runRDA(args, emit)
        else emit({ type: 'error', text: `알 수 없는 커맨드: ${command}` })
      } catch (err) {
        emit({ type: 'error', text: `실행 오류: ${String(err)}` })
      } finally {
        emit({ type: 'done', text: '' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
