import { neon } from '@neondatabase/serverless'

export async function POST(req: Request) {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return Response.json({})

  let names: string[]
  try {
    const body = await req.json() as { names: string[] }
    names = body.names ?? []
  } catch {
    return Response.json({})
  }

  if (names.length === 0) return Response.json({})

  try {
    const sql = neon(dbUrl)

    // 각 검색어의 주요어(첫 번째 토큰)로 prefix 매칭
    // "사과, 생것" → "사과%" → "사과, 부사, 생것" 히트
    const result: Record<string, boolean> = {}
    await Promise.all(names.map(async (name) => {
      const primaryTerm = name.split(',')[0].trim()
      const rows = await sql`
        SELECT 1 FROM food_references
        WHERE food_name = ${name}
           OR food_name ILIKE ${primaryTerm + '%'}
        LIMIT 1
      `
      result[name] = rows.length > 0
    }))

    return Response.json(result)
  } catch {
    const result: Record<string, boolean> = {}
    for (const name of names) result[name] = false
    return Response.json(result)
  }
}
