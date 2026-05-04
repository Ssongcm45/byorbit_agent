/**
 * 대장균/대장균군 미생물 데이터 수정
 * limit:0 방식 → result:'음성' 방식으로 변경 (식품공전 "음성" 기준 준수)
 * 실행: node scripts/fix-microbiology-result.mjs
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env.local', 'utf-8')
const url = envFile.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim()
if (!url) { console.error('DATABASE_URL not found'); process.exit(1) }

const sql = neon(url)

// 현재 데이터 확인
const rows = await sql`
  SELECT id, sample_name, safety_microbiology
  FROM byproduct_samples
  WHERE byproduct_type = 'apple_pomace'
`

console.log('현재 safety_microbiology:')
rows.forEach(r => {
  console.log(`\n[${r.sample_name}]`)
  console.log(JSON.stringify(r.safety_microbiology, null, 2))
})

// 수정: 대장균/대장균군 → result:'음성' 방식
const updatedMicro = {
  '세균수':         { mean: 260,  values: [260, 196, 192], unit: 'cfu/g', limit: 100000 },
  '대장균군':       { result: '음성', values: [0, 0, 0],   unit: 'cfu/g' },
  '대장균':         { result: '음성', values: [0, 0, 0],   unit: 'cfu/g' },
  '진균수':         { mean: 4300, values: [4300, 3500, 1200], unit: 'cfu/g' },
  '장출혈성대장균': { result: '음성', values: ['음성', '음성', '음성'], unit: '-' },
}

for (const row of rows) {
  await sql`
    UPDATE byproduct_samples
    SET safety_microbiology = ${JSON.stringify(updatedMicro)}::jsonb
    WHERE id = ${row.id}
  `
  console.log(`\n✅ 업데이트 완료: ${row.sample_name} (${row.id})`)
}

// 결과 확인
const updated = await sql`
  SELECT safety_microbiology FROM byproduct_samples WHERE byproduct_type = 'apple_pomace'
`
console.log('\n수정 후:')
console.log(JSON.stringify(updated[0]?.safety_microbiology, null, 2))
