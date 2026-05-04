'use client'

import { useState } from 'react'
import type { DryingMethod, DryingPrediction, PredictedNutrient } from '@/lib/analysis/drying-retention'
import { METHOD_META } from '@/lib/analysis/drying-retention'
import type { ByproductSampleDetail } from './ByproductSampleView'

// ── 색상 ─────────────────────────────────────────────────────────────────────
function retentionColor(r: number): string {
  if (r >= 0.95) return '#4ade80'
  if (r >= 0.85) return '#60a5fa'
  if (r >= 0.70) return '#facc15'
  if (r >= 0.50) return '#fb923c'
  return '#f87171'
}

function retentionLabel(r: number): string {
  if (r >= 0.95) return '안정'
  if (r >= 0.85) return '양호'
  if (r >= 0.70) return '보통'
  if (r >= 0.50) return '손실'
  return '고손실'
}

// ── 수치 포맷 ─────────────────────────────────────────────────────────────────
function fmt(v: number | null, unit = ''): string {
  if (v === null) return '—'
  const s = v >= 100 ? v.toFixed(0)
    : v >= 10  ? v.toFixed(1)
    : v >= 1   ? v.toFixed(2)
    : v >= 0.01 ? v.toFixed(3)
    : v.toFixed(4)
  return unit ? `${s} ${unit}` : s
}

// ── 바 한 행 ─────────────────────────────────────────────────────────────────
function RetentionBar({
  name, nutrient, unit, actualVal,
}: {
  name:      string
  nutrient:  PredictedNutrient
  unit:      string
  actualVal?: number | null | undefined
}) {
  const { mean, low, high, retention } = nutrient

  if (mean === null) return null

  // 수분은 별도 처리
  if (name === '수분') {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-[11px] text-gray-500 w-20 shrink-0 text-right">수분</span>
        <div className="flex-1 h-3 bg-gray-800 rounded-sm overflow-hidden">
          <div className="h-full bg-sky-500/30 rounded-sm" style={{ width: `${mean}%` }} />
        </div>
        <span className="text-[11px] font-mono text-sky-400 w-8 shrink-0 text-right">{mean.toFixed(0)}%</span>
        <span className="text-[11px] font-mono text-gray-500 w-20 shrink-0 text-right">목표치</span>
      </div>
    )
  }

  const r    = retention ?? { mean: 0.97, low: 0.92, high: 1.0 }
  const color = retentionColor(r.mean)

  // 실측값이 있을 경우 실측 보존율 (실측 / 예측평균)
  const actualRetention = (actualVal != null && actualVal !== undefined) && mean > 0
    ? Math.min(actualVal / mean, 1.5)
    : null

  return (
    <div className="flex items-center gap-2 py-0.5 group">
      <span className="text-[11px] text-gray-400 w-20 shrink-0 text-right truncate group-hover:text-gray-300 transition-colors"
        title={name}>
        {name}
      </span>

      {/* 바 */}
      <div className="flex-1 relative h-3.5 bg-gray-800/80 rounded-sm overflow-hidden">
        {/* CI 범위 (low ~ high) */}
        <div
          className="absolute top-0 h-full rounded-sm"
          style={{
            left:            `${r.low * 100}%`,
            width:           `${(r.high - r.low) * 100}%`,
            backgroundColor: `${color}28`,
          }}
        />
        {/* 예측 평균 바 */}
        <div
          className="absolute left-0 top-0 h-full rounded-sm transition-all duration-500"
          style={{ width: `${r.mean * 100}%`, backgroundColor: `${color}85` }}
        />
        {/* 실측값 마커 */}
        {actualRetention !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white/70"
            style={{ left: `${Math.min(actualRetention * r.mean * 100, 99)}%` }}
            title={`실측: ${fmt(actualVal ?? null, unit)}`}
          />
        )}
      </div>

      {/* 보존율 % */}
      <span className="text-[11px] font-mono w-8 shrink-0 text-right" style={{ color }}>
        {(r.mean * 100).toFixed(0)}%
      </span>

      {/* 예측 수치 */}
      <span className="text-[11px] font-mono text-gray-400 w-20 shrink-0 text-right"
        title={`CI: ${fmt(low, unit)} – ${fmt(high, unit)}`}>
        {fmt(mean, unit)}
      </span>
    </div>
  )
}

// ── 그룹 섹션 ─────────────────────────────────────────────────────────────────
const NUTRIENT_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: '일반성분', keys: ['탄수화물', '단백질', '지방', '회분', '당류'] },
  { label: '식이섬유', keys: ['TDF', 'IDF+HMWSDF', 'LMWSDF'] },
  { label: '무기질',   keys: ['칼슘', '인', '칼륨', '마그네슘', '나트륨', '철', '아연', '구리', '망간'] },
  { label: '비타민',   keys: ['비타민A', '비타민B1', '비타민B2', '비타민B6', '비타민B12', '비타민C', '비타민D', '비타민E', '나이아신', '베타카로틴', '엽산', '판토텐산'] },
]

function NutrientGroup({
  label, keys, prediction, actualNutrients,
}: {
  label:          string
  keys:           string[]
  prediction:     DryingPrediction
  actualNutrients?: Record<string, number | null>
}) {
  const entries = keys
    .filter(k => prediction.nutrients[k]?.mean != null)
    .map(k => ({
      key:      k,
      nutrient: prediction.nutrients[k],
      unit:     prediction.units[k] ?? '',
    }))
    .filter(e => e.nutrient.mean !== null)
    // 보존율 낮은 순서 (손실 큰 것이 위)
    .sort((a, b) => (a.nutrient.retention?.mean ?? 1) - (b.nutrient.retention?.mean ?? 1))

  if (entries.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
        <div className="flex-1 h-px bg-gray-800" />
      </div>
      <div className="space-y-0.5">
        {entries.map(({ key, nutrient, unit }) => (
          <RetentionBar
            key={key}
            name={key}
            nutrient={nutrient}
            unit={unit}
            actualVal={actualNutrients?.[key]}
          />
        ))}
      </div>
    </div>
  )
}

// ── 상단 요약 칩 ─────────────────────────────────────────────────────────────
const METHOD_STYLE: Record<DryingMethod, string> = {
  '열풍건조':    'bg-orange-500/10 text-orange-400 border-orange-500/30',
  '히트펌프건조': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  '동결건조':    'bg-violet-500/10 text-violet-400 border-violet-500/30',
}

// ── 범례 ─────────────────────────────────────────────────────────────────────
const LEGEND = [
  { label: '≥95%',    color: '#4ade80', desc: '안정' },
  { label: '85–95%',  color: '#60a5fa', desc: '양호' },
  { label: '70–85%',  color: '#facc15', desc: '보통' },
  { label: '50–70%',  color: '#fb923c', desc: '손실' },
  { label: '<50%',    color: '#f87171', desc: '고손실' },
]

// ── 3단 비교 뷰 ──────────────────────────────────────────────────────────────

const COMPARE_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: '일반성분', keys: ['수분', '탄수화물', '단백질', '지방', '회분', '당류'] },
  { label: '식이섬유', keys: ['TDF', 'IDF+HMWSDF', 'LMWSDF'] },
  { label: '무기질',   keys: ['칼슘', '인', '칼륨', '마그네슘', '나트륨', '철', '아연', '구리', '망간'] },
  { label: '비타민',   keys: ['비타민A', '비타민B1', '비타민B2', '비타민B6', '비타민B12', '비타민C', '비타민D', '비타민E', '나이아신', '베타카로틴', '엽산'] },
]

// 수치 컬럼 1개: 값 + 미니 바
function ValCell({
  value, ciLow, ciHigh, maxVal, color, isTarget,
}: {
  value:   number | null | undefined
  ciLow?:  number | null
  ciHigh?: number | null
  maxVal:  number
  color:   string
  isTarget?: boolean  // 건조 후 열 (예측값)
}) {
  const v   = value ?? null
  const pct = (v !== null && maxVal > 0) ? Math.min((v / maxVal) * 100, 100) : 0

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-mono text-gray-200 text-right tabular-nums leading-tight">
        {v !== null ? fmt(v) : <span className="text-gray-600">—</span>}
      </span>
      {/* CI 범위 (건조 후 열만) */}
      {isTarget && ciLow !== null && ciHigh !== null && ciLow !== undefined && ciHigh !== undefined && (
        <span className="text-[9px] font-mono text-gray-600 text-right leading-tight">
          {fmt(ciLow)}–{fmt(ciHigh)}
        </span>
      )}
      {/* 미니 바 */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        {pct > 0 && (
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: `${color}80` }} />
        )}
      </div>
    </div>
  )
}

function ThreeWayCompare({
  sample, prediction,
}: {
  sample:     ByproductSampleDetail
  prediction: DryingPrediction
}) {
  const raw    = sample.raw_reference?.nutrients ?? null
  const pomace = sample.nutrients
  const dried  = prediction.nutrients
  const units  = prediction.units

  const hasRaw = raw !== null

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className={`grid gap-2 text-[10px] font-semibold pb-1.5 border-b border-gray-700 ${hasRaw ? 'grid-cols-[90px_1fr_1fr_1fr]' : 'grid-cols-[90px_1fr_1fr]'}`}>
        <span className="text-gray-600">성분</span>
        {hasRaw && (
          <span className="text-gray-400 text-right">
            원물<br />
            <span className="font-normal text-gray-600 text-[9px]">{sample.raw_reference?.food_name ?? ''}</span>
          </span>
        )}
        <span className="text-blue-400/70 text-right">
          착즙박<br />
          <span className="font-normal text-gray-600 text-[9px]">수분 {sample.moisture_after_pct}%</span>
        </span>
        <span className="text-orange-400/70 text-right">
          건조 후<br />
          <span className="font-normal text-gray-600 text-[9px]">{prediction.method} {prediction.targetMoisturePct}%</span>
        </span>
      </div>

      {/* 그룹별 행 */}
      {COMPARE_GROUPS.map(({ label, keys }) => {
        const rows = keys.filter(k => {
          const inPomace = pomace[k] != null
          const inDried  = dried[k]?.mean != null
          const inRaw    = raw ? raw[k] != null : false
          return inPomace || inDried || inRaw
        })
        if (rows.length === 0) return null

        return (
          <div key={label}>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
              <div className="flex-1 h-px bg-gray-800" />
            </div>
            <div className="space-y-2">
              {rows.map(key => {
                const rawVal    = raw?.[key] ?? null
                const pomaceVal = pomace[key] ?? null
                const driedN    = dried[key]
                const driedVal  = driedN?.mean ?? null
                const ciLow     = driedN?.low  ?? null
                const ciHigh    = driedN?.high  ?? null
                const unit      = units[key] ?? ''

                // 최대값 기준 (미니 바 정규화)
                const maxVal = Math.max(
                  rawVal    ?? 0,
                  pomaceVal ?? 0,
                  driedVal  ?? 0,
                  0.0001,
                )

                return (
                  <div
                    key={key}
                    className={`grid gap-2 items-start ${hasRaw ? 'grid-cols-[90px_1fr_1fr_1fr]' : 'grid-cols-[90px_1fr_1fr]'}`}
                  >
                    {/* 성분명 */}
                    <div className="text-right pt-0.5">
                      <span className="text-[11px] text-gray-400 leading-tight">{key}</span>
                      {unit && (
                        <span className="block text-[9px] text-gray-600 leading-tight">{unit}</span>
                      )}
                    </div>

                    {/* 원물 */}
                    {hasRaw && (
                      <ValCell value={rawVal} maxVal={maxVal} color="#9ca3af" />
                    )}

                    {/* 착즙박 */}
                    <ValCell value={pomaceVal} maxVal={maxVal} color="#60a5fa" />

                    {/* 건조 후 */}
                    <ValCell
                      value={driedVal}
                      ciLow={ciLow}
                      ciHigh={ciHigh}
                      maxVal={maxVal}
                      color="#fb923c"
                      isTarget
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {!hasRaw && (
        <p className="text-[10px] text-gray-600 italic">
          ※ 원물 데이터 없음 — 부산물 DB에서 해당 샘플의 원물(base_food_code)을 연결하면 표시됩니다.
        </p>
      )}

      <p className="text-[10px] text-gray-600">
        건조 후 범위 = 문헌 95% CI · 바 길이는 행 내 최대값 기준
      </p>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export interface DryPredictData {
  sample:     ByproductSampleDetail
  prediction: DryingPrediction
}

type ViewTab = '바 차트' | '3단 비교'

export default function DryingPredictView({ data }: { data: DryPredictData }) {
  const { sample, prediction } = data
  const meta = METHOD_META[prediction.method]
  const [viewTab, setViewTab] = useState<ViewTab>('바 차트')

  // 보존율 하위 4 (수분 제외)
  const topLosers = Object.entries(prediction.nutrients)
    .filter(([k, v]) => k !== '수분' && v.retention)
    .sort((a, b) => (a[1].retention!.mean) - (b[1].retention!.mean))
    .slice(0, 4)

  return (
    <div className="space-y-5">

      {/* ── 헤더 정보 ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded border font-semibold ${METHOD_STYLE[prediction.method]}`}>
            {prediction.method}
          </span>
          <span className="text-xs text-gray-400">{meta.tempRange}</span>
          <span className="ml-auto text-xs text-gray-500 font-mono">
            ×{prediction.concentrationFactor.toFixed(2)} 농축
          </span>
        </div>

        <div className="flex gap-3 text-xs bg-gray-800/50 rounded p-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500">기준 샘플</span>
            <span className="text-gray-300 font-medium">{sample.sample_name}</span>
          </div>
          <div className="flex flex-col gap-0.5 ml-auto text-right">
            <span className="text-gray-500">초기 수분 → 목표 수분</span>
            <span className="text-gray-300 font-mono">
              {sample.moisture_after_pct ?? '?'}% → {prediction.targetMoisturePct}%
            </span>
          </div>
        </div>

        <p className="text-[11px] text-gray-500 leading-relaxed">{meta.note}</p>
      </div>

      {/* ── 손실 주의 요약 ─────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">
          보존율 하위 성분
        </p>
        <div className="grid grid-cols-4 gap-2">
          {topLosers.map(([key, { retention }]) => {
            const r = retention!.mean
            const color = retentionColor(r)
            return (
              <div key={key} className="rounded p-2 text-center" style={{ backgroundColor: `${color}12` }}>
                <div className="text-sm font-bold font-mono" style={{ color }}>
                  {(r * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-gray-400 truncate mt-0.5">{key}</div>
                <div className="text-[9px] mt-0.5" style={{ color: `${color}90` }}>
                  {retentionLabel(r)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 탭 스위처 ─────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-800/60 rounded p-0.5">
        {(['바 차트', '3단 비교'] as ViewTab[]).map(t => (
          <button
            key={t}
            onClick={() => setViewTab(t)}
            className={`flex-1 text-xs py-1.5 rounded transition-colors ${
              viewTab === t
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── 바 차트 뷰 ────────────────────────────────────────────── */}
      {viewTab === '바 차트' && (
        <>
          <div className="flex items-center gap-2 text-[10px] text-gray-600 border-b border-gray-800 pb-1">
            <span className="w-20 shrink-0 text-right">성분</span>
            <span className="flex-1 text-center">보존율 (CI 범위)</span>
            <span className="w-8 shrink-0 text-right">%</span>
            <span className="w-20 shrink-0 text-right">예측값</span>
          </div>

          <RetentionBar
            name="수분"
            nutrient={prediction.nutrients['수분'] ?? { mean: prediction.targetMoisturePct, low: null, high: null, retention: null }}
            unit="%"
          />

          <div className="space-y-4">
            {NUTRIENT_GROUPS.map(({ label, keys }) => (
              <NutrientGroup
                key={label}
                label={label}
                keys={keys}
                prediction={prediction}
                actualNutrients={sample.nutrients}
              />
            ))}
          </div>

          <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-800">
            {LEGEND.map(({ label, color, desc }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `${color}80` }} />
                <span className="text-[10px] text-gray-500">{label} {desc}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 3단 비교 뷰 ───────────────────────────────────────────── */}
      {viewTab === '3단 비교' && (
        <ThreeWayCompare sample={sample} prediction={prediction} />
      )}

      <p className="text-[10px] text-gray-600 leading-relaxed">
        ※ 문헌 기반 예측 · 95% CI 표시.<br />
        출처: Schieber 2001, Wang 2019, Deng 2018, Ciurzyńska 2011
      </p>
    </div>
  )
}
