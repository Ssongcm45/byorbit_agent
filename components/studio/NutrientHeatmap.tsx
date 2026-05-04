'use client'

// 그룹 정의: [label, rgb, keys[]]
const GROUPS: Array<{ label: string; rgb: [number, number, number]; keys: string[] }> = [
  {
    label: '일반성분',
    rgb: [59, 130, 246],
    keys: ['에너지', '수분', '탄수화물', '단백질', '지방', '회분', '당류', '포화지방', '트랜스지방'],
  },
  {
    label: '식이섬유',
    rgb: [34, 197, 94],
    keys: ['식이섬유', 'TDF', 'IDF+HMWSDF', 'LMWSDF', '불용성식이섬유', '수용성식이섬유'],
  },
  {
    label: '무기질',
    rgb: [251, 146, 60],
    keys: ['칼슘', '인', '나트륨', '칼륨', '마그네슘', '철', '아연', '구리', '망간', '셀레늄', '몰리브덴', '크롬', '요오드', '불소'],
  },
  {
    label: '비타민',
    rgb: [167, 139, 250],
    keys: ['비타민A', '레티놀', '베타카로틴', '비타민D', '비타민E', '비타민K', '비타민B1', '비타민B2', '나이아신', '비타민B6', '비타민B12', '엽산', '판토텐산', '비오틴', '비타민C'],
  },
]

function fmt(v: number, unit: string): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return '—'
  if (unit.toLowerCase().includes('kcal') || unit.toLowerCase().includes('kj')) return n.toFixed(0)
  if (n >= 100) return n.toFixed(0)
  if (n >= 10)  return n.toFixed(1)
  if (n >= 1)   return n.toFixed(2)
  if (n >= 0.01) return n.toFixed(3)
  return n.toFixed(4)
}

interface HeatmapCellProps {
  name:    string
  value:   number
  unit:    string
  norm:    number       // 0-1, normalized within group
  rgb:     [number, number, number]
  compare?: number | null
}

function HeatmapCell({ name, value, unit, norm, rgb, compare }: HeatmapCellProps) {
  const [r, g, b] = rgb
  const bgAlpha   = 0.06 + norm * 0.60
  const valAlpha  = 0.55 + norm * 0.45

  const retPct = compare != null && compare > 0 ? (value / compare) * 100 : null
  const retColor =
    retPct === null   ? ''
    : retPct >= 120   ? '#60a5fa'
    : retPct >= 80    ? '#4ade80'
    : retPct >= 50    ? '#facc15'
    : '#f87171'

  return (
    <div
      className="rounded p-2 flex flex-col gap-0.5 min-w-0"
      style={{ backgroundColor: `rgba(${r},${g},${b},${bgAlpha})` }}
    >
      <span className="text-[10px] text-gray-300 truncate leading-tight" title={name}>{name}</span>
      <span
        className="text-sm font-mono font-semibold leading-tight"
        style={{ color: `rgba(${r},${g},${b},${valAlpha})` }}
      >
        {fmt(value, unit)}
      </span>
      <span className="text-[10px] text-gray-500 truncate leading-tight">{unit || '—'}</span>
      {retPct !== null && (
        <span className="text-[10px] font-mono leading-tight" style={{ color: retColor }}>
          {retPct.toFixed(0)}%↑
        </span>
      )}
    </div>
  )
}

interface Section {
  label:   string
  rgb:     [number, number, number]
  entries: Array<{ key: string; val: number }>
  maxVal:  number
}

interface Props {
  nutrients:         Record<string, number | null>
  units:             Record<string, string>
  compareNutrients?: Record<string, number | null>
}

export default function NutrientHeatmap({ nutrients, units, compareNutrients }: Props) {
  const assignedKeys = new Set<string>()

  const groupedSections: Section[] = GROUPS.flatMap(({ label, rgb, keys }) => {
    const entries = keys
      .filter(k => typeof nutrients[k] === 'number' && isFinite(nutrients[k] as number))
      .map(k => {
        assignedKeys.add(k)
        return { key: k, val: nutrients[k] as number }
      })

    if (entries.length === 0) return []

    const maxVal = Math.max(...entries.map(e => e.val), 1e-9)
    return [{ label, rgb, entries, maxVal }]
  })

  // 미분류 성분 (위 그룹에 없는 나머지)
  const otherEntries = Object.entries(nutrients)
    .filter(([k, v]) => !assignedKeys.has(k) && typeof v === 'number' && isFinite(v))
    .map(([k, v]) => ({ key: k, val: v as number }))
  const otherMax = Math.max(...otherEntries.map(e => e.val), 1e-9)

  return (
    <div className="space-y-5">
      {compareNutrients && (
        <p className="text-[10px] text-gray-500">
          숫자 아래 % = 원물 대비 보존율
          <span className="ml-2 text-blue-400">■</span>≥120%
          <span className="ml-1 text-green-400">■</span>80~120%
          <span className="ml-1 text-yellow-400">■</span>50~80%
          <span className="ml-1 text-red-400">■</span>&lt;50%
        </p>
      )}

      {groupedSections.map(({ label, rgb, entries, maxVal }) => (
        <div key={label}>
          <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">
            {label} <span className="font-normal text-gray-600">({entries.length})</span>
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {entries.map(({ key, val }) => (
              <HeatmapCell
                key={key}
                name={key}
                value={val}
                unit={units[key] ?? ''}
                norm={maxVal > 0 ? val / maxVal : 0}
                rgb={rgb}
                compare={compareNutrients?.[key]}
              />
            ))}
          </div>
        </div>
      ))}

      {otherEntries.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">
            기타 <span className="font-normal text-gray-600">({otherEntries.length})</span>
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {otherEntries.map(({ key, val }) => (
              <HeatmapCell
                key={key}
                name={key}
                value={val}
                unit={units[key] ?? ''}
                norm={otherMax > 0 ? val / otherMax : 0}
                rgb={[100, 116, 139]}
                compare={compareNutrients?.[key]}
              />
            ))}
          </div>
        </div>
      )}

      {groupedSections.length === 0 && otherEntries.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">표시할 성분 데이터 없음</p>
      )}
    </div>
  )
}
