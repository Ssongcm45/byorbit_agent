import { searchThesaurus, getSuggestionsFromThesaurus } from '@/lib/ontology/food-thesaurus'
import type { ThesaurusEntry } from '@/lib/ontology/food-thesaurus'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()

  if (!q) {
    return Response.json({ error: 'q 파라미터 필요' }, { status: 400 })
  }

  const matches      = searchThesaurus(q)
  const suggestions  = getSuggestionsFromThesaurus(q)
  const exact        = matches[0] ?? null

  const result = {
    query:       q,
    exact:       exact ? formatEntry(exact) : null,
    related:     matches.slice(1, 4).map(formatEntry),
    suggestions,
    api_status:  exact?.verified
      ? 'verified'    // NICS 코드 확인됨 — 직접 조회 가능
      : matches.length > 0
        ? 'candidate'  // 시소러스 엔트리 있음 — 코드 미확인
        : 'unknown',   // 시소러스에 없음
  }

  return Response.json(result)
}

function formatEntry(e: ThesaurusEntry) {
  return {
    id:           e.id,
    canonical_ko: e.canonical_ko,
    synonyms:     e.synonyms,
    related:      e.related,
    hypernym:     e.hypernym,
    hyponyms:     e.hyponyms,
    nics_name:    e.nics_name ?? null,
    nics_code:    e.nics_code ?? null,
    verified:     e.verified,
  }
}
