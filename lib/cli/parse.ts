// 터미널 커맨드 라인 파서 (순수 함수, 의존성 없음)

export type DryingMethodKo = '열풍건조' | '히트펌프건조' | '동결건조'

export type ParsedCommand =
  | { kind: 'api'; command: 'analyze' | 'diagnose' | 'rda'; args: Record<string, unknown> }
  | { kind: 'help'; topic?: string }
  | { kind: 'clear' }
  | { kind: 'history' }
  | { kind: 'thesaurus'; q: string }
  | { kind: 'samples' }
  | { kind: 'sample'; id: string }
  | { kind: 'dry'; id: string; method: DryingMethodKo; target: number }
  | { kind: 'error'; message: string }

export const COMMAND_NAMES = [
  'analyze', 'diagnose', 'rda', 'thesaurus', 'samples', 'sample', 'dry', 'help', 'clear', 'history',
] as const

const hint = (topic?: string) =>
  ` (\`${topic ? `help ${topic}` : 'help'}\` 를 입력하면 사용법을 볼 수 있습니다)`

/** 따옴표(', ")를 존중하는 토크나이저. 닫히지 않은 따옴표는 null 반환. */
export function tokenize(input: string): string[] | null {
  const tokens: string[] = []
  let cur = ''
  let has = false
  let quote: '"' | "'" | null = null
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      has = true
    } else if (/\s/.test(ch)) {
      if (has || cur) { tokens.push(cur); cur = ''; has = false }
    } else {
      cur += ch
      has = true
    }
  }
  if (quote) return null
  if (has || cur) tokens.push(cur)
  return tokens
}

type FieldSpec = {
  name: string
  type: 'number' | 'string' | 'boolean' | 'enum'
  /** enum 전용: 입력값(소문자) → API 값 */
  values?: Record<string, string>
}

const f = (name: string, type: FieldSpec['type'] = 'string'): FieldSpec => ({ name, type })
const e = (name: string, values: Record<string, string>): FieldSpec => ({ name, type: 'enum', values })

// API(app/api/cli/route.ts)가 받는 enum 값 + 한글 별칭
const BYPRODUCT_TYPES: Record<string, string> = {
  apple_pomace: 'apple_pomace', '사과박': 'apple_pomace', '사과': 'apple_pomace',
  coffee_grounds: 'coffee_grounds', '커피박': 'coffee_grounds', '커피': 'coffee_grounds',
  citrus_pomace: 'citrus_pomace', '감귤박': 'citrus_pomace', '감귤': 'citrus_pomace',
  cabbage_residue: 'cabbage_residue', '배추부산물': 'cabbage_residue', '배추': 'cabbage_residue',
  other: 'other', '기타': 'other',
}
const ANALYZE_DRYING: Record<string, string> = {
  none: 'none', '없음': 'none', '미건조': 'none',
  hot_air: 'hot_air', '열풍건조': 'hot_air', '열풍': 'hot_air',
  freeze_dry: 'freeze_dry', '동결건조': 'freeze_dry', '동결': 'freeze_dry',
  sun_dry: 'sun_dry', '천일건조': 'sun_dry', '자연건조': 'sun_dry',
  spray_dry: 'spray_dry', '분무건조': 'spray_dry',
}
const DETECTION: Record<string, string> = {
  nd: 'ND', '불검출': 'ND', false: 'ND', no: 'ND',
  detected: 'DETECTED', '검출': 'DETECTED', true: 'DETECTED', yes: 'DETECTED',
}
const ODOR_LEVELS: Record<string, string> = {
  none: 'none', '없음': 'none', mild: 'mild', '약함': 'mild', strong: 'strong', '강함': 'strong',
}
const MOISTURE_LEVELS: Record<string, string> = {
  low: 'low', '낮음': 'low', medium: 'medium', '보통': 'medium', high: 'high', '높음': 'high',
}

// 키는 소문자로 비교한다.
const ANALYZE_FLAGS: Record<string, FieldSpec> = {
  mock: f('mock', 'boolean'),
  byproduct: e('byproduct_type', BYPRODUCT_TYPES), byproduct_type: e('byproduct_type', BYPRODUCT_TYPES),
  variety: f('variety'), region: f('region'),
  season: f('harvest_season'), harvest_season: f('harvest_season'),
  drying: e('drying_method', ANALYZE_DRYING), drying_method: e('drying_method', ANALYZE_DRYING),
  tdf: f('TDF_g_per_100g', 'number'), tdf_g_per_100g: f('TDF_g_per_100g', 'number'),
  tpc: f('TPC_mgGAE_per_g', 'number'), tpc_mggae_per_g: f('TPC_mgGAE_per_g', 'number'),
  moisture: f('dry_moisture_pct', 'number'), dry_moisture_pct: f('dry_moisture_pct', 'number'),
  'fresh-moisture': f('fresh_moisture_pct', 'number'), fresh_moisture_pct: f('fresh_moisture_pct', 'number'),
  shelf_life_h: f('shelf_life_h', 'number'), 'shelf-life': f('shelf_life_h', 'number'),
  pectin: f('pectin_g_per_100g', 'number'), pectin_g_per_100g: f('pectin_g_per_100g', 'number'),
  protein: f('protein_g_per_100g', 'number'), protein_g_per_100g: f('protein_g_per_100g', 'number'),
  sugar: f('sugar_g_per_100g', 'number'), sugar_g_per_100g: f('sugar_g_per_100g', 'number'),
  pb: f('Pb_ppm', 'number'), pb_ppm: f('Pb_ppm', 'number'),
  cd: f('Cd_ppm', 'number'), cd_ppm: f('Cd_ppm', 'number'),
  as: f('As_ppm', 'number'), as_ppm: f('As_ppm', 'number'),
  hg: f('Hg_ppm', 'number'), hg_ppm: f('Hg_ppm', 'number'),
  ecoli: e('Ecoli', DETECTION), salmonella: e('Salmonella', DETECTION), listeria: e('Listeria', DETECTION),
  odor: e('odor_level', ODOR_LEVELS), odor_level: e('odor_level', ODOR_LEVELS),
}

const DIAGNOSE_FLAGS: Record<string, FieldSpec> = {
  byproduct: f('byproduct_name'), byproduct_name: f('byproduct_name'),
  volume: f('monthly_volume_kg', 'number'), monthly_volume_kg: f('monthly_volume_kg', 'number'),
  cost: f('current_disposal_cost', 'number'), current_disposal_cost: f('current_disposal_cost', 'number'),
  moisture: e('moisture_level', MOISTURE_LEVELS), moisture_level: e('moisture_level', MOISTURE_LEVELS),
  odor: f('odor_issue', 'boolean'), odor_issue: f('odor_issue', 'boolean'),
}

const RDA_FLAGS: Record<string, FieldSpec> = {
  food: f('food_name'), food_name: f('food_name'),
}

const DRY_METHODS: Record<string, DryingMethodKo> = {
  hot_air: '열풍건조', hotair: '열풍건조', '열풍건조': '열풍건조', '열풍': '열풍건조',
  heat_pump: '히트펌프건조', heatpump: '히트펌프건조', '히트펌프건조': '히트펌프건조', '히트펌프': '히트펌프건조',
  freeze_dry: '동결건조', freeze: '동결건조', freezedry: '동결건조', '동결건조': '동결건조', '동결': '동결건조',
}

type RawFlag = { key: string; value: string | true }

/** 토큰을 위치 인자와 플래그로 분리. `--flag value`, `--flag=value`, bare `--flag` 지원. */
function splitFlags(tokens: string[]): { positional: string[]; flags: RawFlag[] } {
  const positional: string[] = []
  const flags: RawFlag[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.startsWith('--') && t.length > 2) {
      const body = t.slice(2)
      const eq = body.indexOf('=')
      if (eq >= 0) {
        flags.push({ key: body.slice(0, eq), value: body.slice(eq + 1) })
      } else {
        const next = tokens[i + 1]
        // 다음 토큰이 또 다른 --플래그면 bare 플래그. (음수 숫자 등은 값으로 취급)
        if (next !== undefined && !(next.startsWith('--') && next.length > 2)) {
          flags.push({ key: body, value: next })
          i++
        } else {
          flags.push({ key: body, value: true })
        }
      }
    } else {
      positional.push(t)
    }
  }
  return { positional, flags }
}

function toBool(v: string | true): boolean | null {
  if (v === true) return true
  const s = v.toLowerCase()
  if (['true', '1', 'yes', 'y', 'on', '예', '있음', '유'].includes(s)) return true
  if (['false', '0', 'no', 'n', 'off', '아니오', '없음', '무'].includes(s)) return false
  return null
}

function applyFlags(
  flags: RawFlag[], table: Record<string, FieldSpec>, cmd: string,
): { args: Record<string, unknown> } | { error: string } {
  const args: Record<string, unknown> = {}
  for (const { key, value } of flags) {
    const spec = table[key.toLowerCase()]
    if (!spec) {
      return { error: `알 수 없는 옵션: --${key} (${cmd})${hint(cmd)}` }
    }
    if (spec.type === 'boolean') {
      const b = toBool(value)
      if (b === null) return { error: `--${key} 값은 true/false 여야 합니다: ${String(value)}` }
      args[spec.name] = b
    } else if (spec.type === 'enum') {
      const vals = spec.values ?? {}
      // Ecoli 등 bare 플래그(--Ecoli)는 '검출'로 취급
      const raw = value === true ? 'true' : value
      const mapped = vals[raw.toLowerCase()] ?? vals[raw]
      if (!mapped) {
        const allowed = [...new Set(Object.values(vals))].join(' | ')
        return { error: `--${key} 값이 올바르지 않습니다: ${String(value)} (가능: ${allowed})${hint(cmd)}` }
      }
      args[spec.name] = mapped
    } else if (value === true) {
      return { error: `--${key} 에 값이 필요합니다. 예: --${key} <값>` }
    } else if (spec.type === 'number') {
      const n = Number(value)
      if (value.trim() === '' || !Number.isFinite(n)) {
        return { error: `--${key} 는 숫자여야 합니다: ${value}` }
      }
      args[spec.name] = n
    } else {
      args[spec.name] = value
    }
  }
  return { args }
}

export function parseCommandLine(input: string): ParsedCommand {
  const tokens = tokenize(input.trim())
  if (tokens === null) return { kind: 'error', message: '따옴표가 닫히지 않았습니다.' }
  if (tokens.length && tokens[0].toLowerCase() === 'byorbit') tokens.shift()
  if (tokens.length === 0) return { kind: 'error', message: `커맨드를 입력하세요.${hint()}` }

  const name = tokens[0].toLowerCase()
  const rest = tokens.slice(1)

  switch (name) {
    case 'help': case '?': case 'h':
      return { kind: 'help', topic: rest[0]?.toLowerCase() }
    case 'clear': case 'cls':
      return { kind: 'clear' }
    case 'history':
      return { kind: 'history' }

    case 'analyze': {
      const { positional, flags } = splitFlags(rest)
      if (positional.length) return { kind: 'error', message: `analyze 는 위치 인자를 받지 않습니다: ${positional[0]}${hint('analyze')}` }
      const r = applyFlags(flags, ANALYZE_FLAGS, 'analyze')
      return 'error' in r ? { kind: 'error', message: r.error } : { kind: 'api', command: 'analyze', args: r.args }
    }

    case 'diagnose': {
      const { positional, flags } = splitFlags(rest)
      if (positional.length) return { kind: 'error', message: `diagnose 는 위치 인자를 받지 않습니다: ${positional[0]}${hint('diagnose')}` }
      const r = applyFlags(flags, DIAGNOSE_FLAGS, 'diagnose')
      if ('error' in r) return { kind: 'error', message: r.error }
      if (!r.args.byproduct_name) return { kind: 'error', message: '--byproduct <부산물명> 이 필요합니다. 예: diagnose --byproduct "사과박" --volume 500' }
      return { kind: 'api', command: 'diagnose', args: r.args }
    }

    case 'rda': {
      const body = rest[0]?.toLowerCase() === 'fetch' ? rest.slice(1) : rest
      const { positional, flags } = splitFlags(body)
      const r = applyFlags(flags, RDA_FLAGS, 'rda')
      if ('error' in r) return { kind: 'error', message: r.error }
      if (!r.args.food_name && positional.length) r.args.food_name = positional.join(' ')
      if (!r.args.food_name) return { kind: 'error', message: '식품명이 필요합니다. 예: rda fetch --food "사과, 생것"' }
      return { kind: 'api', command: 'rda', args: r.args }
    }

    case 'thesaurus': {
      const q = rest.join(' ').trim()
      if (!q) return { kind: 'error', message: '검색어가 필요합니다. 예: thesaurus 사과' }
      return { kind: 'thesaurus', q }
    }

    case 'samples':
      return { kind: 'samples' }

    case 'sample': {
      if (!rest[0]) return { kind: 'error', message: '샘플 ID 가 필요합니다. 예: sample <id> (목록은 `samples`)' }
      return { kind: 'sample', id: rest[0] }
    }

    case 'dry': {
      const { positional, flags } = splitFlags(rest)
      const id = positional[0]
      if (!id) return { kind: 'error', message: '샘플 ID 가 필요합니다. 예: dry <id> --method freeze_dry --target 10' }
      let method: DryingMethodKo = '열풍건조'
      let target = 10
      for (const { key, value } of flags) {
        const k = key.toLowerCase()
        if (k === 'method') {
          if (value === true) return { kind: 'error', message: '--method 에 값이 필요합니다. (hot_air | heat_pump | freeze_dry)' }
          const m = DRY_METHODS[value.toLowerCase()] ?? DRY_METHODS[value]
          if (!m) return { kind: 'error', message: `알 수 없는 건조 방식: ${value} (hot_air | heat_pump | freeze_dry)` }
          method = m
        } else if (k === 'target') {
          const n = value === true ? NaN : Number(value)
          if (!Number.isFinite(n) || n < 0 || n >= 100) return { kind: 'error', message: `--target 은 0~100 미만의 수분(%) 숫자여야 합니다: ${String(value)}` }
          target = n
        } else {
          return { kind: 'error', message: `알 수 없는 옵션: --${key} (dry)${hint('dry')}` }
        }
      }
      return { kind: 'dry', id, method, target }
    }

    default:
      return { kind: 'error', message: `알 수 없는 커맨드: ${tokens[0]}${hint()}` }
  }
}

export const HELP_OVERVIEW: string[] = [
  'ByOrbit CLI — 사용 가능한 커맨드',
  '  analyze     부산물 업사이클 분석           (help analyze)',
  '  diagnose    부산물 처리 진단               (help diagnose)',
  '  rda         식품 영양 기준 조회            (help rda)',
  '  thesaurus   식품명 시소러스 검색           (help thesaurus)',
  '  samples     부산물 샘플 목록',
  '  sample      샘플 상세 로드                 (help sample)',
  '  dry         건조 후 영양 예측              (help dry)',
  '  history     입력 기록 보기',
  '  clear       화면 지우기 (Ctrl+L)',
  '  help        도움말 (help <커맨드>)',
  '단축키: ↑/↓ 기록 이동 · Tab 자동완성 · Ctrl+L 지우기',
]

export const HELP_TOPICS: Record<string, string[]> = {
  analyze: [
    'analyze — 부산물 업사이클 분석',
    '  옵션: --mock --byproduct --variety --region --season --drying',
    '        --TDF --TPC --moisture --fresh-moisture --pectin --protein --sugar',
    '        --Pb --Cd --As --Hg --Ecoli --Salmonella --Listeria --odor',
    '  --byproduct apple_pomace|coffee_grounds|citrus_pomace|cabbage_residue|other (사과박·커피박·감귤박·배추·기타)',
    '  --drying    none|hot_air|freeze_dry|sun_dry|spray_dry (열풍건조·동결건조·자연건조·분무건조)',
    '  --Ecoli 등  ND|DETECTED (불검출·검출) · --odor none|mild|strong',
    '  예)  analyze --mock',
    '       analyze --byproduct 사과박 --drying 열풍건조 --TDF 45.2 --TPC 12.5 --moisture 8',
  ],
  diagnose: [
    'diagnose — 부산물 처리 진단',
    '  옵션: --byproduct(필수) --volume(월 kg) --cost(현 처리비 원/kg) --moisture low|medium|high --odor',
    '  예)  diagnose --byproduct "사과박" --volume 5000 --cost 50 --moisture high --odor',
  ],
  rda: [
    'rda — 식품 영양 기준 조회',
    '  예)  rda fetch --food "사과, 생것"',
    '       rda "사과, 생것"',
  ],
  thesaurus: [
    'thesaurus — 식품명 시소러스 검색',
    '  예)  thesaurus 사과',
  ],
  samples: ['samples — 부산물 샘플 목록 (id, 이름). DB 연결 필요.'],
  sample: [
    'sample — 샘플 상세 로드',
    '  예)  sample <id>',
  ],
  dry: [
    'dry — 건조 방식별 영양 예측',
    '  옵션: --method hot_air|heat_pump|freeze_dry (열풍건조|히트펌프건조|동결건조), --target <목표 수분 %>',
    '  예)  dry <id> --method freeze_dry --target 10',
  ],
  history: ['history — 입력한 커맨드 기록을 번호와 함께 출력'],
  clear: ['clear — 터미널 출력과 결과 패널을 지웁니다 (Ctrl+L)'],
}

export function helpLines(topic?: string): string[] {
  if (!topic) return HELP_OVERVIEW
  return HELP_TOPICS[topic] ?? [`'${topic}' 에 대한 도움말이 없습니다. 'help' 로 전체 목록을 확인하세요.`]
}
