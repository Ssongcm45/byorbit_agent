'use client'

import { useState, useEffect } from 'react'
import type { InferenceOutput, SevenScores, LabelSet } from '@/lib/inference/types'
import RDAAnalysis from './RDAAnalysis'
import ByproductSampleView, { type ByproductSampleDetail } from './ByproductSampleView'
import DryingPredictView, { type DryPredictData } from './DryingPredictView'

interface AnalyzeResult {
  batch_id:    string
  seven_scores: SevenScores
  inference:   InferenceOutput
  labels:      LabelSet
  jsonld:      Record<string, unknown>
}

interface DiagnoseResult {
  byproduct_name: string
  grade:          string
  total_score:    number
  economics:      { monthly_net_revenue: number; annual_value: number; breakeven_volume_kg: number }
  recommendations: string[]
}

interface RDAResult {
  total: number
  items: Array<{
    food_name?:      string | null
    food_code?:      string | null
    source?:         string
    basis?:          string
    dietary_fiber_g?: number | null
    protein_g?:      number | null
    calcium_mg?:     number | null
    potassium_mg?:   number | null
    vitamin_c_mg?:   number | null
    moisture_g?:     number | null
    nutrients?:      Record<string, number | null>
    nutrient_units?: Record<string, string>
  }>
}

export type ResultData =
  | { kind: 'analyze';          data: AnalyzeResult }
  | { kind: 'diagnose';         data: DiagnoseResult }
  | { kind: 'rda';              data: RDAResult }
  | { kind: 'byproduct_sample'; data: ByproductSampleDetail }
  | { kind: 'dry_predict';      data: DryPredictData }
  | null

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-400 border-green-500/40 bg-green-500/10',
  B: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  C: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  D: 'text-red-400 border-red-500/40 bg-red-500/10',
}

function GradeCard({ grade, score }: { grade: string; score: number }) {
  return (
    <div className={`border rounded-lg p-4 text-center ${GRADE_COLORS[grade] ?? ''}`}>
      <div className="text-5xl font-bold">{grade}</div>
      <div className="text-sm mt-1 opacity-70">{score.toFixed(1)}점</div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-300">{pct.toFixed(0)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function RuleChip({ code, pass, name }: { code: string; pass: boolean; name: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border ${
      pass ? 'text-green-400 border-green-500/30 bg-green-500/5' : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5'
    }`}>
      <span className="font-mono font-bold">{code}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${pass ? 'bg-green-400' : 'bg-yellow-400'}`} />
      <span className="truncate max-w-28">{name}</span>
    </div>
  )
}

function AnalyzeView({ data }: { data: AnalyzeResult }) {
  const [showJsonld, setShowJsonld] = useState(false)
  const { seven_scores, inference, labels } = data

  const scoreEntries: Array<[string, string]> = [
    ['score_resource_potential',      '원료화 가능성'],
    ['score_composition_value',       '성분 가치'],
    ['score_pretreatment_difficulty', '전처리 난이도'],
    ['score_logistics_risk',          '물류 위험'],
    ['score_market_match',            '수요처 매칭'],
    ['score_economics',               '경제성'],
    ['score_regulatory_risk',         '규제 리스크'],
  ]

  return (
    <div className="space-y-4">
      <GradeCard grade={seven_scores.final_grade} score={seven_scores.weighted_total} />

      <div className="space-y-2.5">
        {scoreEntries.map(([key, label]) => (
          <ScoreBar key={key} label={label}
            value={(seven_scores as unknown as Record<string, number>)[key] ?? 0} />
        ))}
      </div>

      <div>
        <p className="text-sm text-gray-400 mb-2 font-semibold">추론 규칙</p>
        <div className="flex flex-wrap gap-1.5">
          {(['R1','R2','R3','R4','R5'] as const).map(code => (
            <RuleChip key={code} code={code} pass={inference[code].pass} name={inference[code].name} />
          ))}
        </div>
      </div>

      {labels.component_trait.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2 font-semibold">컴포넌트 라벨</p>
          <div className="flex flex-wrap gap-1">
            {labels.component_trait.map(l => (
              <span key={l} className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{l}</span>
            ))}
          </div>
        </div>
      )}

      {labels.risk.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2 font-semibold">위험 라벨</p>
          <div className="flex flex-wrap gap-1">
            {labels.risk.map(l => (
              <span key={l} className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{l}</span>
            ))}
          </div>
        </div>
      )}

      {labels.application.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2 font-semibold">추천 활용처</p>
          <div className="flex flex-wrap gap-1">
            {labels.application.map(l => (
              <span key={l} className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">{l}</span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowJsonld(v => !v)}
        className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        {showJsonld ? '▲ JSON-LD 숨기기' : '▼ JSON-LD 보기'}
      </button>
      {showJsonld && (
        <pre className="text-xs bg-gray-950 p-3 rounded border border-gray-800 overflow-auto max-h-48 text-gray-300">
          {JSON.stringify(data.jsonld, null, 2)}
        </pre>
      )}
    </div>
  )
}

function DiagnoseView({ data }: { data: DiagnoseResult }) {
  return (
    <div className="space-y-4">
      <GradeCard grade={data.grade} score={data.total_score} />
      <div className="space-y-2 text-sm">
        <div className="flex justify-between p-3 bg-gray-800 rounded">
          <span className="text-gray-300">월 순수익 예상</span>
          <span className="text-green-400">{data.economics.monthly_net_revenue.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between p-3 bg-gray-800 rounded">
          <span className="text-gray-300">연간 가치 가능성</span>
          <span className="text-green-400">{(data.economics.annual_value / 10000).toFixed(0)}만원</span>
        </div>
        <div className="flex justify-between p-3 bg-gray-800 rounded">
          <span className="text-gray-300">손익분기 물량</span>
          <span className="text-gray-300">{data.economics.breakeven_volume_kg.toLocaleString()}kg/월</span>
        </div>
      </div>
      <div>
        <p className="text-sm text-gray-400 mb-2 font-semibold">추천 활용 경로</p>
        <ul className="space-y-1.5">
          {data.recommendations.map((r, i) => (
            <li key={i} className="text-sm text-gray-300 flex gap-2">
              <span className="text-green-500 shrink-0">•</span>{r}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-gray-500 italic">※ 간이 진단 결과. 정밀 분석(CoA)으로 확정 권장.</p>
    </div>
  )
}

function sortedNutrients(nutrients: Record<string, number | null>): [string, number | null][] {
  const priority = ['에너지', 'Energy']
  const all = Object.entries(nutrients).filter(([, v]) => v !== null)
  return [...all.filter(([k]) => priority.includes(k)), ...all.filter(([k]) => !priority.includes(k))]
}

type SaveState = 'checking' | 'idle' | 'saving' | 'saved' | 'error'

function SaveButton({ item }: { item: RDAResult['items'][number] }) {
  const [state, setState] = useState<SaveState>('checking')
  const isReal = item.source && item.source !== 'mock_nics'

  useEffect(() => {
    if (!isReal) return
    const name = item.food_name ?? ''
    if (!name) { setState('idle'); return }

    fetch('/api/food-reference/check', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ names: [name] }),
    })
      .then(r => r.json())
      .then((data: Record<string, boolean>) => {
        setState(data[name] ? 'saved' : 'idle')
      })
      .catch(() => setState('idle'))
  }, [item.food_name, isReal])

  if (!isReal) return null

  const handleSave = async () => {
    if (state !== 'idle' && state !== 'error') return
    setState('saving')
    try {
      const res = await fetch('/api/food-reference/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          food_code:      item.food_code ?? null,
          food_name:      item.food_name ?? '',
          source:         item.source ?? 'nics_v2',
          basis:          item.basis ?? 'per_100g',
          nutrients:      item.nutrients ?? {},
          nutrient_units: item.nutrient_units ?? {},
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      setState(json.ok ? 'saved' : 'error')
      if (!json.ok) console.error('[save]', json.error)
    } catch (err) {
      console.error('[save]', err)
      setState('error')
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={state === 'saving' || state === 'saved' || state === 'checking'}
      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
        state === 'saved'     ? 'text-green-400 border-green-500/40 bg-green-500/10 cursor-default' :
        state === 'error'     ? 'text-red-400 border-red-500/40 bg-red-500/10' :
        state === 'saving'    ? 'text-gray-400 border-gray-700 cursor-wait' :
        state === 'checking'  ? 'text-gray-500 border-gray-800 cursor-wait' :
        'text-blue-400 border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20'
      }`}
    >
      {state === 'saved'    ? '✓ 저장되었음' :
       state === 'error'    ? '저장 실패' :
       state === 'saving'   ? '저장 중...' :
       state === 'checking' ? '...' :
       '↓ DB에 저장'}
    </button>
  )
}

function RDAView({ data }: { data: RDAResult }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">총 {data.total}건 (상위 {data.items.length}건)</p>
      {data.items.map((item, i) => {
        const hasNutrients = item.nutrients && Object.keys(item.nutrients).length > 0
        const rows = hasNutrients
          ? sortedNutrients(item.nutrients!)
          : ([
              ['식이섬유', item.dietary_fiber_g],
              ['단백질',   item.protein_g],
              ['수분',     item.moisture_g],
              ['칼슘',     item.calcium_mg],
              ['칼륨',     item.potassium_mg],
              ['비타민 C', item.vitamin_c_mg],
            ] as [string, number | null][])
        const isExpanded = expandedIdx === i

        return (
          <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {/* 헤더 */}
            <div className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-100 text-base leading-snug">{item.food_name ?? '—'}</p>
                <SaveButton item={item} />
              </div>
              <p className="text-xs text-gray-400 font-mono">{item.food_code ?? '—'}</p>
              <p className="text-xs text-gray-500">{item.basis ?? 'per 100g'}{item.source ? ` · ${item.source}` : ''}</p>
            </div>

            {/* 분석 섹션 */}
            {hasNutrients && (
              <div className="px-4 pb-4">
                <RDAAnalysis
                  nutrients={item.nutrients!}
                  nutrientUnits={item.nutrient_units ?? {}}
                />
              </div>
            )}

            {/* 전체 성분 목록 (접기/펼치기) */}
            <div className="border-t border-gray-700/50">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                <span>전체 성분 {rows.length}개</span>
                <span>{isExpanded ? '▲ 접기' : '▼ 펼치기'}</span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 divide-y divide-gray-700/40">
                  {rows.map(([name, val]) => {
                    const unit = item.nutrient_units?.[name as string] ?? ''
                    return (
                      <div key={name as string} className="flex justify-between items-baseline py-1.5 first:pt-0">
                        <span className="text-sm text-gray-300">{name as string}</span>
                        <span className="text-sm text-gray-200 font-mono tabular-nums">
                          {val !== null && val !== undefined ? `${val}${unit ? ' ' + unit : ''}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ResultPanel({ result }: { result: ResultData }) {
  if (!result) {
    return (
      <div className="h-full flex flex-col bg-gray-900">
        <div className="px-4 py-3 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-300">결과</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm text-center">분석을 실행하면<br />결과가 여기 표시됩니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-sm font-semibold text-gray-200">
          {result.kind === 'analyze'          ? '정밀 분석 결과'
            : result.kind === 'diagnose'      ? '간이 진단 결과'
            : result.kind === 'rda'           ? 'RDA 조회 결과'
            : result.kind === 'dry_predict'   ? '건조 예측 결과'
            : '부산물 샘플 분석'}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {result.kind === 'analyze'          && <AnalyzeView         data={result.data} />}
        {result.kind === 'diagnose'         && <DiagnoseView        data={result.data} />}
        {result.kind === 'rda'              && <RDAView             data={result.data} />}
        {result.kind === 'byproduct_sample' && <ByproductSampleView data={result.data} />}
        {result.kind === 'dry_predict'      && <DryingPredictView   data={result.data} />}
      </div>
    </div>
  )
}
