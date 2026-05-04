import * as schema from './schema'

// DB는 선택적 — DATABASE_URL 없으면 null 반환
function createDb() {
  const url = process.env.DATABASE_URL
  if (!url) return null

  try {
    // 동적 import로 DB 연결 시도
    const { neon }   = require('@neondatabase/serverless') as typeof import('@neondatabase/serverless')
    const { drizzle } = require('drizzle-orm/neon-http') as typeof import('drizzle-orm/neon-http')
    return drizzle(neon(url), { schema })
  } catch {
    return null
  }
}

export const db = createDb()
export type DB = NonNullable<ReturnType<typeof createDb>>
export { schema }

export function requireDb() {
  if (!db) throw new Error('DATABASE_URL 미설정 — DB 기능 사용 불가. .env.local 설정 필요')
  return db
}
