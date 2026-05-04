/**
 * 식품 시소러스 (Food Thesaurus)
 *
 * 구조:
 *  - canonical_ko : 표준 한국어명 (시스템 기준명)
 *  - synonyms     : 동의어 — 같은 식품을 다르게 부르는 표현
 *  - related      : 관련어 — 다른 품종·조리·가공 형태
 *  - hypernym     : 상위 식품군
 *  - nics_code    : 농진청 NICS DB 확인된 코드 (verified=true 인 경우만 API 직접 조회 사용)
 *  - nics_name    : NICS DB에서의 공식 명칭 (조회 시 우선 사용)
 *  - search_tags  : 검색 키워드 (초성·영문·발음 등)
 *
 * verified 플래그 의미:
 *  true  = 실제 API 응답으로 코드 확인 완료
 *  false = 명칭만 알고 있으며 코드는 미확인
 */

export interface ThesaurusEntry {
  id:          string
  canonical_ko: string
  synonyms:    string[]
  related:     string[]
  hypernym:    string
  hyponyms:    string[]
  nics_code?:  string
  nics_name?:  string
  verified:    boolean
  search_tags: string[]
}

export const FOOD_THESAURUS: ThesaurusEntry[] = [
  // ── 과실류 ────────────────────────────────────────────────────────────────
  {
    id: 'apple',
    canonical_ko: '사과',
    synonyms:  ['능금', '苹果'],
    related:   ['사과주스', '사과식초', '사과잼', '건사과'],
    hypernym:  '과실류',
    hyponyms:  ['부사', '홍로', '후지', '아오리', '감홍', '홍옥'],
    nics_code: 'H0500020000a',
    nics_name: '사과, 부사, 생것',
    verified:  true,
    search_tags: ['apple', '사과', '능금'],
  },
  {
    id: 'pear',
    canonical_ko: '배',
    synonyms:  ['梨'],
    related:   ['배즙', '배술', '배잼'],
    hypernym:  '과실류',
    hyponyms:  ['신고', '황금배', '원황', '추황배'],
    nics_name: '배, 신고, 생것',
    verified:  false,
    search_tags: ['pear', '배', '신고배'],
  },
  {
    id: 'tangerine',
    canonical_ko: '귤',
    synonyms:  ['감귤', '온주밀감', 'みかん'],
    related:   ['귤즙', '귤껍질', '제주감귤'],
    hypernym:  '과실류',
    hyponyms:  ['온주밀감', '한라봉', '천혜향', '레드향'],
    nics_name: '귤, 생것',
    verified:  false,
    search_tags: ['tangerine', '귤', '감귤', '제주귤'],
  },
  {
    id: 'strawberry',
    canonical_ko: '딸기',
    synonyms:  ['草莓'],
    related:   ['딸기잼', '딸기주스', '건딸기'],
    hypernym:  '과실류',
    hyponyms:  ['설향', '매향', '죽향', '육보'],
    nics_name: '딸기, 생것',
    verified:  false,
    search_tags: ['strawberry', '딸기'],
  },
  {
    id: 'grape',
    canonical_ko: '포도',
    synonyms:  ['葡萄'],
    related:   ['포도주스', '포도주', '건포도', '포도씨오일'],
    hypernym:  '과실류',
    hyponyms:  ['거봉', '캠벨', '머루포도', '샤인머스캣'],
    nics_name: '포도, 거봉, 생것',
    verified:  false,
    search_tags: ['grape', '포도', '거봉'],
  },
  {
    id: 'watermelon',
    canonical_ko: '수박',
    synonyms:  ['西瓜'],
    related:   ['수박주스', '수박화채'],
    hypernym:  '과실류',
    hyponyms:  [],
    nics_name: '수박, 생것',
    verified:  false,
    search_tags: ['watermelon', '수박'],
  },
  {
    id: 'peach',
    canonical_ko: '복숭아',
    synonyms:  ['桃', '도자기'],
    related:   ['복숭아주스', '복숭아잼', '황도통조림'],
    hypernym:  '과실류',
    hyponyms:  ['백도', '황도', '천중도', '미황'],
    nics_name: '복숭아, 생것',
    verified:  false,
    search_tags: ['peach', '복숭아', '황도', '백도'],
  },
  {
    id: 'persimmon',
    canonical_ko: '감',
    synonyms:  ['柿', '시감'],
    related:   ['곶감', '감식초', '연시'],
    hypernym:  '과실류',
    hyponyms:  ['단감', '떫은감', '홍시'],
    nics_name: '감, 단감, 생것',
    verified:  false,
    search_tags: ['persimmon', '감', '단감', '곶감'],
  },
  {
    id: 'banana',
    canonical_ko: '바나나',
    synonyms:  ['香蕉'],
    related:   ['바나나칩', '바나나주스'],
    hypernym:  '과실류',
    hyponyms:  [],
    nics_name: '바나나, 생것',
    verified:  false,
    search_tags: ['banana', '바나나'],
  },
  {
    id: 'kiwi',
    canonical_ko: '키위',
    synonyms:  ['참다래', '다래'],
    related:   ['키위주스'],
    hypernym:  '과실류',
    hyponyms:  ['골든키위', '그린키위'],
    nics_name: '키위, 생것',
    verified:  false,
    search_tags: ['kiwi', '키위', '참다래'],
  },
  {
    id: 'oriental-melon',
    canonical_ko: '참외',
    synonyms:  ['甛瓜'],
    related:   ['참외주스'],
    hypernym:  '과실류',
    hyponyms:  ['성환참외', '금싸라기참외'],
    nics_name: '참외, 생것',
    verified:  false,
    search_tags: ['melon', '참외'],
  },
  {
    id: 'blueberry',
    canonical_ko: '블루베리',
    synonyms:  ['蓝莓'],
    related:   ['블루베리잼', '건블루베리'],
    hypernym:  '과실류',
    hyponyms:  [],
    nics_name: '블루베리, 생것',
    verified:  false,
    search_tags: ['blueberry', '블루베리'],
  },

  // ── 채소류 ────────────────────────────────────────────────────────────────
  {
    id: 'napa-cabbage',
    canonical_ko: '배추',
    synonyms:  ['결구배추', '통배추', '포기배추', '白菜'],
    related:   ['절임배추', '배추김치', '배추겉절이'],
    hypernym:  '채소류',
    hyponyms:  ['얼갈이배추', '쌈배추', '봄배추'],
    nics_name: '배추, 생것',
    verified:  false,
    search_tags: ['napa cabbage', '배추', 'chinese cabbage', 'baechu'],
  },
  {
    id: 'radish',
    canonical_ko: '무',
    synonyms:  ['蘿蔔', '라복'],
    related:   ['깍두기', '무생채', '열무'],
    hypernym:  '채소류',
    hyponyms:  ['열무', '총각무', '단무지'],
    nics_name: '무, 생것',
    verified:  false,
    search_tags: ['radish', '무', '단무지', '열무'],
  },
  {
    id: 'spinach',
    canonical_ko: '시금치',
    synonyms:  ['菠薐菜', '파릉채'],
    related:   ['시금치나물', '데친시금치'],
    hypernym:  '채소류',
    hyponyms:  [],
    nics_name: '시금치, 생것',
    verified:  false,
    search_tags: ['spinach', '시금치'],
  },
  {
    id: 'carrot',
    canonical_ko: '당근',
    synonyms:  ['胡蘿蔔', '홍당무'],
    related:   ['당근주스', '당근나물', '당근케이크'],
    hypernym:  '채소류',
    hyponyms:  [],
    nics_name: '당근, 생것',
    verified:  false,
    search_tags: ['carrot', '당근', '홍당무'],
  },
  {
    id: 'onion',
    canonical_ko: '양파',
    synonyms:  ['洋蔥'],
    related:   ['양파볶음', '피클링크', '양파즙'],
    hypernym:  '채소류',
    hyponyms:  ['자색양파', '봄양파'],
    nics_name: '양파, 생것',
    verified:  false,
    search_tags: ['onion', '양파'],
  },
  {
    id: 'garlic',
    canonical_ko: '마늘',
    synonyms:  ['大蒜', '다산'],
    related:   ['마늘장아찌', '흑마늘', '마늘분말'],
    hypernym:  '채소류',
    hyponyms:  ['남해마늘', '의성마늘', '통마늘'],
    nics_name: '마늘, 생것',
    verified:  false,
    search_tags: ['garlic', '마늘'],
  },
  {
    id: 'green-onion',
    canonical_ko: '파',
    synonyms:  ['대파', '大葱'],
    related:   ['쪽파', '실파', '파김치'],
    hypernym:  '채소류',
    hyponyms:  ['대파', '쪽파', '실파'],
    nics_name: '파, 생것',
    verified:  false,
    search_tags: ['green onion', '파', '대파', '쪽파'],
  },
  {
    id: 'red-pepper',
    canonical_ko: '고추',
    synonyms:  ['唐辛子', '당초'],
    related:   ['고춧가루', '고추장', '건고추', '청양고추'],
    hypernym:  '채소류',
    hyponyms:  ['홍고추', '청고추', '청양고추', '꽈리고추'],
    nics_name: '고추, 홍고추, 생것',
    verified:  false,
    search_tags: ['chili', '고추', '홍고추', '청고추'],
  },
  {
    id: 'cucumber',
    canonical_ko: '오이',
    synonyms:  ['黃瓜'],
    related:   ['오이소박이', '오이무침', '피클'],
    hypernym:  '채소류',
    hyponyms:  ['취청오이', '백오이'],
    nics_name: '오이, 생것',
    verified:  false,
    search_tags: ['cucumber', '오이'],
  },
  {
    id: 'potato',
    canonical_ko: '감자',
    synonyms:  ['馬鈴薯', '마령서'],
    related:   ['감자칩', '감자전분', '감자전'],
    hypernym:  '채소류',
    hyponyms:  ['수미', '대지', '두백'],
    nics_name: '감자, 생것',
    verified:  false,
    search_tags: ['potato', '감자'],
  },
  {
    id: 'sweet-potato',
    canonical_ko: '고구마',
    synonyms:  ['甘藷', '감저'],
    related:   ['고구마말랭이', '고구마전분', '고구마줄기'],
    hypernym:  '채소류',
    hyponyms:  ['밤고구마', '호박고구마', '자색고구마'],
    nics_name: '고구마, 생것',
    verified:  false,
    search_tags: ['sweet potato', '고구마'],
  },
  {
    id: 'broccoli',
    canonical_ko: '브로콜리',
    synonyms:  ['緑花椰菜'],
    related:   ['브로콜리나물'],
    hypernym:  '채소류',
    hyponyms:  [],
    nics_name: '브로콜리, 생것',
    verified:  false,
    search_tags: ['broccoli', '브로콜리'],
  },
  {
    id: 'tomato',
    canonical_ko: '토마토',
    synonyms:  ['番茄'],
    related:   ['토마토주스', '토마토소스', '방울토마토'],
    hypernym:  '채소류',
    hyponyms:  ['방울토마토', '대추방울'],
    nics_name: '토마토, 생것',
    verified:  false,
    search_tags: ['tomato', '토마토'],
  },
  {
    id: 'perilla',
    canonical_ko: '깻잎',
    synonyms:  ['紫蘇葉', '자소엽'],
    related:   ['깻잎장아찌', '깻잎김치'],
    hypernym:  '채소류',
    hyponyms:  [],
    nics_name: '깻잎, 생것',
    verified:  false,
    search_tags: ['perilla', '깻잎', '자소'],
  },
  {
    id: 'lettuce',
    canonical_ko: '상추',
    synonyms:  ['萵苣', '와거'],
    related:   ['쌈채소'],
    hypernym:  '채소류',
    hyponyms:  ['청상추', '적상추', '로메인'],
    nics_name: '상추, 생것',
    verified:  false,
    search_tags: ['lettuce', '상추'],
  },
  {
    id: 'bean-sprout',
    canonical_ko: '콩나물',
    synonyms:  ['大豆芽菜'],
    related:   ['콩나물국', '콩나물무침'],
    hypernym:  '채소류',
    hyponyms:  [],
    nics_name: '콩나물, 생것',
    verified:  false,
    search_tags: ['bean sprout', '콩나물'],
  },

  // ── 버섯류 ────────────────────────────────────────────────────────────────
  {
    id: 'shiitake',
    canonical_ko: '표고버섯',
    synonyms:  ['향고', '椎茸', '표고'],
    related:   ['건표고', '표고분말'],
    hypernym:  '버섯류',
    hyponyms:  ['생표고', '건표고'],
    nics_name: '표고버섯, 생것',
    verified:  false,
    search_tags: ['shiitake', '표고', '표고버섯'],
  },
  {
    id: 'oyster-mushroom',
    canonical_ko: '느타리버섯',
    synonyms:  ['平茸'],
    related:   ['느타리볶음'],
    hypernym:  '버섯류',
    hyponyms:  [],
    nics_name: '느타리버섯, 생것',
    verified:  false,
    search_tags: ['oyster mushroom', '느타리'],
  },
  {
    id: 'enoki',
    canonical_ko: '팽이버섯',
    synonyms:  ['金針菇'],
    related:   [],
    hypernym:  '버섯류',
    hyponyms:  [],
    nics_name: '팽이버섯, 생것',
    verified:  false,
    search_tags: ['enoki', '팽이', '팽이버섯'],
  },

  // ── 곡류 ────────────────────────────────────────────────────────────────
  {
    id: 'rice',
    canonical_ko: '쌀',
    synonyms:  ['멥쌀', '백미', '米'],
    related:   ['현미', '찹쌀', '밥', '떡'],
    hypernym:  '곡류',
    hyponyms:  ['멥쌀', '찹쌀', '현미', '흑미'],
    nics_name: '쌀, 멥쌀, 생것',
    verified:  false,
    search_tags: ['rice', '쌀', '백미', '현미'],
  },
  {
    id: 'barley',
    canonical_ko: '보리',
    synonyms:  ['大麥'],
    related:   ['보리차', '보리밥', '맥주'],
    hypernym:  '곡류',
    hyponyms:  ['겉보리', '쌀보리', '찰보리'],
    nics_name: '보리, 생것',
    verified:  false,
    search_tags: ['barley', '보리'],
  },
  {
    id: 'corn',
    canonical_ko: '옥수수',
    synonyms:  ['玉蜀黍', '강냉이'],
    related:   ['팝콘', '옥수수전분', '옥수수기름'],
    hypernym:  '곡류',
    hyponyms:  ['찰옥수수', '단옥수수'],
    nics_name: '옥수수, 생것',
    verified:  false,
    search_tags: ['corn', '옥수수', '강냉이'],
  },

  // ── 두류 ────────────────────────────────────────────────────────────────
  {
    id: 'soybean',
    canonical_ko: '콩',
    synonyms:  ['大豆', '대두'],
    related:   ['두부', '두유', '된장', '간장', '콩기름'],
    hypernym:  '두류',
    hyponyms:  ['백태', '서리태', '청태', '쥐눈이콩'],
    nics_name: '대두, 생것',
    verified:  false,
    search_tags: ['soybean', '콩', '대두'],
  },
  {
    id: 'tofu',
    canonical_ko: '두부',
    synonyms:  ['豆腐'],
    related:   ['순두부', '연두부', '두부조림'],
    hypernym:  '두류',
    hyponyms:  ['순두부', '연두부', '찌개용두부'],
    nics_name: '두부, 생것',
    verified:  false,
    search_tags: ['tofu', '두부'],
  },
  {
    id: 'peanut',
    canonical_ko: '땅콩',
    synonyms:  ['落花生', '낙화생'],
    related:   ['땅콩버터', '땅콩기름'],
    hypernym:  '두류',
    hyponyms:  [],
    nics_name: '땅콩, 볶은것',
    verified:  false,
    search_tags: ['peanut', '땅콩', '낙화생'],
  },

  // ── 육류 ────────────────────────────────────────────────────────────────
  {
    id: 'beef',
    canonical_ko: '소고기',
    synonyms:  ['쇠고기', '牛肉'],
    related:   ['갈비', '불고기', '육회'],
    hypernym:  '육류',
    hyponyms:  ['등심', '안심', '채끝', '목심', '사태', '양지', '갈비'],
    nics_name: '쇠고기, 등심, 생것',
    verified:  false,
    search_tags: ['beef', '소고기', '쇠고기', '한우'],
  },
  {
    id: 'pork',
    canonical_ko: '돼지고기',
    synonyms:  ['猪肉'],
    related:   ['삼겹살', '목살', '제육볶음'],
    hypernym:  '육류',
    hyponyms:  ['삼겹살', '목살', '등심', '앞다리', '뒷다리'],
    nics_name: '돼지고기, 삼겹살, 생것',
    verified:  false,
    search_tags: ['pork', '돼지고기', '삼겹살'],
  },
  {
    id: 'chicken',
    canonical_ko: '닭고기',
    synonyms:  ['鷄肉'],
    related:   ['치킨', '삼계탕', '닭갈비'],
    hypernym:  '육류',
    hyponyms:  ['가슴살', '다리살', '날개', '안심'],
    nics_name: '닭고기, 가슴살, 생것',
    verified:  false,
    search_tags: ['chicken', '닭', '닭고기'],
  },

  // ── 어패류 ───────────────────────────────────────────────────────────────
  {
    id: 'mackerel',
    canonical_ko: '고등어',
    synonyms:  ['鯖魚'],
    related:   ['고등어구이', '고등어조림', '고등어통조림'],
    hypernym:  '어패류',
    hyponyms:  [],
    nics_name: '고등어, 생것',
    verified:  false,
    search_tags: ['mackerel', '고등어'],
  },
  {
    id: 'salmon',
    canonical_ko: '연어',
    synonyms:  ['鮭魚'],
    related:   ['훈제연어', '연어초밥'],
    hypernym:  '어패류',
    hyponyms:  ['대서양연어', '태평양연어'],
    nics_name: '연어, 생것',
    verified:  false,
    search_tags: ['salmon', '연어'],
  },
  {
    id: 'tuna',
    canonical_ko: '참치',
    synonyms:  ['다랑어', '마구로'],
    related:   ['참치통조림', '참치회'],
    hypernym:  '어패류',
    hyponyms:  [],
    nics_name: '참치, 생것',
    verified:  false,
    search_tags: ['tuna', '참치', '다랑어'],
  },
  {
    id: 'shrimp',
    canonical_ko: '새우',
    synonyms:  ['蝦'],
    related:   ['건새우', '새우젓', '새우튀김'],
    hypernym:  '어패류',
    hyponyms:  ['대하', '보리새우', '흰다리새우'],
    nics_name: '새우, 생것',
    verified:  false,
    search_tags: ['shrimp', '새우'],
  },

  // ── 유제품·달걀 ──────────────────────────────────────────────────────────
  {
    id: 'milk',
    canonical_ko: '우유',
    synonyms:  ['牛乳'],
    related:   ['저지방우유', '무지방우유'],
    hypernym:  '유제품',
    hyponyms:  ['전지유', '저지방유', '무지방유'],
    nics_name: '우유, 일반',
    verified:  false,
    search_tags: ['milk', '우유'],
  },
  {
    id: 'egg',
    canonical_ko: '달걀',
    synonyms:  ['계란', '鷄卵'],
    related:   ['삶은달걀', '달걀프라이', '달걀찜'],
    hypernym:  '달걀류',
    hyponyms:  [],
    nics_name: '달걀, 생것',
    verified:  false,
    search_tags: ['egg', '달걀', '계란'],
  },

  // ── 음료 ─────────────────────────────────────────────────────────────────
  {
    id: 'coffee',
    canonical_ko: '커피',
    synonyms:  ['Coffee', '珈琲'],
    related:   ['아메리카노', '에스프레소', '커피원두', '원두커피'],
    hypernym:  '음료류',
    hyponyms:  ['아라비카', '로부스타', '블렌드'],
    nics_name: '커피, 원두',
    verified:  false,
    search_tags: ['coffee', '커피', '아메리카노', '에스프레소'],
  },
  {
    id: 'green-tea',
    canonical_ko: '녹차',
    synonyms:  ['綠茶'],
    related:   ['말차', '녹차음료', '녹차아이스크림'],
    hypernym:  '음료류',
    hyponyms:  [],
    nics_name: '녹차, 우린것',
    verified:  false,
    search_tags: ['green tea', '녹차', '말차'],
  },
]

// ── 검색 함수 ─────────────────────────────────────────────────────────────────

/** 쿼리와 매칭되는 엔트리 반환 (정확→부분→태그 순) */
export function searchThesaurus(query: string): ThesaurusEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const exact:   ThesaurusEntry[] = []
  const partial: ThesaurusEntry[] = []
  const tagged:  ThesaurusEntry[] = []

  for (const entry of FOOD_THESAURUS) {
    const haystack = [
      entry.canonical_ko,
      ...entry.synonyms,
      ...entry.search_tags,
    ].map(s => s.toLowerCase())

    if (haystack.includes(q) || entry.canonical_ko.toLowerCase() === q) {
      exact.push(entry)
    } else if (haystack.some(s => s.includes(q) || q.includes(s))) {
      partial.push(entry)
    } else if (entry.search_tags.some(t => t.toLowerCase().includes(q))) {
      tagged.push(entry)
    }
  }

  return [...exact, ...partial, ...tagged]
}

/** 쿼리에 대한 연관 검색어 제안 (NICS 조회용 명칭 중심) */
export function getSuggestionsFromThesaurus(query: string): string[] {
  const matches = searchThesaurus(query)
  const suggestions: string[] = []

  for (const entry of matches.slice(0, 3)) {
    if (entry.nics_name) suggestions.push(entry.nics_name)
    for (const rel of entry.related.slice(0, 2)) suggestions.push(rel)
    for (const hypo of entry.hyponyms.slice(0, 2)) suggestions.push(hypo)
  }

  return [...new Set(suggestions)].slice(0, 8)
}

/** 검증된 NICS 코드가 있는 엔트리만 반환 */
export function getVerifiedEntry(query: string): ThesaurusEntry | null {
  return searchThesaurus(query).find(e => e.verified && e.nics_code) ?? null
}
