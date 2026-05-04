import { neon } from '@neondatabase/serverless'

export async function GET() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return Response.json({ error: 'DB 미연결' }, { status: 500 })

  try {
    const sql = neon(dbUrl)
    const rows = await sql`
      SELECT
        id, sample_name, byproduct_type, base_food_code,
        extraction_method, drying_method, moisture_after_pct,
        sample_source, evaluation_date, notes, created_at
      FROM byproduct_samples
      ORDER BY created_at DESC
    `
    return Response.json(rows)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
