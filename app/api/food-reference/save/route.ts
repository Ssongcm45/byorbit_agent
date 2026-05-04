import { neon } from '@neondatabase/serverless'

interface SaveRequest {
  food_code:      string | null
  food_name:      string
  source:         string
  basis:          string
  nutrients:      Record<string, number | null>
  nutrient_units: Record<string, string>
}

export async function POST(req: Request) {
  const url = process.env.DATABASE_URL
  if (!url) {
    return Response.json({ error: 'DATABASE_URL 미설정' }, { status: 500 })
  }

  let body: SaveRequest
  try {
    body = await req.json() as SaveRequest
  } catch {
    return Response.json({ error: '잘못된 요청 형식' }, { status: 400 })
  }

  if (!body.food_name) {
    return Response.json({ error: 'food_name 필수' }, { status: 400 })
  }

  try {
    const sql = neon(url)

    // food_code 있으면 코드 기준 upsert, 없으면 food_name 기준 upsert
    const result = body.food_code
      ? await sql`
          INSERT INTO food_references (food_code, food_name, source, basis, nutrients, nutrient_units)
          VALUES (
            ${body.food_code},
            ${body.food_name},
            ${body.source ?? 'nics_v2'},
            ${body.basis ?? 'per_100g'},
            ${JSON.stringify(body.nutrients)}::jsonb,
            ${JSON.stringify(body.nutrient_units)}::jsonb
          )
          ON CONFLICT (food_code) DO UPDATE SET
            food_name      = EXCLUDED.food_name,
            source         = EXCLUDED.source,
            basis          = EXCLUDED.basis,
            nutrients      = EXCLUDED.nutrients,
            nutrient_units = EXCLUDED.nutrient_units,
            saved_at       = NOW()
          RETURNING id, food_code, food_name, saved_at
        `
      : await sql`
          INSERT INTO food_references (food_code, food_name, source, basis, nutrients, nutrient_units)
          VALUES (
            NULL,
            ${body.food_name},
            ${body.source ?? 'nics_v2'},
            ${body.basis ?? 'per_100g'},
            ${JSON.stringify(body.nutrients)}::jsonb,
            ${JSON.stringify(body.nutrient_units)}::jsonb
          )
          ON CONFLICT DO NOTHING
          RETURNING id, food_code, food_name, saved_at
        `

    const nutrientCount = Object.keys(body.nutrients).filter(
      k => body.nutrients[k] !== null
    ).length

    return Response.json({
      ok:             true,
      id:             result[0].id,
      food_name:      result[0].food_name,
      nutrient_count: nutrientCount,
      saved_at:       result[0].saved_at,
    })
  } catch (err) {
    console.error('[food-reference/save]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
