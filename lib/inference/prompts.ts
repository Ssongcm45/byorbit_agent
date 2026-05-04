import type { InferenceOutput } from './types'
import type { CoAFormData } from '@/lib/coa/schema'

export const SYSTEM_PROMPT = `당신은 농산 부산물 원료화 전문 분석가입니다.
성분분석서(CoA) 데이터와 R1~R5 추론 결과를 바탕으로 전문적인 원료화 가능성 리포트를 작성합니다.

작성 원칙:
- "판매 가능합니다" 같은 확정 언어 금지 → "가능성이 있습니다", "검토가 필요합니다" 사용
- 수치를 구체적으로 인용 (예: TDF 38.2 g/100g)
- 한계점과 다음 액션을 반드시 포함
- 한국어로 작성, 전문적이되 이해하기 쉽게`

export function buildAnalysisPrompt(
  form: CoAFormData,
  inference: InferenceOutput,
): string {
  const r1to5Summary = (['R1', 'R2', 'R3', 'R4', 'R5'] as const)
    .map((code) => {
      const r = inference[code]
      return `${code} (${r.name}): ${r.pass ? '✅ PASS' : '❌ FAIL'} — ${r.action}`
    })
    .join('\n')

  return `다음 CoA 데이터를 분석하고 원료화 가능성 리포트를 작성해주세요.

## 배치 정보
- 품목: ${form.byproduct_type} / ${form.variety} (${form.region})
- 수확 시기: ${form.harvest_season}
- 건조 방식: ${form.drying_method}

## 주요 성분 (건조 기준)
- 식이섬유(TDF): ${form.TDF_g_per_100g} g/100g
- 총폴리페놀(TPC): ${form.TPC_mgGAE_per_g} mgGAE/g
${form.pectin_g_per_100g != null ? `- 펙틴: ${form.pectin_g_per_100g} g/100g` : ''}
- 건조 수분: ${form.dry_moisture_pct}%

## 중금속 / 미생물
- Pb: ${form.Pb_ppm ?? '미측정'} ppm | Cd: ${form.Cd_ppm ?? '미측정'} | As: ${form.As_ppm ?? '미측정'} | Hg: ${form.Hg_ppm ?? '미측정'}
- 대장균: ${form.Ecoli} | 살모넬라: ${form.Salmonella} | 리스테리아: ${form.Listeria}
- 중금속 적합: ${inference.heavy_metals_ok ? '✅' : '❌'} | 미생물 적합: ${inference.microbial_ok ? '✅' : '❌'}

## 추론 결과 (R1~R5)
${r1to5Summary}

위 정보를 바탕으로 다음 순서로 리포트를 작성해주세요:
1. 원료화 가능성 요약 (2~3문장)
2. R1~R5 규칙별 해석 및 의미
3. 핵심 강점 / 한계점
4. 다음 필요 액션 (3가지 이내)`
}
