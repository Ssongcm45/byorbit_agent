/**
 * NICS 식품성분 DB v10.4 Excel → food_references 임포트
 * 사용: node scripts/import-nics-excel.mjs
 */
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

// .env.local 파싱
for (const line of readFileSync(join(__dirname, '../.env.local'), 'utf-8').split('\n')) {
  const eq = line.indexOf('=')
  if (eq > 0) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
}

const { neon } = require('@neondatabase/serverless')
const XLSX = require('xlsx')

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)
const EXCEL_PATH = join(__dirname, '../dataset/2026-05-04_koreanfoodrda.xlsx')
const TX_BATCH = 30  // 한 트랜잭션당 30개 쿼리

async function main() {
  console.log('📂 엑셀 파일 읽는 중...')
  const wb = XLSX.readFile(EXCEL_PATH)

  // 부록1 → index → food_code 매핑
  const app1rows = XLSX.utils.sheet_to_json(wb.Sheets['부록1)식품코드 연계표'], { header: 1, defval: '' })
  const codeMap = {}
  for (let i = 4; i < app1rows.length; i++) {
    const idx = app1rows[i][0], code = app1rows[i][1]
    if (idx && code) codeMap[idx] = code
  }

  // 메인 데이터 시트 파싱
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['국가표준식품성분 Database 10.4'], { header: 1, defval: null })
  const h0 = rows[0], h1 = rows[1], unitRow = rows[2]

  const colNames = h1.map((n, i) => {
    if (!n) return (typeof h0[i] === 'string') ? h0[i].trim() : null
    return String(n).replace(/\r\n/g, ' ').trim()
  })

  const nutrientCols = []
  for (let i = 5; i < colNames.length; i++) {
    if (colNames[i]) nutrientCols.push({ idx: i, name: colNames[i], unit: unitRow[i] ?? null })
  }

  const nutrientUnits = {}
  for (const { name, unit } of nutrientCols) {
    if (unit) nutrientUnits[name] = unit
  }

  const records = []
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    const idx = row[0], foodName = row[3]
    if (!idx || !foodName) continue

    const nutrients = {}
    for (const { idx: ci, name } of nutrientCols) {
      const val = row[ci]
      if (val !== null && val !== '') nutrients[name] = val
    }

    records.push({
      food_code: codeMap[idx] ?? null,
      food_name: String(foodName).trim(),
      source:    row[4] ? `nics_excel_v10.4:${String(row[4]).trim()}` : 'nics_excel_v10.4',
      nutrients,
      nutrient_units: nutrientUnits,
    })
  }

  console.log(`✅ 파싱 완료: ${records.length}개 레코드, 성분 ${nutrientCols.length}개`)

  // neon transaction 배치 upsert
  let inserted = 0, updated = 0, errors = 0

  for (let start = 0; start < records.length; start += TX_BATCH) {
    const batch = records.slice(start, start + TX_BATCH)

    const queries = batch.map(r => {
      const n  = JSON.stringify(r.nutrients)
      const nu = JSON.stringify(r.nutrient_units)

      if (r.food_code) {
        return sql`
          INSERT INTO food_references (food_code, food_name, source, basis, nutrients, nutrient_units)
          VALUES (${r.food_code}, ${r.food_name}, ${r.source}, 'per_100g', ${n}::jsonb, ${nu}::jsonb)
          ON CONFLICT (food_code) DO UPDATE
            SET food_name      = EXCLUDED.food_name,
                source         = EXCLUDED.source,
                nutrients      = EXCLUDED.nutrients,
                nutrient_units = EXCLUDED.nutrient_units,
                saved_at       = now()
          RETURNING (xmax = 0) AS is_new
        `
      } else {
        return sql`
          INSERT INTO food_references (food_name, source, basis, nutrients, nutrient_units)
          VALUES (${r.food_name}, ${r.source}, 'per_100g', ${n}::jsonb, ${nu}::jsonb)
          ON CONFLICT DO NOTHING
          RETURNING (xmax = 0) AS is_new
        `
      }
    })

    try {
      const results = await sql.transaction(queries)
      for (const res of results) {
        if (res.length === 0) { /* ON CONFLICT DO NOTHING — skipped */ }
        else if (res[0]?.is_new) inserted++
        else updated++
      }
    } catch (e) {
      // 배치 실패 시 개별 재시도
      for (const r of batch) {
        try {
          const n  = JSON.stringify(r.nutrients)
          const nu = JSON.stringify(r.nutrient_units)
          if (r.food_code) {
            const res = await sql`
              INSERT INTO food_references (food_code, food_name, source, basis, nutrients, nutrient_units)
              VALUES (${r.food_code}, ${r.food_name}, ${r.source}, 'per_100g', ${n}::jsonb, ${nu}::jsonb)
              ON CONFLICT (food_code) DO UPDATE
                SET food_name = EXCLUDED.food_name, source = EXCLUDED.source,
                    nutrients = EXCLUDED.nutrients, nutrient_units = EXCLUDED.nutrient_units, saved_at = now()
              RETURNING (xmax = 0) AS is_new
            `
            if (res[0]?.is_new) inserted++; else updated++
          } else {
            const res = await sql`
              INSERT INTO food_references (food_name, source, basis, nutrients, nutrient_units)
              VALUES (${r.food_name}, ${r.source}, 'per_100g', ${n}::jsonb, ${nu}::jsonb)
              ON CONFLICT DO NOTHING RETURNING id
            `
            if (res.length > 0) inserted++
          }
        } catch (e2) {
          console.error(`\n❌ ${r.food_name}: ${e2.message}`)
          errors++
        }
      }
    }

    const done = start + batch.length
    const pct  = Math.round((done / records.length) * 100)
    process.stdout.write(`\r  진행: ${done}/${records.length} (${pct}%) | ✨${inserted} 🔄${updated} ❌${errors}  `)
  }

  console.log('\n\n=== 임포트 완료 ===')
  console.log(`  신규 삽입: ${inserted}`)
  console.log(`  갱신:      ${updated}`)
  console.log(`  오류:      ${errors}`)

  const total = await sql`SELECT COUNT(*) FROM food_references`
  console.log(`\n📦 food_references 전체: ${total[0].count}행`)

  const apple = await sql`
    SELECT food_code, food_name, nutrients->>'에너지' AS energy
    FROM food_references WHERE food_code = 'H0500020000a'
  `
  if (apple.length > 0) {
    console.log(`✅ 사과 확인: ${apple[0].food_name} (에너지: ${apple[0].energy}kcal)`)
  }

  // 샘플 5개 확인
  const samples = await sql`
    SELECT food_code, food_name, source FROM food_references
    WHERE source LIKE 'nics_excel%' LIMIT 5
  `
  console.log('\n샘플:')
  for (const s of samples) console.log(`  ${s.food_code ?? '(no code)'} | ${s.food_name}`)
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1) })
