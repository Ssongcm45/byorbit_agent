import { neon } from '@neondatabase/serverless'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return Response.json({ error: 'DB 미연결' }, { status: 500 })

  const { id } = await params

  try {
    const sql = neon(dbUrl)

    // 부산물 샘플 조회
    const rows = await sql`
      SELECT * FROM byproduct_samples WHERE id = ${id} LIMIT 1
    `
    if (rows.length === 0) return Response.json({ error: '샘플 없음' }, { status: 404 })
    const sample = rows[0]

    // 원물 참조 데이터 매칭
    let rawReference = null
    if (sample.base_food_code) {
      const refs = await sql`
        SELECT food_code, food_name, nutrients, nutrient_units, source, saved_at
        FROM food_references
        WHERE food_code = ${sample.base_food_code as string}
        LIMIT 1
      `
      if (refs.length > 0) rawReference = refs[0]
    }

    // 원물 대비 보존율 계산 (nutrients가 둘 다 있을 때)
    let retentionFactors: Record<string, number | null> = {}
    if (rawReference?.nutrients && sample.nutrients) {
      const rawN = rawReference.nutrients as Record<string, number | null>
      const sampleN = sample.nutrients as Record<string, number | null>
      for (const [key, sampleVal] of Object.entries(sampleN)) {
        const rawVal = rawN[key]
        if (sampleVal !== null && rawVal !== null && rawVal !== 0 && rawVal !== undefined) {
          retentionFactors[key] = Math.round((sampleVal / rawVal) * 1000) / 1000
        } else {
          retentionFactors[key] = null
        }
      }
    }

    return Response.json({
      ...sample,
      raw_reference: rawReference,
      retention_factors: retentionFactors,
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
