'use client'

import { useState, useMemo } from 'react'
import { analyzeNutrients, type NutrientEntry, type NutrientProfile, type DensityCluster } from '@/lib/analysis/nutrient-analysis'
import NutrientHeatmap from './NutrientHeatmap'

// ── 색상 상수 ─────────────────────────────────────────────────────────────────
const CLUSTER_STYLE: Record<DensityCluster, string> = {
  high:     'bg-green-500/15 text-green-400 border-green-500/30',
  moderate: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  low:      'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  trace:    'bg-gray-700/40 text-gray-400 border-gray-600/20',
}
const CLUSTER_BAR: Record<DensityCluster, string> = {
  high: 'bg-green-500', moderate: 'bg-blue-500', low: 'bg-yellow-500', trace: 'bg-gray-600',
}
const CLUSTER_LABEL: Record<DensityCluster, string> = {
  high: 'HIGH', moderate: 'MOD', low: 'LOW', trace: 'TRACE',
}

// ── Donut Chart (SVG) ─────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: Array<{ color: string; pct: number; name: string }> }) {
  const r = 46, cx = 55, cy = 55, sw = 16
  const C = 2 * Math.PI * r
  let cum = 0

  return (
    <svg viewBox="0 0 110 110" className="w-full max-w-[120px] mx-auto drop-shadow-sm">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f2937" strokeWidth={sw} />
      {segments.map((seg, i) => {
        const dash   = (seg.pct / 100) * C
        const offset = -(cum / 100) * C
        cum += seg.pct
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={sw}
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">열량</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8" fill="#6b7280">구성비</text>
    </svg>
  )
}

// ── Radar Chart (SVG) ─────────────────────────────────────────────────────────
function RadarChart({ axes }: { axes: Array<{ label: string; value: number }> }) {
  const cx = 90, cy = 90, r = 64, n = axes.length
  const angle = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2

  const pt = (i: number, pct: number) => ({
    x: cx + (pct / 100) * r * Math.cos(angle(i)),
    y: cy + (pct / 100) * r * Math.sin(angle(i)),
  })

  const lp = (i: number) => {
    const a = angle(i)
    return {
      x: cx + (r + 18) * Math.cos(a),
      y: cy + (r + 18) * Math.sin(a),
      anchor: (Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle') as 'start' | 'end' | 'middle',
    }
  }

  const polygon = axes.map((_, i) => { const p = pt(i, axes[i].value); return `${p.x},${p.y}` }).join(' ')
  const gridLevels = [25, 50, 75, 100]

  return (
    <svg viewBox="0 0 180 180" className="w-full max-w-[200px] mx-auto">
      {gridLevels.map(lvl => (
        <polygon key={lvl}
          points={axes.map((_, i) => { const p = pt(i, lvl); return `${p.x},${p.y}` }).join(' ')}
          fill="none" stroke="#1f2937" strokeWidth={lvl === 100 ? 1 : 0.5}
        />
      ))}
      {gridLevels.map(lvl => (
        <text key={lvl} x={cx + 2} y={cy - (lvl / 100) * r + 4}
          fontSize="6" fill="#374151" textAnchor="start">{lvl}%</text>
      ))}
      {axes.map((_, i) => {
        const p = pt(i, 100)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#374151" strokeWidth="0.5" />
      })}
      <polygon points={polygon} fill="#3b82f620" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
      {axes.map((ax, i) => {
        const p = pt(i, ax.value)
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" />
            {ax.value > 5 && (
              <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="6.5" fill="#60a5fa">
                {ax.value.toFixed(0)}
              </text>
            )}
          </g>
        )
      })}
      {axes.map((ax, i) => {
        const l = lp(i)
        return (
          <text key={i} x={l.x} y={l.y} textAnchor={l.anchor} dominantBaseline="middle"
            fontSize="8" fill="#9ca3af">
            {ax.label}
          </text>
        )
      })}
    </svg>
  )
}

// ── Horizontal Bar Row ────────────────────────────────────────────────────────
function NutrientBar({ entry, barColor }: { entry: NutrientEntry; barColor?: string }) {
  const pct = Math.min(100, entry.drvPct ?? 0)
  const color = barColor ?? CLUSTER_BAR[entry.cluster]
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-mono ${CLUSTER_STYLE[entry.cluster]}`}>
            {CLUSTER_LABEL[entry.cluster]}
          </span>
          <span className="text-xs text-gray-300 truncate">{entry.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono ${
            entry.zScore > 1.5 ? 'text-green-400' : entry.zScore > 0.5 ? 'text-blue-400' :
            entry.zScore < -1 ? 'text-gray-500' : 'text-gray-400'
          }`}>z={entry.zScore > 0 ? '+' : ''}{entry.zScore.toFixed(1)}</span>
          <span className="text-xs text-gray-300 font-mono">
            {entry.value}{entry.unit ? ' ' + entry.unit : ''}
          </span>
        </div>
      </div>
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
        {entry.drvPct !== null && pct > 0 && (
          <div className="absolute inset-0 flex items-center">
            <div className="ml-auto mr-1 text-[9px] text-gray-500 font-mono">{entry.drvPct.toFixed(0)}%</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 범례 ─────────────────────────────────────────────────────────────────────
function ClusterLegend() {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {(['high', 'moderate', 'low', 'trace'] as const).map(c => (
        <span key={c} className={`text-[10px] px-1.5 py-0.5 rounded border ${CLUSTER_STYLE[c]}`}>
          {CLUSTER_LABEL[c]} {c === 'high' ? '≥50%' : c === 'moderate' ? '20-50%' : c === 'low' ? '5-20%' : '<5%'}
        </span>
      ))}
    </div>
  )
}

// ── 탭 ───────────────────────────────────────────────────────────────────────
type Tab = 'macro' | 'mineral' | 'vitamin' | 'radar' | 'score' | 'heatmap'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'heatmap', label: '히트맵' },
  { id: 'macro',   label: '거대' },
  { id: 'mineral', label: '미네랄' },
  { id: 'vitamin', label: '비타민' },
  { id: 'radar',   label: '레이더' },
  { id: 'score',   label: '기능성' },
]

const GRADE_STYLE: Record<string, string> = {
  A: 'text-green-400 border-green-500/40 bg-green-500/10',
  B: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  C: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  D: 'text-gray-300 border-gray-600/40 bg-gray-700/20',
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
interface RDAAnalysisProps {
  nutrients:     Record<string, number | null>
  nutrientUnits: Record<string, string>
}

export default function RDAAnalysis({ nutrients, nutrientUnits }: RDAAnalysisProps) {
  const [tab, setTab] = useState<Tab>('heatmap')

  const profile: NutrientProfile = useMemo(
    () => analyzeNutrients(nutrients, nutrientUnits),
    [nutrients, nutrientUnits],
  )

  return (
    <div className="mt-2 space-y-2.5 border-t border-gray-700/50 pt-3">
      <p className="text-xs text-gray-400 font-semibold tracking-wide uppercase">성분 분석</p>

      {/* 탭 바 */}
      <div className="flex gap-px bg-gray-900 rounded p-0.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 text-xs py-1.5 rounded transition-colors leading-none ${
              tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 히트맵 탭 ── */}
      {tab === 'heatmap' && (
        <NutrientHeatmap nutrients={nutrients} units={nutrientUnits} />
      )}

      {/* ── 거대영양소 탭 ── */}
      {tab === 'macro' && (
        <div className="space-y-3">
          {profile.macroSegments.length > 0 && (
            <div className="flex items-center gap-4">
              <DonutChart segments={profile.macroSegments} />
              <div className="space-y-2 flex-1">
                {profile.macroSegments.map(m => (
                  <div key={m.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
                    <span className="text-xs text-gray-300 flex-1 truncate">{m.name}</span>
                    <span className="text-xs text-gray-300 font-mono">{m.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            {profile.byCategory.macro.length === 0
              ? <p className="text-sm text-gray-500">거대영양소 데이터 없음</p>
              : profile.byCategory.macro.map(e => <NutrientBar key={e.name} entry={e} />)
            }
          </div>
        </div>
      )}

      {/* ── 미네랄 탭 ── */}
      {tab === 'mineral' && (
        <div className="space-y-3">
          <ClusterLegend />
          {profile.byCategory.mineral.length === 0
            ? <p className="text-sm text-gray-500">미네랄 데이터 없음</p>
            : <div className="space-y-3">
                {profile.byCategory.mineral
                  .sort((a, b) => (b.drvPct ?? 0) - (a.drvPct ?? 0))
                  .map(e => <NutrientBar key={e.name} entry={e} />)
                }
              </div>
          }
        </div>
      )}

      {/* ── 비타민 탭 ── */}
      {tab === 'vitamin' && (
        <div className="space-y-3">
          <ClusterLegend />
          {profile.byCategory.vitamin.length === 0
            ? <p className="text-sm text-gray-500">비타민 데이터 없음</p>
            : <div className="space-y-3">
                {profile.byCategory.vitamin
                  .sort((a, b) => (b.drvPct ?? 0) - (a.drvPct ?? 0))
                  .map(e => <NutrientBar key={e.name} entry={e} barColor="bg-purple-500" />)
                }
              </div>
          }
        </div>
      )}

      {/* ── 레이더 탭 ── */}
      {tab === 'radar' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">핵심 8개 영양소 DRV 충족률 (%)</p>
          <RadarChart axes={profile.radarAxes} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {profile.radarAxes.map(ax => (
              <div key={ax.key} className="flex justify-between text-xs">
                <span className="text-gray-400 truncate">{ax.label}</span>
                <span className={`font-mono ${
                  ax.value >= 50 ? 'text-green-400' : ax.value >= 20 ? 'text-blue-400' :
                  ax.value >= 5 ? 'text-yellow-500' : 'text-gray-500'
                }`}>{ax.value.toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500">DRV = 한국 영양소 섭취기준 (성인 기준)</p>
        </div>
      )}

      {/* ── 기능성 분석 탭 ── */}
      {tab === 'score' && (
        <div className="space-y-3">
          {/* 기능성 점수 카드 */}
          <div className={`border rounded-lg p-3 flex items-center gap-3 ${GRADE_STYLE[profile.functionalScore.grade]}`}>
            <div className="text-center shrink-0">
              <div className="text-4xl font-bold leading-none">{profile.functionalScore.grade}</div>
              <div className="text-xl font-mono font-bold mt-1">{profile.functionalScore.total}</div>
              <div className="text-[10px] opacity-60 mt-0.5">/ 100점</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">부산물 원료화 기능성 지수</p>
              <p className="text-[10px] opacity-70 mt-0.5">가중 다기준 채점 (bi 스코어링)</p>
            </div>
          </div>

          {/* KNN 분류 결과 */}
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 space-y-1.5">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">KNN 기능 유형 분류</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200 font-semibold">{profile.knnResult.type}</span>
              <span className="text-xs font-mono text-blue-400">
                유사도 {(profile.knnResult.similarity * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">{profile.knnResult.description}</p>
          </div>

          {/* 가중 채점 세부 */}
          <div className="space-y-2.5">
            <p className="text-xs text-gray-400 font-semibold">채점 세부 (가중 평균)</p>
            {profile.functionalScore.breakdown.map(b => (
              <div key={b.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">{b.label}</span>
                  <span className="text-gray-400 font-mono">{b.weight}% × {b.rawScore.toFixed(0)}pt</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500/60 rounded-full transition-all"
                    style={{ width: `${b.rawScore}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* K-군집 요약 */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-semibold">K-군집 분류 요약</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['high', 'moderate', 'low', 'trace'] as const).map(c => (
                <div key={c} className={`rounded p-2 border text-center ${CLUSTER_STYLE[c]}`}>
                  <div className="text-[10px] font-bold">{CLUSTER_LABEL[c]}</div>
                  <div className="text-lg font-bold leading-tight">{profile.clusterSummary[c]}</div>
                  <div className="text-[9px] opacity-60">종</div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-gray-500 leading-relaxed">
            ※ NICS 원물 성분 기반 1차 스크리닝. 추출 공정·안정성·인체적용시험 후 재산정 필요.
          </p>
        </div>
      )}
    </div>
  )
}
