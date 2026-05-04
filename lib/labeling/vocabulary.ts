// 통제어 사전 (Controlled Vocabulary)
// DB vocab_terms 테이블과 동기화

export const COMPONENT_VOCAB: Record<string, string[]> = {
  TDF:             ['식이섬유', '총식이섬유', 'dietary fiber', 'TDF', '조섬유'],
  TPC:             ['총폴리페놀', 'polyphenol', 'TPC', '폴리페놀 함량', 'GAE'],
  pectin:          ['펙틴', 'pectin', '수용성 식이섬유'],
  protein:         ['조단백', '단백질', 'crude protein'],
  sugar:           ['당', '환원당', '총당류', 'sugar'],
  fat:             ['조지방', '지방', 'crude fat'],
  moisture:        ['수분', 'moisture', '함수율'],
  lignocellulose:  ['리그노셀룰로오스', 'lignocellulose', '리그닌', '셀룰로오스'],
  oil:             ['커피 오일', 'coffee oil', '오일 함량'],
  glucosinolate:   ['글루코시놀레이트', 'glucosinolate', '글루코시놀'],
}

export const BYPRODUCT_SYNONYMS: Record<string, string[]> = {
  apple_pomace:     ['사과박', '사과 착즙박', '사과 찌꺼기', '주스 짜고 남은 것', '애플 포마스'],
  coffee_grounds:   ['커피박', '커피 찌꺼기', '커피 추출 잔류물', '사용된 커피 원두'],
  citrus_pomace:    ['감귤박', '감귤 착즙박', '제주 감귤박', '오렌지 포마스'],
  cabbage_residue:  ['배추 부산물', '배추 외엽', '배추 뿌리', '김치 폐기물'],
}

export function normalizeMaterialName(name: string): string | undefined {
  const lower = name.toLowerCase().trim()
  for (const [key, synonyms] of Object.entries(BYPRODUCT_SYNONYMS)) {
    if (synonyms.some((s) => lower.includes(s.toLowerCase()))) return key
  }
  return undefined
}

export function normalizeComponentName(name: string): string | undefined {
  const lower = name.toLowerCase().trim()
  for (const [key, synonyms] of Object.entries(COMPONENT_VOCAB)) {
    if (synonyms.some((s) => lower.includes(s.toLowerCase()))) return key
  }
  return undefined
}
