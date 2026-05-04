/**
 * 마이그레이션: byproduct_samples 안전/농약 컬럼 추가 + 사과박 샘플 삽입
 * 실행: node scripts/migrate-byproduct-safety.mjs
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env.local', 'utf-8')
const url = envFile.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim()
if (!url) { console.error('DATABASE_URL not found'); process.exit(1) }

const sql = neon(url)

// ── 1. 컬럼 추가 ──────────────────────────────────────────────────────────────
const alterStatements = [
  `ALTER TABLE byproduct_samples ADD COLUMN IF NOT EXISTS sample_source    VARCHAR(300)`,
  `ALTER TABLE byproduct_samples ADD COLUMN IF NOT EXISTS evaluation_date  VARCHAR(20)`,
  `ALTER TABLE byproduct_samples ADD COLUMN IF NOT EXISTS safety_metals    JSONB DEFAULT '{}'`,
  `ALTER TABLE byproduct_samples ADD COLUMN IF NOT EXISTS safety_mycotoxins JSONB DEFAULT '{}'`,
  `ALTER TABLE byproduct_samples ADD COLUMN IF NOT EXISTS safety_microbiology JSONB DEFAULT '{}'`,
  `ALTER TABLE byproduct_samples ADD COLUMN IF NOT EXISTS pesticide_detected JSONB DEFAULT '{}'`,
  `ALTER TABLE byproduct_samples ADD COLUMN IF NOT EXISTS pesticide_nd      JSONB DEFAULT '[]'`,
]

// ── 2. 사과박 데이터 ─────────────────────────────────────────────────────────
// 무기질: mg/kg → mg/100g (÷10) 변환하여 NICS 원물(mg/100g 기준)과 비교 가능
const nutrients = {
  // 일반성분 (% = g/100g)
  '탄수화물': 20.07, '단백질': 0.99, '지방': 0.90,
  '수분': 77.57,     '회분': 0.47,
  // 식이섬유
  'TDF': 10.41, 'IDF+HMWSDF': 9.62, 'LMWSDF': 0.79,
  // 무기질 (mg/kg ÷ 10 → mg/100g)
  '칼슘': 23.58, '나트륨': 2.65,  '인': 19.87,
  '구리': 0.098, '망간': 0.198, '칼륨': 193.3,
  '마그네슘': 13.29, '철': 0.98, '아연': 0.42,
  // 비타민 (mg/100g, 불검출=null)
  '비타민A': null, '비타민D': null, '비타민E': 0.14,
  '비타민B1': null, '비타민B2': 0.01, '비타민B6': null,
  '비타민B12': 0.00134, '비타민C': null, '나이아신': null, '베타카로틴': null,
}

const nutrientUnits = {
  '탄수화물': 'g/100g', '단백질': 'g/100g', '지방': 'g/100g',
  '수분': 'g/100g', '회분': 'g/100g',
  'TDF': 'g/100g', 'IDF+HMWSDF': 'g/100g', 'LMWSDF': 'g/100g',
  '칼슘': 'mg/100g', '나트륨': 'mg/100g', '인': 'mg/100g',
  '구리': 'mg/100g', '망간': 'mg/100g', '칼륨': 'mg/100g',
  '마그네슘': 'mg/100g', '철': 'mg/100g', '아연': 'mg/100g',
  '비타민A': 'mg/100g', '비타민D': 'mg/100g', '비타민E': 'mg/100g',
  '비타민B1': 'mg/100g', '비타민B2': 'mg/100g', '비타민B6': 'mg/100g',
  '비타민B12': 'mg/100g', '비타민C': 'mg/100g', '나이아신': 'mg/100g', '베타카로틴': 'mg/100g',
}

// 중금속 (모두 불검출)
const safetyMetals = {
  '납':     { nd: true, unit: 'mg/kg', values: [null, null] },
  '카드뮴': { nd: true, unit: 'mg/kg', values: [null, null] },
  '비소':   { nd: true, unit: 'mg/kg', values: [null, null] },
  '수은':   { nd: true, unit: 'mg/kg', values: [null, null] },
}

// 곰팡이독소 (모두 불검출)
const safetyMycotoxins = {
  '총아플라톡신(B1+B2+G1+G2)': { nd: true, unit: 'μg/kg', values: [null, null] },
  '아플라톡신B1': { nd: true, unit: 'μg/kg', values: [null, null] },
  '아플라톡신B2': { nd: true, unit: 'μg/kg', values: [null, null] },
  '아플라톡신G1': { nd: true, unit: 'μg/kg', values: [null, null] },
  '아플라톡신G2': { nd: true, unit: 'μg/kg', values: [null, null] },
  '아플라톡신A':  { nd: true, unit: 'μg/kg', values: [null, null] },
}

// 미생물 (n=5, 3회 측정)
const safetyMicrobiology = {
  '세균수':         { mean: 260,  values: [260, 196, 192], unit: 'cfu/g', n: 5, limit: 100000 },
  '대장균군':       { mean: 0,    values: [0, 0, 0],       unit: 'cfu/g', n: 5, limit: 0 },
  '대장균':         { mean: 0,    values: [0, 0, 0],       unit: 'cfu/g', n: 5, limit: 0 },
  '진균수':         { mean: 4300, values: [4300, 3500, 1200], unit: 'cfu/g' },
  '장출혈성대장균': { result: '음성', values: ['음성', '음성', '음성'], unit: '-', n: 5 },
}

// 잔류농약 — 검출항목
const pesticideDetected = {
  'Bifenthrin':          { mean: 0.11, values: [0.11, 0.09],   unit: 'mg/kg' },
  'Boscalid':            { mean: 0.01, values: [null, null],    unit: 'mg/kg' },
  'Cyhalothrin':         { mean: 0.05, values: [0.03, 0.04],   unit: 'mg/kg' },
  'Deltamethrin':        { mean: 0.02, values: [0.03, 0.03],   unit: 'mg/kg' },
  'Difenoconazole':      { mean: 0.08, values: [0.07, 0.07],   unit: 'mg/kg' },
  'Fenpropathrin':       { mean: 0.02, values: [0.02, 0.03],   unit: 'mg/kg' },
  'Indoxacarb':          { mean: 0.01, values: [null, 0.02],    unit: 'mg/kg' },
  'Iprodione':           { mean: 0.08, values: [0.08, 0.08],   unit: 'mg/kg' },
  'Propiconazole':       { mean: 0.03, values: [0.03, 0.03],   unit: 'mg/kg' },
  'Spiromesifen':        { mean: 0.02, values: [0.01, 0.01],   unit: 'mg/kg' },
  'Tebuconazole':        { mean: 0.36, values: [0.33, 0.28],   unit: 'mg/kg' },
  'Trifloxystrobin':     { mean: 0.06, values: [0.10, 0.08],   unit: 'mg/kg' },
  'Acetamiprid':         { mean: 0.03, values: [0.03, 0.02],   unit: 'mg/kg' },
  'Carbendazim':         { mean: 0.57, values: [0.50, 0.54],   unit: 'mg/kg' },
  'Chlorantraniliprole': { mean: 0.04, values: [0.04, 0.03],   unit: 'mg/kg' },
  'Diflubenzuron':       { mean: 0.08, values: [0.13, 0.12],   unit: 'mg/kg' },
  'Dinotefuran':         { mean: 0.03, values: [0.03, 0.03],   unit: 'mg/kg' },
  'Flutriafol':          { mean: 0.08, values: [0.07, 0.05],   unit: 'mg/kg' },
  'Lufenuron':           { mean: 0.05, values: [0.05, 0.02],   unit: 'mg/kg' },
  'Methoxyfenozide':     { mean: 0.04, values: [0.05, 0.04],   unit: 'mg/kg' },
  'Propargite':          { mean: 0.20, values: [0.15, 0.13],   unit: 'mg/kg' },
  'Pyraclostrobin':      { mean: 0.22, values: [0.24, 0.18],   unit: 'mg/kg' },
}

// 잔류농약 — 불검출 목록
const pesticideNd = [
  '2,6-DIPN','Acetochlor','Atrazine','Bupirimate','Buprofezin','Butachlor','Carboxin',
  'Chlorfenapyr','Chlorothalonil','Chlorpyrifos','Chlorpyrifos-methyl','Cycloprothrin',
  'Cypermethrin','Cyprodinil','DDT','Diazinon','Dicofol','Dimethomorph','Diniconazole',
  'Diphenylamine','Endosulfan','Ethion','Ethofumesate','Fenitrothion','Fenvalerate',
  'Fipronil','Flucythrinate','Isoprocarb','Isoprothiolane','Metalaxyl','Methidathion',
  'Ortho-phenyl phenol','Oxadiazon','Oxyfluorfen','Pacloburazol','Permethrin','Phenthoate',
  'Piperonyl butoxide','Pirimiphos-metyl','Prochloraz','Procymidone','Prothiofos',
  'Quinalphos','Quintozene','Tolclofos-methyl','Triadimefon','Triadimenol','Tri-allate',
  'Triazophos','Azoxystrobin','Carbaryl','Carbofuran','Chlorobenzuron','Clothianidin',
  'Cymozanil','Cyproconazole','Dichlorvos','Dimethoate','Diuron','Famoxadone',
  'Flubendiamide','Fludioxonil','Hexaconazole','Hexaflumuron','Imazalil','Imidacloprid',
  'Linuron','Malathion','Mandipropamid','Metamitron','Methamidophos','Methiocarb',
  'Methomyl','Metoninostrobin','Nitenpyram','Omethoate','Phenmedipham','Propamocarb',
  'Pyriproxyfen','Spinosad','spirodiclofen','Tebufenozide','Thiabendazole','Thiacloprid',
  'Thiamethoxam','Tolfenpyrad','Tricyclazole','Triflumuron',
]

try {
  console.log('1. 컬럼 추가 중...')
  for (const stmt of alterStatements) {
    await sql.query(stmt)
  }
  console.log('   ✅ 컬럼 추가 완료')

  console.log('2. 사과박 샘플 삽입 중...')
  const result = await sql`
    INSERT INTO byproduct_samples (
      sample_name, byproduct_type, base_food_code,
      extraction_method, moisture_after_pct,
      nutrients, nutrient_units,
      sample_source, evaluation_date,
      safety_metals, safety_mycotoxins, safety_microbiology,
      pesticide_detected, pesticide_nd,
      notes
    ) VALUES (
      '충북원예농협 사과박 착즙',
      'apple_pomace',
      'H0500020000a',
      '압착',
      77.57,
      ${JSON.stringify(nutrients)}::jsonb,
      ${JSON.stringify(nutrientUnits)}::jsonb,
      '충북원예농협',
      '2024',
      ${JSON.stringify(safetyMetals)}::jsonb,
      ${JSON.stringify(safetyMycotoxins)}::jsonb,
      ${JSON.stringify(safetyMicrobiology)}::jsonb,
      ${JSON.stringify(pesticideDetected)}::jsonb,
      ${JSON.stringify(pesticideNd)}::jsonb,
      '품질·안전 평가 완료. 잔류농약 22종 검출(기준치 이내), 중금속·곰팡이독소 전항목 불검출.'
    )
    ON CONFLICT DO NOTHING
    RETURNING id, sample_name
  `

  if (result.length > 0) {
    console.log(`   ✅ 삽입 완료: ${result[0].sample_name} (id: ${result[0].id})`)
  } else {
    console.log('   ⚠️  이미 존재하는 데이터 (CONFLICT)')
  }

  // 전체 목록 확인
  const samples = await sql`SELECT id, sample_name, byproduct_type, created_at FROM byproduct_samples ORDER BY created_at DESC`
  console.log('\n현재 byproduct_samples:')
  samples.forEach(s => console.log(`  • [${s.byproduct_type}] ${s.sample_name} (${s.id})`))

} catch (err) {
  console.error('❌ 실패:', err.message)
  process.exit(1)
}
