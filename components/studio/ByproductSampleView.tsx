'use client'

import { useState } from 'react'
import NutrientHeatmap from './NutrientHeatmap'

interface MicroItem  { mean?: number; result?: string; values: (number | string | null)[]; unit: string; limit?: number }
interface SafetyItem { nd: boolean; unit: string; values: (number | null)[] }
interface PestItem   { mean: number; values: (number | null)[]; unit: string }

export interface ByproductSampleDetail {
  id:                   string
  sample_name:          string
  byproduct_type:       string
  base_food_code:       string | null
  extraction_method:    string | null
  drying_method:        string | null
  moisture_after_pct:   number | null
  sample_source:        string | null
  evaluation_date:      string | null
  notes:                string | null
  nutrients:            Record<string, number | null>
  nutrient_units:       Record<string, string>
  safety_metals:        Record<string, SafetyItem>
  safety_mycotoxins:    Record<string, SafetyItem>
  safety_microbiology:  Record<string, MicroItem>
  pesticide_detected:   Record<string, PestItem>
  pesticide_nd:         string[]
  raw_reference:        {
    food_code:      string
    food_name:      string
    nutrients:      Record<string, number | null>
    nutrient_units: Record<string, string>
  } | null
  retention_factors:    Record<string, number | null>
}

// ── 성분 바 ───────────────────────────────────────────────────────────────────
function NutrientBar({ label, value, unit, maxVal, compare }: {
  label: string; value: number | null; unit: string; maxVal: number; compare?: number | null
}) {
  if (value === null) return null
  const pct     = Math.min(100, (value / maxVal) * 100)
  const cmpPct  = compare !== null && compare !== undefined ? Math.min(100, (compare / maxVal) * 100) : null
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-200 font-mono">
          {value.toFixed(value < 1 ? 4 : 2)} {unit}
          {cmpPct !== null && compare != null && (
            <span className="ml-1.5 text-gray-500">
              (원물 {compare.toFixed(compare < 1 ? 4 : 2)})
            </span>
          )}
        </span>
      </div>
      <div className="relative h-2 bg-gray-800 rounded-full">
        <div className="absolute h-full rounded-full bg-blue-500/70" style={{ width: `${pct}%` }} />
        {cmpPct !== null && (
          <div className="absolute top-0 h-full w-0.5 bg-orange-400/60" style={{ left: `${cmpPct}%` }} />
        )}
      </div>
    </div>
  )
}

// ── 성분 탭 ───────────────────────────────────────────────────────────────────
const NUTRIENT_GROUPS: Array<{ label: string; keys: string[]; maxVal: number }> = [
  { label: '일반성분',  keys: ['수분','탄수화물','단백질','지방','회분'],              maxVal: 100 },
  { label: '식이섬유',  keys: ['TDF','IDF+HMWSDF','LMWSDF'],                          maxVal: 20  },
  { label: '무기질',    keys: ['칼륨','칼슘','인','마그네슘','나트륨','철','아연','구리','망간'], maxVal: 200 },
  { label: '비타민',    keys: ['비타민E','비타민B2','비타민B12','비타민A','비타민B1','비타민B6','비타민C','나이아신','베타카로틴'], maxVal: 1 },
]

function NutrientTab({ nutrients, units, rawNutrients }: {
  nutrients: Record<string, number | null>
  units:     Record<string, string>
  rawNutrients?: Record<string, number | null>
}) {
  return (
    <div className="space-y-5">
      {rawNutrients && (
        <p className="text-xs text-gray-500">
          <span className="inline-block w-2.5 h-0.5 bg-orange-400/60 mr-1 align-middle" /> 세로 선 = 원물 수치
        </p>
      )}
      {NUTRIENT_GROUPS.map(({ label, keys, maxVal }) => {
        const entries = keys.map(k => [k, nutrients[k]] as [string, number | null]).filter(([, v]) => v !== null)
        if (entries.length === 0) return null
        return (
          <div key={label}>
            <p className="text-xs text-gray-400 font-semibold mb-2">{label}</p>
            <div className="space-y-2">
              {entries.map(([k, v]) => (
                <NutrientBar key={k} label={k} value={v} unit={units[k] ?? ''} maxVal={maxVal}
                  compare={rawNutrients?.[k]} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 안전 탭 ───────────────────────────────────────────────────────────────────
function SafetyBadge({ pass }: { pass: boolean }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
      pass ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
    }`}>
      {pass ? '적합' : '부적합'}
    </span>
  )
}

function SafetyTab({ metals, mycotoxins, micro }: {
  metals:      Record<string, SafetyItem>
  mycotoxins:  Record<string, SafetyItem>
  micro:       Record<string, MicroItem>
}) {
  return (
    <div className="space-y-5">
      {/* 중금속 */}
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-2">중금속</p>
        <div className="space-y-1">
          {Object.entries(metals).map(([name, item]) => (
            <div key={name} className="flex items-center justify-between py-1.5 border-b border-gray-800">
              <span className="text-sm text-gray-300">{name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{item.unit}</span>
                <SafetyBadge pass={item.nd} />
                <span className="text-xs text-gray-400">불검출</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 곰팡이독소 */}
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-2">곰팡이독소</p>
        <div className="space-y-1">
          {Object.entries(mycotoxins).map(([name, item]) => (
            <div key={name} className="flex items-center justify-between py-1.5 border-b border-gray-800">
              <span className="text-sm text-gray-300">{name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{item.unit}</span>
                <SafetyBadge pass={item.nd} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 미생물 */}
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-2">미생물</p>
        <div className="space-y-1">
          {Object.entries(micro).map(([name, item]) => {
            const isPass = item.result === '음성'
              || (item.limit !== undefined ? (item.mean ?? 0) < item.limit : true)
            const displayVal = item.result ?? (item.mean?.toLocaleString() ?? '—')
            return (
              <div key={name} className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-sm text-gray-300">{name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-200">{displayVal}</span>
                  <span className="text-xs text-gray-500">{item.unit}</span>
                  <SafetyBadge pass={isPass} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-600 mt-2">※ 식약처 기준: 비가열 과채주스 세균수 1×10⁵ CFU 미만</p>
      </div>
    </div>
  )
}

// ── 잔류농약 탭 ───────────────────────────────────────────────────────────────
function PesticideTab({ detected, nd }: {
  detected: Record<string, PestItem>
  nd:       string[]
}) {
  const [showNd, setShowNd] = useState(false)
  const sorted = Object.entries(detected).sort((a, b) => b[1].mean - a[1].mean)
  const maxVal = sorted[0]?.[1].mean ?? 1

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-2">
          검출 항목 ({sorted.length}종)
        </p>
        <div className="space-y-2">
          {sorted.map(([name, item]) => {
            const pct = (item.mean / maxVal) * 100
            return (
              <div key={name}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-300 font-mono">{name}</span>
                  <span className="text-gray-300">{item.mean} {item.unit}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full">
                  <div
                    className={`h-full rounded-full ${item.mean > 0.3 ? 'bg-orange-500/70' : item.mean > 0.1 ? 'bg-yellow-500/70' : 'bg-blue-500/50'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        </div>

      <div>
        <button
          onClick={() => setShowNd(v => !v)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showNd ? '▲' : '▼'} 불검출 항목 ({nd.length}종)
        </button>
        {showNd && (
          <div className="mt-2 flex flex-wrap gap-1">
            {nd.map(name => (
              <span key={name} className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded font-mono">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 원물비교 탭 ───────────────────────────────────────────────────────────────
const COMPARE_KEYS = ['수분','탄수화물','단백질','지방','TDF','칼륨','칼슘','인','철','비타민E','비타민C']

function CompareTab({ sample, raw, retention }: {
  sample:    Record<string, number | null>
  raw:       Record<string, number | null>
  retention: Record<string, number | null>
}) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 text-xs text-gray-500 pb-1 border-b border-gray-800 mb-1">
        <span>성분</span>
        <span className="text-right">부산물</span>
        <span className="text-right">원물</span>
        <span className="text-right">보존율</span>
      </div>
      {COMPARE_KEYS.map(key => {
        const sv  = sample[key]
        const rv  = raw[key]
        const ret = retention[key]
        if (sv == null && rv == null) return null
        const retColor = ret == null ? 'text-gray-500'
          : ret >= 1.2  ? 'text-blue-400'
          : ret >= 0.8  ? 'text-green-400'
          : ret >= 0.5  ? 'text-yellow-400'
          : 'text-red-400'
        return (
          <div key={key} className="grid grid-cols-4 py-1.5 border-b border-gray-800/50 text-sm">
            <span className="text-gray-300">{key}</span>
            <span className="text-right font-mono text-gray-200">
              {sv != null ? sv.toFixed(sv < 0.01 ? 5 : sv < 1 ? 3 : 2) : '—'}
            </span>
            <span className="text-right font-mono text-gray-400">
              {rv != null ? rv.toFixed(rv < 0.01 ? 5 : rv < 1 ? 3 : 2) : '—'}
            </span>
            <span className={`text-right font-mono ${retColor}`}>
              {ret != null ? `${(ret * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
        )
      })}
      <p className="text-xs text-gray-600 pt-1">
        보존율: 부산물 ÷ 원물 × 100%<br />
        <span className="text-blue-400">청색</span> &gt;120% &nbsp;
        <span className="text-green-400">녹색</span> 80~120% &nbsp;
        <span className="text-yellow-400">황색</span> 50~80% &nbsp;
        <span className="text-red-400">적색</span> &lt;50%
      </p>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
type TabId = '히트맵' | '성분' | '안전' | '농약' | '원물비교'

export default function ByproductSampleView({ data }: { data: ByproductSampleDetail }) {
  const [tab, setTab] = useState<TabId>('히트맵')

  const tabs: TabId[] = ['히트맵', '성분', '안전', '농약', data.raw_reference ? '원물비교' : null].filter(Boolean) as TabId[]

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="space-y-1">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
          {data.byproduct_type.replace('_', ' ')}
        </p>
        <p className="text-base font-semibold text-gray-100">{data.sample_name}</p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {data.sample_source   && <span>📍 {data.sample_source}</span>}
          {data.evaluation_date && <span>📅 {data.evaluation_date}</span>}
          {data.extraction_method && data.extraction_method !== 'none' && (
            <span>⚙️ {data.extraction_method}</span>
          )}
          {data.moisture_after_pct !== null && (
            <span>💧 수분 {data.moisture_after_pct}%</span>
          )}
        </div>
        {data.raw_reference && (
          <p className="text-xs text-blue-400/70">
            🔗 원물: {data.raw_reference.food_name} ({data.raw_reference.food_code})
          </p>
        )}
        {data.notes && (
          <p className="text-xs text-gray-500 italic">{data.notes}</p>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-800">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div>
        {tab === '히트맵' && (
          <NutrientHeatmap
            nutrients={data.nutrients}
            units={data.nutrient_units}
            compareNutrients={data.raw_reference?.nutrients ?? undefined}
          />
        )}
        {tab === '성분' && (
          <NutrientTab
            nutrients={data.nutrients}
            units={data.nutrient_units}
            rawNutrients={data.raw_reference?.nutrients ?? undefined}
          />
        )}
        {tab === '안전' && (
          <SafetyTab
            metals={data.safety_metals}
            mycotoxins={data.safety_mycotoxins}
            micro={data.safety_microbiology}
          />
        )}
        {tab === '농약' && (
          <PesticideTab
            detected={data.pesticide_detected}
            nd={data.pesticide_nd}
          />
        )}
        {tab === '원물비교' && data.raw_reference && (
          <CompareTab
            sample={data.nutrients}
            raw={data.raw_reference.nutrients}
            retention={data.retention_factors}
          />
        )}
      </div>
    </div>
  )
}
