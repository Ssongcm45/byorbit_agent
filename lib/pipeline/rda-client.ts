/**
 * 농촌진흥청 국가표준식품성분정보 클라이언트 (NICS NationStdFood V2)
 *
 * serviceKey는 반드시 URLSearchParams에 넣어 URL 인코딩해야 함
 *   - Raw 삽입 (g6Bb...+IH...) → 게이트웨이 404
 *   - URLSearchParams 삽입 (g6Bb...%2BIH...) → 200 OK
 *
 * 오퍼레이션:
 *   - getKoreanFoodNationStdList     : 식품군별 목록 (301 오류 — API 키 권한 제한으로 사용 불가)
 *   - getKoreanFoodNationStdIdntList : 식품코드별 상세 (food_Code 필수) → 정상 동작
 *
 * 식품코드 조회 전략:
 *   1. FOOD_CODE_MAP (사전 확인 코드) 직접 사용
 *   2. 시소러스(food-thesaurus)에서 verified 코드 조회
 *   3. RUNTIME_CODE_CACHE (이미 검색된 코드 재사용)
 *   4. 코드 없으면 → not_found + 시소러스 기반 연관 검색어 제안
 */
import { XMLParser } from 'fast-xml-parser'
import { searchThesaurus, getSuggestionsFromThesaurus } from '@/lib/ontology/food-thesaurus'

const NICS_BASE_URL    = process.env.RDA_BASE_URL   ?? 'https://apis.data.go.kr/1390803/AgriFood/NationStdFood/V2'
const NICS_SERVICE_KEY = process.env.RDA_SERVICE_KEY

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })

export interface RDAFoodItem {
  food_code:        string | null
  food_name:        string | null
  serving_weight_g: number | null
  moisture_g:       number | null
  protein_g:        number | null
  fat_g:            number | null
  carbohydrate_g:   number | null
  sugar_g:          number | null
  dietary_fiber_g:  number | null
  calcium_mg:       number | null
  potassium_mg:     number | null
  vitamin_c_mg:     number | null
  basis:            string
  source:           string
  _search_term?:    string
  nutrients?:       Record<string, number | null>
  nutrient_units?:  Record<string, string>
}

export interface RDASearchResult {
  total:        number
  items:        RDAFoodItem[]
  status:       'ok' | 'mock' | 'not_found' | 'error'
  message?:     string
  suggestions?: string[]
  debug?:       string[]
}

// ── 사전 확인된 NICS 식품코드 ────────────────────────────────────────────────
// H0500020000a = 사과,부사,생것 (실 API 검증 완료)
// 나머지는 목록 검색(findFoodCodeByName)으로 동적 보완
const FOOD_CODE_MAP: Record<string, string> = {
  '사과, 생것':      'H0500020000a',
  '사과, 부사, 생것': 'H0500020000a',
  '사과':            'H0500020000a',
}

// 런타임 코드 캐시 (동적 탐색 결과 저장 → 중복 API 호출 방지)
const RUNTIME_CODE_CACHE = new Map<string, string>()

// ── NICS result_Code 의미 ─────────────────────────────────────────────────────
const NICS_ERROR_CODES: Record<string, string> = {
  '01':  '어플리케이션 오류',
  '10':  '잘못된 요청 변수',
  '11':  '필수 요청 변수 누락',
  '12':  '해당 오퍼레이션 미존재',
  '20':  '서비스 접근 거부',
  '21':  '일시적 사용 중지',
  '22':  '일일 트래픽 한도 초과',
  '30':  '등록되지 않은 서비스키',
  '31':  '서비스키 기간 만료',
  '32':  '등록되지 않은 IP',
  '99':  '기타 오류',
  '300': '결과 없음 (해당 식품군에 데이터 없음)',
  '301': '결과 없음 (잘못된 파라미터 또는 데이터 없음)',
}
function nicsCodeHint(code: string): string {
  return NICS_ERROR_CODES[code] ? ` (${NICS_ERROR_CODES[code]})` : ''
}

// ── 식품군 코드 테이블 (NICS fd_Grupp 추정값) ────────────────────────────────
// 식품코드 H0500020000a에서 '05' = 과실류임을 확인.
// 다른 그룹 코드는 NICS 표준 식품군 체계 기반 추정.
const GROUP_KEYWORDS: Array<{ fd_Grupp: string; keywords: string[] }> = [
  { fd_Grupp: '01', keywords: ['쌀', '밀', '보리', '옥수수', '감자', '고구마', '밀가루', '귀리'] },
  { fd_Grupp: '02', keywords: ['콩', '두부', '두유', '땅콩', '아몬드', '두류'] },
  { fd_Grupp: '03', keywords: ['배추', '시금치', '양파', '마늘', '고추', '오이', '당근', '무', '브로콜리', '상추', '깻잎', '파', '채소'] },
  { fd_Grupp: '04', keywords: ['버섯', '표고', '느타리', '송이', '팽이'] },
  { fd_Grupp: '05', keywords: ['사과', '배', '귤', '감귤', '오렌지', '포도', '딸기', '바나나', '참외', '수박', '복숭아', '자두', '과실'] },
  { fd_Grupp: '06', keywords: ['쇠고기', '돼지고기', '닭고기', '오리고기', '양고기'] },
  { fd_Grupp: '07', keywords: ['고등어', '연어', '참치', '새우', '오징어', '조개', '게', '어류'] },
  { fd_Grupp: '08', keywords: ['우유', '치즈', '요구르트', '버터', '크림', '유제품'] },
  { fd_Grupp: '09', keywords: ['참기름', '콩기름', '들기름', '올리브', '식용유'] },
  { fd_Grupp: '10', keywords: ['커피', '녹차', '홍차', '음료', '탄산', '주스'] },
  { fd_Grupp: '11', keywords: ['맥주', '소주', '막걸리', '와인', '주류'] },
  { fd_Grupp: '12', keywords: ['간장', '된장', '고추장', '소금', '식초', '조미료'] },
  { fd_Grupp: '13', keywords: ['과자', '빵', '케이크', '쿠키', '떡'] },
  { fd_Grupp: '14', keywords: ['설탕', '꿀', '시럽', '잼', '당류'] },
]

// getSuggestions → 시소러스로 위임
export { getSuggestionsFromThesaurus as getSuggestions } from '@/lib/ontology/food-thesaurus'

// ── XML 파싱 헬퍼 ─────────────────────────────────────────────────────────────
type Raw = Record<string, unknown>
const asStr = (v: unknown) => (v == null || v === '') ? null : String(v)
const asNum = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? null : n }
const asArr = <T>(v: T | T[] | undefined): T[] => v == null ? [] : Array.isArray(v) ? v : [v]
const asRec = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v)) ? v as Raw : {}

function pickNum(map: Record<string, number | null>, keys: string[]): number | null {
  for (const k of keys) if (map[k] !== undefined) return map[k]
  return null
}

// ── 이름 유사도 점수 (목록 검색 결과 정렬용) ──────────────────────────────────
function nameScore(candidate: string, query: string): number {
  const q = query.toLowerCase()
  const c = candidate.toLowerCase()
  let score = 0
  // 쿼리의 각 토큰이 후보에 포함되면 점수 부여
  for (const token of q.split(/[\s,]+/).filter(Boolean)) {
    if (c.includes(token)) score += token.length
  }
  // 완전 일치 보너스
  if (c === q) score += 100
  return score
}

// 다양한 케이스의 필드명을 시도해 식품명/코드 추출
function pickFoodName(item: Raw): string {
  return asStr(item.food_Nm) ?? asStr(item.food_nm) ?? asStr(item.foodNm) ?? asStr(item.FOOD_NM) ?? ''
}
function pickFoodCode(item: Raw): string {
  return asStr(item.food_Code) ?? asStr(item.food_code) ?? asStr(item.foodCode) ?? asStr(item.FOOD_CODE) ?? ''
}

// 쿼터 초과 등 API 오류 XML 감지
const QUOTA_STRINGS = [
  'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR',
  'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
  'NODATA_ERROR',
  'APPLICATION_ERROR',
]
function detectApiError(xml: string): string | null {
  for (const s of QUOTA_STRINGS) {
    if (xml.includes(s)) return s
  }
  return null
}

// ── NICS 식품군 목록 검색 → food_Code + 디버그 로그 반환 ──────────────────────
async function findFoodCodeByName(foodName: string): Promise<{ code: string | null; logs: string[]; candidates: string[] }> {
  const logs: string[] = []
  const allCandidateNames: string[] = []
  if (!NICS_SERVICE_KEY) return { code: null, logs: ['서비스 키 없음'], candidates: [] }

  const primaryTerm = foodName.split(',')[0].trim()

  const candidateGroups: string[] = []
  for (const { fd_Grupp, keywords } of GROUP_KEYWORDS) {
    if (keywords.some(k => primaryTerm.includes(k) || k.includes(primaryTerm))) {
      candidateGroups.push(fd_Grupp)
    }
  }
  if (candidateGroups.length === 0) {
    candidateGroups.push('05', '03', '10', '01')
  }
  logs.push(`식품군 후보: [${candidateGroups.join(', ')}]`)

  for (const fdGrupp of candidateGroups) {
    for (let page = 1; page <= 3; page++) {
      try {
        // Page_Size / page_No 가 이 API의 올바른 파라미터명
        const sp = new URLSearchParams({
          serviceKey: NICS_SERVICE_KEY,
          fd_Grupp:   fdGrupp,
          Page_Size:  '100',
          page_No:    String(page),
        })
        const url = `${NICS_BASE_URL}/getKoreanFoodNationStdList?${sp.toString()}`

        const res = await fetch(url, {
          headers: { Accept: 'application/xml' },
          cache:   'no-store',
          signal:  AbortSignal.timeout(12_000),
        })

        if (!res.ok) {
          logs.push(`그룹 ${fdGrupp} HTTP ${res.status}`)
          break
        }

        const xml = await res.text()

        const apiErr = detectApiError(xml)
        if (apiErr) {
          logs.push(`API 오류: ${apiErr}`)
          return { code: null, logs, candidates: allCandidateNames }
        }

        const parsed   = asRec(parser.parse(xml))
        const response = asRec(parsed.response)
        const header   = asRec(response.header)

        const resultCode = asStr(header.result_Code) ?? asStr(header.resultCode) ?? asStr(header.result_code) ?? ''
        if (resultCode && resultCode !== '200' && resultCode !== '00' && resultCode !== '0') {
          logs.push(`그룹 ${fdGrupp} result_Code=${resultCode}${nicsCodeHint(resultCode)}`)
          break
        }

        const body     = asRec(response.body)
        const rawItems = asArr(asRec(body.items).item).map(asRec)
        logs.push(`그룹 ${fdGrupp} p${page}: ${rawItems.length}건`)

        const scored = rawItems
          .map(item => ({
            name:  pickFoodName(item),
            code:  pickFoodCode(item),
            score: 0,
          }))
          .map(x => ({ ...x, score: nameScore(x.name, foodName) }))
          .filter(x => x.code)
          .sort((a, b) => b.score - a.score)

        // 이름 매칭 성공
        const matched = scored.filter(x => x.score > 0)
        if (matched.length > 0) {
          logs.push(`  매칭: "${matched[0].name}" → ${matched[0].code} (점수 ${matched[0].score})`)
          return { code: matched[0].code, logs, candidates: [] }
        }

        // 매칭 없음 — 실제 식품명 상위 8개 수집 (재검색 힌트용)
        const groupNames = scored.slice(0, 8).map(x => x.name).filter(Boolean)
        if (groupNames.length > 0) {
          allCandidateNames.push(...groupNames)
          logs.push(`  이름 매칭 없음 — 이 그룹 식품명 예시: ${groupNames.slice(0, 5).join(', ')}`)
        }

        const totalCount = Number(asStr(body.totalCount) ?? asStr(body.total_Count) ?? '0')
        if (rawItems.length === 0 || page * 100 >= totalCount) break

      } catch (e) {
        logs.push(`그룹 ${fdGrupp} 예외: ${String(e).slice(0, 80)}`)
        break
      }
    }
  }

  return { code: null, logs, candidates: allCandidateNames }
}

// ── 전체 성분 상세 조회 ───────────────────────────────────────────────────────
function parseNICSDetail(item: Raw): RDAFoodItem {
  const sections = asArr(asRec(item).irdnt)
  const nutrientMap: Record<string, number | null> = {}
  const unitMap: Record<string, string> = {}

  for (const sec of sections) {
    const tickets = asArr(asRec(sec).irdnttcket)
    for (const t of tickets) {
      const tr   = asRec(t)
      const name = asStr(tr.irdnt_Nm)
      if (name) {
        nutrientMap[name] = asNum(tr.cont_Info)
        const unit = asStr(tr.cont_Unt)
        if (unit) unitMap[name] = unit
      }
    }
  }

  return {
    food_code:        asStr(item.food_Code),
    food_name:        asStr(item.food_Nm),
    serving_weight_g: 100,
    moisture_g:       pickNum(nutrientMap, ['수분', 'Water']),
    protein_g:        pickNum(nutrientMap, ['단백질', 'Protein']),
    fat_g:            pickNum(nutrientMap, ['지방', 'Fat']),
    carbohydrate_g:   pickNum(nutrientMap, ['탄수화물', 'Carbohydrate']),
    sugar_g:          pickNum(nutrientMap, ['당류', 'Total sugars']),
    dietary_fiber_g:  pickNum(nutrientMap, ['총 식이섬유', 'Total Dietary Fiber', '식이섬유']),
    calcium_mg:       pickNum(nutrientMap, ['칼슘', 'Calcium']),
    potassium_mg:     pickNum(nutrientMap, ['칼륨', 'Potassium']),
    vitamin_c_mg:     pickNum(nutrientMap, ['비타민 C', 'Vitamin C']),
    basis:            'per_100g',
    source:           'nics_nation_std_food_v2',
    nutrients:        nutrientMap,
    nutrient_units:   unitMap,
  }
}

async function fetchByFoodCode(foodCode: string): Promise<RDAFoodItem | null> {
  if (!NICS_SERVICE_KEY) return null

  const sp  = new URLSearchParams({ serviceKey: NICS_SERVICE_KEY, food_Code: foodCode })
  const url = `${NICS_BASE_URL}/getKoreanFoodNationStdIdntList?${sp.toString()}`

  const res = await fetch(url, {
    headers: { Accept: 'application/xml' },
    cache:   'no-store',
    signal:  AbortSignal.timeout(10_000),
  })

  if (!res.ok) throw new Error(`NICS API ${res.status}`)

  const xml      = await res.text()
  const parsed   = asRec(parser.parse(xml))
  const response = asRec(parsed.response)
  const header   = asRec(response.header)
  if (asStr(header.result_Code) !== '200') return null

  const body  = asRec(response.body)
  const items = asRec(body.items)
  const raw   = asArr(items.item).map(asRec)[0]
  return raw ? parseNICSDetail(raw) : null
}

// ── 목 데이터 (서비스 키 미설정 시 폴백) ──────────────────────────────────────
export const MOCK_APPLE_DATA: RDAFoodItem = {
  food_code:        'H0500020000a',
  food_name:        '사과, 부사, 생것',
  serving_weight_g: 100,
  moisture_g:       85.2,
  protein_g:        0.2,
  fat_g:            0.07,
  carbohydrate_g:   14.28,
  sugar_g:          11.13,
  dietary_fiber_g:  1.7,
  calcium_mg:       4.0,
  potassium_mg:     107.0,
  vitamin_c_mg:     1.41,
  basis:            'per_100g',
  source:           'mock_nics',
  nutrients: {
    '에너지': 51.3, '수분': 85.2, '단백질': 0.2, '지방': 0.07,
    '탄수화물': 14.28, '당류': 11.13, '총 식이섬유': 1.7,
    '칼슘': 4.0, '철': 0.07, '인': 8.0, '칼륨': 107.0, '나트륨': 1.0,
    '비타민 A': 2.0, '비타민 C': 1.41, '콜레스테롤': 0.0, '포화지방산': 0.01,
  },
  nutrient_units: {
    '에너지': 'kcal',
    '수분': 'g', '단백질': 'g', '지방': 'g', '탄수화물': 'g', '당류': 'g', '총 식이섬유': 'g',
    '칼슘': 'mg', '철': 'mg', '인': 'mg', '칼륨': 'mg', '나트륨': 'mg',
    '비타민 A': 'μg RAE', '비타민 C': 'mg', '콜레스테롤': 'mg', '포화지방산': 'g',
  },
}

export const MOCK_COFFEE_DATA: RDAFoodItem = {
  food_code:        null,
  food_name:        '커피, 원두',
  serving_weight_g: 100,
  moisture_g:       11.0,
  protein_g:        13.9,
  fat_g:            14.7,
  carbohydrate_g:   56.4,
  sugar_g:          0.1,
  dietary_fiber_g:  38.5,
  calcium_mg:       116.0,
  potassium_mg:     1680.0,
  vitamin_c_mg:     0.0,
  basis:            'per_100g',
  source:           'mock_nics',
  nutrients: {
    '에너지': 331.0, '수분': 11.0, '단백질': 13.9, '지방': 14.7,
    '탄수화물': 56.4, '당류': 0.1, '총 식이섬유': 38.5,
    '칼슘': 116.0, '철': 3.5, '인': 200.0, '칼륨': 1680.0, '나트륨': 10.0,
    '나이아신': 21.0, '비타민 C': 0.0,
  },
  nutrient_units: {
    '에너지': 'kcal',
    '수분': 'g', '단백질': 'g', '지방': 'g', '탄수화물': 'g', '당류': 'g', '총 식이섬유': 'g',
    '칼슘': 'mg', '철': 'mg', '인': 'mg', '칼륨': 'mg', '나트륨': 'mg',
    '나이아신': 'mg', '비타민 C': 'mg',
  },
}

function getMockForKnownFood(term: string): RDAFoodItem | null {
  if (term.includes('커피')) return { ...MOCK_COFFEE_DATA, _search_term: term }
  if (term.includes('사과')) return { ...MOCK_APPLE_DATA, _search_term: term }
  return null
}

// ── DB 조회 (Neon food_references) ───────────────────────────────────────────
interface DBLookupResult {
  items:       RDAFoodItem[]
  suggestions: string[]
}

function rowToFoodItem(row: Record<string, unknown>): RDAFoodItem {
  const nutrients      = (row.nutrients      ?? {}) as Record<string, number | null>
  const nutrient_units = (row.nutrient_units ?? {}) as Record<string, string>
  return {
    food_code:        row.food_code as string | null,
    food_name:        row.food_name as string,
    serving_weight_g: 100,
    moisture_g:       pickNum(nutrients, ['수분', 'Water']),
    protein_g:        pickNum(nutrients, ['단백질', 'Protein']),
    fat_g:            pickNum(nutrients, ['지방', 'Fat']),
    carbohydrate_g:   pickNum(nutrients, ['탄수화물', 'Carbohydrate']),
    sugar_g:          pickNum(nutrients, ['당류', 'Total sugars']),
    dietary_fiber_g:  pickNum(nutrients, ['총 식이섬유', 'Total Dietary Fiber', '식이섬유']),
    calcium_mg:       pickNum(nutrients, ['칼슘', 'Calcium']),
    potassium_mg:     pickNum(nutrients, ['칼륨', 'Potassium']),
    vitamin_c_mg:     pickNum(nutrients, ['비타민 C', 'Vitamin C']),
    basis:            (row.basis  as string) ?? 'per_100g',
    source:           (row.source as string) ?? 'nics_v2',
    nutrients,
    nutrient_units,
  }
}

async function lookupFoodInDB(foodName: string): Promise<DBLookupResult> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return { items: [], suggestions: [] }

  try {
    const { neon: createSql } = await import('@neondatabase/serverless')
    const sql = createSql(dbUrl)

    const primaryTerm = foodName.split(',')[0].trim()
    const likePrefix  = primaryTerm + '%'
    const likeAny     = '%' + primaryTerm + '%'

    // 정확 일치 + 앞글자 매칭 → 최대 5개
    const exactRows = await sql`
      SELECT food_code, food_name, source, basis, nutrients, nutrient_units
      FROM food_references
      WHERE food_name = ${foodName}
         OR food_name ILIKE ${likePrefix}
      ORDER BY
        CASE WHEN food_name = ${foodName} THEN 0
             WHEN food_name ILIKE ${likePrefix} THEN 1
             ELSE 2 END,
        food_name
      LIMIT 5
    `

    if (exactRows.length > 0) {
      return { items: exactRows.map(r => rowToFoodItem(r as Record<string, unknown>)), suggestions: [] }
    }

    // 부분 포함 검색 (1차: 원본 검색어)
    let suggRows = await sql`
      SELECT food_name FROM food_references
      WHERE food_name ILIKE ${likeAny}
      ORDER BY food_name LIMIT 8
    `

    // 부분 포함 검색 (2차: 글자를 줄여가며 — "미역국" → "미역" 등)
    if (suggRows.length === 0 && primaryTerm.length >= 3) {
      const shortTerm = primaryTerm.slice(0, primaryTerm.length - 1)
      const likeShort = '%' + shortTerm + '%'
      suggRows = await sql`
        SELECT food_name FROM food_references
        WHERE food_name ILIKE ${likeShort}
        ORDER BY food_name LIMIT 8
      `
    }

    const suggestions = suggRows.map(r => r.food_name as string)
    return { items: [], suggestions }
  } catch {
    return { items: [], suggestions: [] }
  }
}

// ── 공개 API ──────────────────────────────────────────────────────────────────

export async function searchRDAFood(
  foodName: string,
  _pageNo    = 1,
  _numOfRows = 10,
): Promise<RDASearchResult> {
  // ── 단계 0: DB 우선 조회 ────────────────────────────────────────────────
  const { items: dbItems, suggestions: dbSuggestions } = await lookupFoodInDB(foodName)
  if (dbItems.length > 0) {
    return {
      total:   dbItems.length,
      items:   dbItems.map(item => ({ ...item, _search_term: foodName })),
      status:  'ok',
      message: `DB에서 ${dbItems.length}개 조회`,
    }
  }
  // DB에 없는 경우 — DB 제안어는 step 4 fallback에서 합산
  const dbSuggestionsFinal = dbSuggestions

  if (!NICS_SERVICE_KEY) {
    const allSuggestions = [...new Set([...dbSuggestionsFinal, ...getSuggestionsFromThesaurus(foodName)])].slice(0, 8)
    const mock = getMockForKnownFood(foodName)
    if (mock) {
      return { total: 1, items: [mock], status: 'mock', message: 'RDA_SERVICE_KEY 미설정 — 목 데이터 사용' }
    }
    return {
      total: 0, items: [], status: 'not_found',
      message: `"${foodName}" 에 해당하는 데이터를 찾을 수 없습니다`,
      suggestions: allSuggestions,
    }
  }

  // ── 단계 1a: 사전 매핑 코드로 직접 조회 ─────────────────────────────────
  const mappedCode = FOOD_CODE_MAP[foodName]
    ?? FOOD_CODE_MAP[Object.keys(FOOD_CODE_MAP).find(k => foodName.includes(k.split(',')[0].trim())) ?? '']

  if (mappedCode) {
    try {
      const item = await fetchByFoodCode(mappedCode)
      if (item) {
        return { total: 1, items: [{ ...item, _search_term: foodName }], status: 'ok' }
      }
    } catch (err) {
      if (String(err).includes('429')) {
        return { total: 0, items: [], status: 'not_found', message: 'API 할당량 초과 — 잠시 후 재시도', suggestions: getSuggestionsFromThesaurus(foodName) }
      }
    }
  }

  // ── 단계 1b: 시소러스 verified 코드로 직접 조회 ──────────────────────────
  const thesaurusEntry = searchThesaurus(foodName).find(e => e.verified && e.nics_code)
  if (thesaurusEntry?.nics_code) {
    try {
      const item = await fetchByFoodCode(thesaurusEntry.nics_code)
      if (item) {
        return { total: 1, items: [{ ...item, _search_term: foodName }], status: 'ok' }
      }
    } catch (err) {
      if (String(err).includes('429')) {
        return { total: 0, items: [], status: 'not_found', message: 'API 할당량 초과 — 잠시 후 재시도', suggestions: getSuggestionsFromThesaurus(foodName) }
      }
    }
  }

  // ── 단계 2: 런타임 캐시 확인 ────────────────────────────────────────────
  const cachedCode = RUNTIME_CODE_CACHE.get(foodName)
  if (cachedCode) {
    try {
      const item = await fetchByFoodCode(cachedCode)
      if (item) {
        return { total: 1, items: [{ ...item, _search_term: foodName }], status: 'ok' }
      }
    } catch (err) {
      if (String(err).includes('429')) {
        return { total: 0, items: [], status: 'not_found', message: 'API 할당량 초과 — 잠시 후 재시도', suggestions: getSuggestionsFromThesaurus(foodName) }
      }
    }
  }

  // ── 단계 3: 식품군 목록 검색으로 정확한 코드 탐색 ─────────────────────
  let searchLogs: string[] = []
  let searchCandidates: string[] = []
  try {
    const { code: foundCode, logs, candidates } = await findFoodCodeByName(foodName)
    searchLogs       = logs
    searchCandidates = candidates
    if (foundCode) {
      RUNTIME_CODE_CACHE.set(foodName, foundCode)
      const item = await fetchByFoodCode(foundCode)
      if (item) {
        return { total: 1, items: [{ ...item, _search_term: foodName }], status: 'ok', debug: logs }
      }
    }
  } catch (err) {
    if (String(err).includes('429')) {
      return { total: 0, items: [], status: 'not_found', message: 'API 할당량 초과 — 잠시 후 재시도', suggestions: getSuggestionsFromThesaurus(foodName) }
    }
    searchLogs.push(`searchRDAFood 예외: ${String(err).slice(0, 80)}`)
  }

  // ── 단계 4: not_found — DB 제안어 + 시소러스 + API 후보명 합산 ─────────
  const thesaurusSuggestions = getSuggestionsFromThesaurus(foodName)
  const apiCandidates = [...new Set(searchCandidates)].slice(0, 5)
  const allSuggestions = [...new Set([...dbSuggestionsFinal, ...thesaurusSuggestions, ...apiCandidates])].slice(0, 8)

  return {
    total:       0,
    items:       [],
    status:      'not_found',
    message:     `"${foodName}" 에 해당하는 데이터를 찾을 수 없습니다`,
    suggestions: allSuggestions,
    debug:       searchLogs,
  }
}

export const BYPRODUCT_RAW_MATERIAL_TERMS: Record<string, string[]> = {
  apple_pomace:    ['사과, 생것'],
  coffee_grounds:  ['커피, 원두'],
  citrus_pomace:   ['귤, 생것'],
  cabbage_residue: ['배추, 생것'],
}

export async function searchByproductSource(byproductType: string): Promise<RDAFoodItem | null> {
  const terms = BYPRODUCT_RAW_MATERIAL_TERMS[byproductType]
  if (!terms) return null
  for (const term of terms) {
    const result = await searchRDAFood(term, 1, 3)
    if (result.items.length > 0) return result.items[0]
  }
  return null
}
