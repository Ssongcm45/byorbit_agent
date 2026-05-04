export async function GET(req: Request) {
  const key  = process.env.RDA_SERVICE_KEY
  const base = process.env.RDA_BASE_URL ?? 'https://apis.data.go.kr/1390803/AgriFood/NationStdFood/V2'
  const { searchParams } = new URL(req.url)
  const op      = searchParams.get('op')      ?? 'list'
  const fdGrupp = searchParams.get('fd_Grupp') ?? '03'
  const foodCode = searchParams.get('food_Code') ?? ''

  if (!key) return Response.json({ error: 'no key' })

  let url: string
  if (op === 'detail' && foodCode) {
    const sp = new URLSearchParams({ serviceKey: key, food_Code: foodCode })
    url = `${base}/getKoreanFoodNationStdIdntList?${sp.toString()}`
  } else {
    const sp = new URLSearchParams({ serviceKey: key, fd_Grupp: fdGrupp, numOfRows: '5', pageNo: '1' })
    url = `${base}/getKoreanFoodNationStdList?${sp.toString()}`
  }

  try {
    const res  = await fetch(url, { headers: { Accept: 'application/xml' }, cache: 'no-store', signal: AbortSignal.timeout(12_000) })
    const text = await res.text()
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (e) {
    return Response.json({ error: String(e) })
  }
}
