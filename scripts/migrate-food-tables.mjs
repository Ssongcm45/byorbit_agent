/**
 * Neon DB 마이그레이션: food_references + byproduct_samples
 * 실행: node scripts/migrate-food-tables.mjs
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const envFile = readFileSync('.env.local', 'utf-8')
const url = envFile.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim()

if (!url) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const sql = neon(url)

const statements = [
  `DO $$ BEGIN
     CREATE TYPE extraction_method AS ENUM ('none', '분쇄', '미생물', '효소', '용매추출', '압착');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,

  `CREATE TABLE IF NOT EXISTS food_references (
     id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
     food_code      VARCHAR(100) UNIQUE,
     food_name      VARCHAR(300) NOT NULL,
     source         VARCHAR(100) NOT NULL DEFAULT 'nics_v2',
     basis          VARCHAR(50)  NOT NULL DEFAULT 'per_100g',
     nutrients      JSONB        NOT NULL DEFAULT '{}',
     nutrient_units JSONB        NOT NULL DEFAULT '{}',
     saved_at       TIMESTAMPTZ           DEFAULT NOW()
   )`,

  `CREATE INDEX IF NOT EXISTS food_references_name_idx ON food_references (food_name)`,
  `CREATE INDEX IF NOT EXISTS food_references_code_idx ON food_references (food_code)`,

  `CREATE TABLE IF NOT EXISTS byproduct_samples (
     id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
     sample_name        VARCHAR(300) NOT NULL,
     byproduct_type     VARCHAR(50)  NOT NULL,
     base_food_code     VARCHAR(100) REFERENCES food_references(food_code),
     coa_batch_id       VARCHAR(100),
     drying_method      VARCHAR(50)  DEFAULT 'none',
     extraction_method  VARCHAR(50)  DEFAULT 'none',
     drying_temp_c      REAL,
     drying_time_min    REAL,
     particle_size_um   REAL,
     moisture_after_pct REAL,
     nutrients          JSONB NOT NULL DEFAULT '{}',
     nutrient_units     JSONB NOT NULL DEFAULT '{}',
     retention_factors  JSONB         DEFAULT '{}',
     lab_name           VARCHAR(200),
     analysis_date      VARCHAR(20),
     notes              TEXT,
     created_at         TIMESTAMPTZ DEFAULT NOW()
   )`,

  `CREATE INDEX IF NOT EXISTS byproduct_samples_type_idx       ON byproduct_samples (byproduct_type)`,
  `CREATE INDEX IF NOT EXISTS byproduct_samples_base_food_idx  ON byproduct_samples (base_food_code)`,
  `CREATE INDEX IF NOT EXISTS byproduct_samples_drying_idx     ON byproduct_samples (drying_method)`,
  `CREATE INDEX IF NOT EXISTS byproduct_samples_extraction_idx ON byproduct_samples (extraction_method)`,
]

try {
  console.log('Neon DB에 연결 중...')
  for (const stmt of statements) {
    await sql.query(stmt)
  }
  console.log('✅ 마이그레이션 완료!')
  console.log('   - food_references 테이블 생성')
  console.log('   - byproduct_samples 테이블 생성')

  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `
  console.log('\n현재 테이블 목록:')
  tables.forEach(t => console.log(`  • ${t.tablename}`))
} catch (err) {
  console.error('❌ 마이그레이션 실패:', err.message)
  process.exit(1)
}
