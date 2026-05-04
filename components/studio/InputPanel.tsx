'use client'

import { useState, useEffect } from 'react'
import type { DryingMethod } from '@/lib/analysis/drying-retention'

export type CommandArgs = Record<string, unknown>
export type CommandType = 'analyze' | 'diagnose' | 'rda'

interface SampleMeta {
  id:                string
  sample_name:       string
  byproduct_type:    string
  base_food_code:    string | null
  extraction_method: string | null
  drying_method:     string | null
  sample_source:     string | null
  evaluation_date:   string | null
}

interface ExecuteProps {
  onExecute: (command: CommandType, args: CommandArgs) => void
  isRunning: boolean
}

interface Props extends ExecuteProps {
  onLoadSample:    (id: string) => void
  onPredictDrying: (sampleId: string, method: DryingMethod, targetMoisturePct: number) => void
}

const BYPRODUCT_OPTIONS = [
  { value: 'apple_pomace',    label: '사과박' },
  { value: 'coffee_grounds',  label: '커피박' },
  { value: 'citrus_pomace',   label: '감귤박' },
  { value: 'cabbage_residue', label: '배추 부산물' },
]

// ── Analyze Form ──────────────────────────────────────────────────────────────

function AnalyzeForm({ onExecute, isRunning }: ExecuteProps) {
  const [args, setArgs] = useState<CommandArgs>({
    byproduct_type:    'apple_pomace',
    variety:           '홍로',
    region:            '안동',
    TDF_g_per_100g:    38.2,
    TPC_mgGAE_per_g:   4.7,
    dry_moisture_pct:  8,
    fresh_moisture_pct:72,
    Pb_ppm:            0.05,
    Cd_ppm:            0.02,
    Ecoli:             'ND',
    Salmonella:        'ND',
    Listeria:          'ND',
  })

  const set = (k: string, v: unknown) => setArgs(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">품목</label>
        <select className="field-input" value={args.byproduct_type as string}
          onChange={e => set('byproduct_type', e.target.value)}>
          {BYPRODUCT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="field-label">품종</label>
          <input className="field-input" value={args.variety as string}
            onChange={e => set('variety', e.target.value)} />
        </div>
        <div>
          <label className="field-label">지역</label>
          <input className="field-input" value={args.region as string}
            onChange={e => set('region', e.target.value)} />
        </div>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <p className="text-xs text-gray-400 mb-2 font-semibold">화학 조성</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label">TDF (g/100g)</label>
            <input type="number" step="0.1" className="field-input"
              value={args.TDF_g_per_100g as number}
              onChange={e => set('TDF_g_per_100g', parseFloat(e.target.value))} />
          </div>
          <div>
            <label className="field-label">TPC (mgGAE/g)</label>
            <input type="number" step="0.1" className="field-input"
              value={args.TPC_mgGAE_per_g as number}
              onChange={e => set('TPC_mgGAE_per_g', parseFloat(e.target.value))} />
          </div>
          <div>
            <label className="field-label">건조 수분 (%)</label>
            <input type="number" step="0.1" className="field-input"
              value={args.dry_moisture_pct as number}
              onChange={e => set('dry_moisture_pct', parseFloat(e.target.value))} />
          </div>
          <div>
            <label className="field-label">생 수분 (%)</label>
            <input type="number" step="0.1" className="field-input"
              value={args.fresh_moisture_pct as number}
              onChange={e => set('fresh_moisture_pct', parseFloat(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <p className="text-xs text-gray-400 mb-2 font-semibold">중금속 (ppm, 선택)</p>
        <div className="grid grid-cols-2 gap-2">
          {(['Pb_ppm', 'Cd_ppm', 'As_ppm', 'Hg_ppm'] as const).map(field => (
            <div key={field}>
              <label className="field-label">{field.replace('_ppm', '')} (ppm)</label>
              <input type="number" step="0.001" className="field-input"
                value={args[field] as number ?? ''}
                onChange={e => set(field, e.target.value ? parseFloat(e.target.value) : undefined)} />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <p className="text-xs text-gray-400 mb-2 font-semibold">미생물</p>
        <div className="grid grid-cols-3 gap-2">
          {(['Ecoli', 'Salmonella', 'Listeria'] as const).map(field => (
            <div key={field}>
              <label className="field-label">{field}</label>
              <select className="field-input" value={args[field] as string}
                onChange={e => set(field, e.target.value)}>
                <option value="ND">ND</option>
                <option value="검출">검출</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input type="checkbox" id="mock-chk" checked={args.mock === true}
          onChange={e => set('mock', e.target.checked)}
          className="rounded" />
        <label htmlFor="mock-chk" className="text-xs text-gray-300">목 데이터 사용 (--mock)</label>
      </div>

      <button
        onClick={() => onExecute('analyze', args)}
        disabled={isRunning}
        className="run-btn"
      >
        {isRunning ? '실행 중...' : '▶ 분석 실행'}
      </button>
    </div>
  )
}

// ── Diagnose Form ─────────────────────────────────────────────────────────────

function DiagnoseForm({ onExecute, isRunning }: ExecuteProps) {
  const [args, setArgs] = useState<CommandArgs>({
    byproduct_name:       '사과박',
    monthly_volume_kg:    5000,
    current_disposal_cost:50,
    moisture_level:       'medium',
    odor_issue:           false,
  })

  const set = (k: string, v: unknown) => setArgs(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">부산물 이름</label>
        <input className="field-input" value={args.byproduct_name as string}
          onChange={e => set('byproduct_name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="field-label">월 발생량 (kg)</label>
          <input type="number" className="field-input" value={args.monthly_volume_kg as number}
            onChange={e => set('monthly_volume_kg', parseFloat(e.target.value))} />
        </div>
        <div>
          <label className="field-label">처리비 (원/kg)</label>
          <input type="number" className="field-input" value={args.current_disposal_cost as number}
            onChange={e => set('current_disposal_cost', parseFloat(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="field-label">수분 상태</label>
        <select className="field-input" value={args.moisture_level as string}
          onChange={e => set('moisture_level', e.target.value)}>
          <option value="low">낮음 (≤30%)</option>
          <option value="medium">보통 (30~60%)</option>
          <option value="high">높음 (&gt;60%)</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="odor-chk" checked={args.odor_issue === true}
          onChange={e => set('odor_issue', e.target.checked)} className="rounded" />
        <label htmlFor="odor-chk" className="text-xs text-gray-300">이취 발생 있음</label>
      </div>

      <button onClick={() => onExecute('diagnose', args)} disabled={isRunning} className="run-btn">
        {isRunning ? '실행 중...' : '▶ 간이 진단 실행'}
      </button>
    </div>
  )
}

// ── RDA Form ──────────────────────────────────────────────────────────────────

const QUICK_FOODS = ['사과, 생것', '커피, 원두', '귤, 생것', '배추, 생것']

function RDAForm({ onExecute, isRunning }: ExecuteProps) {
  const [args, setArgs]         = useState<CommandArgs>({ food_name: '사과, 생것' })
  const [dbStatus, setDbStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/food-reference/check', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ names: QUICK_FOODS }),
    })
      .then(r => r.json())
      .then((data: Record<string, boolean>) => setDbStatus(data))
      .catch(() => {/* DB 미연결 시 무시 */})
  }, [])

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">식품명 (한국어)</label>
        <input className="field-input" value={args.food_name as string}
          onChange={e => setArgs({ food_name: e.target.value })} />
      </div>
      <div className="flex flex-wrap gap-1">
        {QUICK_FOODS.map(q => {
          const inDb = dbStatus[q] === true
          return (
            <button
              key={q}
              onClick={() => setArgs({ food_name: q })}
              title={inDb ? 'DB 저장됨' : 'DB 미저장'}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                inDb
                  ? 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {inDb && <span className="mr-1 opacity-70">●</span>}{q}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-600">
        <span className="text-green-600">●</span> DB 저장됨 — API 호출 없이 즉시 조회
      </p>

      <button onClick={() => onExecute('rda', args)} disabled={isRunning} className="run-btn">
        {isRunning ? '조회 중...' : '▶ RDA 조회'}
      </button>
    </div>
  )
}

// ── Byproduct List Form ───────────────────────────────────────────────────────

const BYPRODUCT_LABELS: Record<string, string> = {
  apple_pomace:    '사과박',
  coffee_grounds:  '커피박',
  citrus_pomace:   '감귤박',
  cabbage_residue: '배추 부산물',
}

function ByproductListForm({ onLoadSample }: { onLoadSample: (id: string) => void }) {
  const [samples, setSamples] = useState<SampleMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/byproduct-samples')
      .then(r => r.json())
      .then((data: SampleMeta[]) => { setSamples(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-xs text-gray-500 py-4 text-center">불러오는 중...</p>
  if (samples.length === 0) return <p className="text-xs text-gray-500 py-4 text-center">저장된 부산물 샘플 없음</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-3">DB에 저장된 부산물 샘플 — 클릭하면 분석 결과가 우측에 표시됩니다.</p>
      {samples.map(s => (
        <button
          key={s.id}
          onClick={() => onLoadSample(s.id)}
          className="w-full text-left p-3 rounded-lg border border-gray-700 bg-gray-800 hover:border-blue-500/50 hover:bg-gray-750 transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-medium text-gray-200 group-hover:text-blue-300 truncate">
                {s.sample_name}
              </p>
              <p className="text-xs text-gray-400">
                {BYPRODUCT_LABELS[s.byproduct_type] ?? s.byproduct_type}
                {s.extraction_method && s.extraction_method !== 'none' && ` · ${s.extraction_method}`}
                {s.drying_method     && s.drying_method !== 'none'     && ` · ${s.drying_method}`}
              </p>
              {s.sample_source && (
                <p className="text-xs text-gray-500">{s.sample_source}</p>
              )}
            </div>
            {s.base_food_code && (
              <span className="text-xs text-blue-400/60 shrink-0 mt-0.5">원물 연결됨</span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Drying Predict Form ───────────────────────────────────────────────────────

const DRYING_METHODS: DryingMethod[] = ['열풍건조', '히트펌프건조', '동결건조']

const METHOD_COLOR: Record<DryingMethod, string> = {
  '열풍건조':    'border-orange-500/50 bg-orange-500/10 text-orange-400',
  '히트펌프건조': 'border-blue-500/50 bg-blue-500/10 text-blue-400',
  '동결건조':    'border-violet-500/50 bg-violet-500/10 text-violet-400',
}
const METHOD_IDLE = 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-gray-200'

function DryPredictForm({
  onPredictDrying,
  isRunning,
}: {
  onPredictDrying: (sampleId: string, method: DryingMethod, targetMoisturePct: number) => void
  isRunning: boolean
}) {
  const [samples, setSamples]   = useState<SampleMeta[]>([])
  const [loading, setLoading]   = useState(true)
  const [sampleId, setSampleId] = useState('')
  const [method, setMethod]     = useState<DryingMethod>('열풍건조')
  const [moisture, setMoisture] = useState(8)

  useEffect(() => {
    fetch('/api/byproduct-samples')
      .then(r => r.json())
      .then((data: SampleMeta[]) => {
        setSamples(data)
        if (data.length > 0) setSampleId(data[0].id)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-xs text-gray-500 py-4 text-center">샘플 불러오는 중...</p>
  if (samples.length === 0) return <p className="text-xs text-gray-500 py-4 text-center">등록된 부산물 샘플 없음</p>

  return (
    <div className="space-y-4">
      <div>
        <label className="field-label">기준 샘플 (착즙박)</label>
        <select
          className="field-input"
          value={sampleId}
          onChange={e => setSampleId(e.target.value)}
        >
          {samples.map(s => (
            <option key={s.id} value={s.id}>{s.sample_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">건조 방식</label>
        <div className="flex flex-col gap-1.5 mt-1">
          {DRYING_METHODS.map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`text-xs px-3 py-2 rounded border transition-colors text-left ${
                method === m ? METHOD_COLOR[m] : METHOD_IDLE
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label">목표 수분 (%)</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={3} max={15} step={0.5}
            value={moisture}
            onChange={e => setMoisture(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-mono text-gray-300 w-10 text-right">{moisture}%</span>
        </div>
        <p className="text-[10px] text-gray-500 mt-1">일반 건조: 8–10% / 분말: 3–5%</p>
      </div>

      <button
        onClick={() => onPredictDrying(sampleId, method, moisture)}
        disabled={isRunning || !sampleId}
        className="run-btn"
      >
        {isRunning ? '예측 중...' : '▶ 건조 예측 실행'}
      </button>
    </div>
  )
}

// ── Main InputPanel ───────────────────────────────────────────────────────────

type TabId = CommandType | 'byproduct' | 'dry_predict'

const NAV_GROUPS: Array<{ label: string; items: Array<{ id: TabId; label: string }> }> = [
  { label: '분석', items: [{ id: 'analyze', label: '정밀 분석' }, { id: 'diagnose', label: '간이 진단' }] },
  { label: '조회', items: [{ id: 'rda', label: 'RDA' }, { id: 'byproduct', label: '부산물 DB' }] },
  { label: '예측', items: [{ id: 'dry_predict', label: '건조 시뮬' }] },
]

const ACTIVE_COLOR: Partial<Record<TabId, string>> = {
  analyze:     'bg-blue-500/15 text-blue-400 border-blue-500/30',
  diagnose:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  rda:         'bg-green-500/15 text-green-400 border-green-500/30',
  byproduct:   'bg-green-500/15 text-green-400 border-green-500/30',
  dry_predict: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
}

export default function InputPanel({ onExecute, onLoadSample, onPredictDrying, isRunning }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('analyze')

  const activeLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label ?? ''

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-800 shrink-0">
        <div className="flex items-baseline justify-between">
          <h1 className="text-sm font-semibold text-gray-200">ByOrbit Agent</h1>
          <span className="text-[10px] text-gray-500">농산 부산물</span>
        </div>

        {/* Grouped navigation */}
        <div className="mt-2.5 space-y-1.5">
          {NAV_GROUPS.map(({ label, items }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold w-7 shrink-0">
                {label}
              </span>
              <div className="flex gap-1">
                {items.map(({ id, label: itemLabel }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors whitespace-nowrap ${
                      activeTab === id
                        ? (ACTIVE_COLOR[id] ?? 'bg-blue-500/15 text-blue-400 border-blue-500/30')
                        : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {itemLabel}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form area */}
      <div className="px-3 py-2 border-b border-gray-800/50 shrink-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{activeLabel}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'analyze'     && <AnalyzeForm      onExecute={onExecute} isRunning={isRunning} />}
        {activeTab === 'diagnose'    && <DiagnoseForm     onExecute={onExecute} isRunning={isRunning} />}
        {activeTab === 'rda'         && <RDAForm          onExecute={onExecute} isRunning={isRunning} />}
        {activeTab === 'byproduct'   && <ByproductListForm onLoadSample={onLoadSample} />}
        {activeTab === 'dry_predict' && <DryPredictForm   onPredictDrying={onPredictDrying} isRunning={isRunning} />}
      </div>
    </div>
  )
}
