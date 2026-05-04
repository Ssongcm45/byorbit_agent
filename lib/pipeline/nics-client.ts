import fs from 'node:fs'
import path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import type { RDAFoodItem } from './rda-client'

function loadLocalEnvIfNeeded() {
  if (process.env.NICS_SERVICE_KEY || process.env.RDA_SERVICE_KEY || process.env.MFDS_SERVICE_KEY) return
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

loadLocalEnvIfNeeded()

const NICS_BASE_URL = process.env.NICS_BASE_URL ?? 'https://apis.data.go.kr/1390803/AgriFood/NationStdFood/V2'
const NICS_SERVICE_KEY = process.env.NICS_SERVICE_KEY ?? process.env.RDA_SERVICE_KEY ?? process.env.MFDS_SERVICE_KEY

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
})

type UnknownRecord = Record<string, unknown>

export interface NICSFoodSummary {
  no: number | null
  food_code: string | null
  food_group: string | null
  food_name: string | null
  food_english_name: string | null
  origin_name: string | null
  exam_year: string | null
  source: 'nics_nation_std_food'
}

export interface NICSNutrient {
  section_name: string | null
  nutrient_name: string | null
  nutrient_english_name: string | null
  amount: number | null
  unit: string | null
}

export interface NICSFoodDetail extends NICSFoodSummary {
  nutrients: NICSNutrient[]
  nutrient_map: Record<string, number | null>
}

export interface NICSFoodListResult {
  total: number
  page_no: number
  page_size: number
  items: NICSFoodSummary[]
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value : [value]
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === '-') return null
  const parsed = parseFloat(String(value).replace(/,/g, ''))
  return Number.isNaN(parsed) ? null : parsed
}

function pickNumber(map: Record<string, number | null>, names: string[]): number | null {
  for (const name of names) {
    if (map[name] !== undefined) return map[name]
  }
  return null
}

function normalizeSummary(raw: UnknownRecord): NICSFoodSummary {
  return {
    no:                asNumber(raw.no),
    food_code:         asString(raw.food_Code),
    food_group:        asString(raw.food_Grupp),
    food_name:         asString(raw.food_Nm),
    food_english_name: asString(raw.food_Eng_Nm),
    origin_name:       asString(raw.origin_Nm),
    exam_year:         asString(raw.examin_Year),
    source:            'nics_nation_std_food',
  }
}

function flattenNutrients(rawItem: UnknownRecord): NICSNutrient[] {
  const sections = asArray(asRecord(rawItem).irdnt)
  const nutrients: NICSNutrient[] = []

  for (const sectionValue of sections) {
    const section = asRecord(sectionValue)
    const sectionName = asString(section.irdnt_Se_Nm)
    const tickets = asArray(section.irdnttcket)

    for (const ticketValue of tickets) {
      const ticket = asRecord(ticketValue)
      nutrients.push({
        section_name:           sectionName,
        nutrient_name:          asString(ticket.irdnt_Nm),
        nutrient_english_name:  asString(ticket.irdnt_Eng_Nm),
        amount:                 asNumber(ticket.cont_Info),
        unit:                   asString(ticket.irdnt_Unit_Nm),
      })
    }
  }

  return nutrients
}

function normalizeDetail(raw: UnknownRecord): NICSFoodDetail {
  const summary = normalizeSummary(raw)
  const nutrients = flattenNutrients(raw)
  const nutrientMap: Record<string, number | null> = {}

  for (const nutrient of nutrients) {
    if (nutrient.nutrient_name) nutrientMap[nutrient.nutrient_name] = nutrient.amount
    if (nutrient.nutrient_english_name) nutrientMap[nutrient.nutrient_english_name] = nutrient.amount
  }

  return {
    ...summary,
    nutrients,
    nutrient_map: nutrientMap,
  }
}

async function requestNICS(operation: string, params: Record<string, string>): Promise<UnknownRecord> {
  if (!NICS_SERVICE_KEY) {
    throw new Error('NICS_SERVICE_KEY is not set')
  }

  const searchParams = new URLSearchParams({
    serviceKey: NICS_SERVICE_KEY,
    ...params,
  })

  const res = await fetch(`${NICS_BASE_URL}/${operation}?${searchParams.toString()}`, {
    headers: { Accept: 'application/xml' },
    signal:  AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`NICS NationStdFood API error: ${res.status} (${operation})`)
  }

  const xml = await res.text()
  const parsed = asRecord(parser.parse(xml))
  const response = asRecord(parsed.response)
  const header = asRecord(response.header)
  const resultCode = asString(header.result_Code)
  const resultMessage = asString(header.result_Msg)

  if (resultCode !== '200') {
    throw new Error(`NICS NationStdFood API rejected request: ${resultCode ?? 'unknown'} ${resultMessage ?? ''}`.trim())
  }

  return response
}

export async function getNICSFoodList(
  fdGrupp: string,
  pageNo = 1,
  pageSize = 10,
): Promise<NICSFoodListResult> {
  const response = await requestNICS('getKoreanFoodNationStdList', {
    page_No:   String(pageNo),
    Page_Size: String(pageSize),
    fd_Grupp:  fdGrupp,
  })

  const body = asRecord(response.body)
  const itemsContainer = asRecord(body.items)
  const rawItems = asArray(itemsContainer.item).map(asRecord)

  return {
    total:     asNumber(body.total_Count) ?? rawItems.length,
    page_no:   asNumber(body.page_No) ?? pageNo,
    page_size: pageSize,
    items:     rawItems.map(normalizeSummary),
  }
}

export async function getNICSFoodDetail(foodCode: string): Promise<NICSFoodDetail | null> {
  const response = await requestNICS('getKoreanFoodNationStdIdntList', {
    food_Code: foodCode,
  })

  const body = asRecord(response.body)
  const itemsContainer = asRecord(body.items)
  const rawItem = asArray(itemsContainer.item).map(asRecord)[0]
  return rawItem ? normalizeDetail(rawItem) : null
}

export function toRDAFoodItemFromNICS(detail: NICSFoodDetail): RDAFoodItem {
  return {
    food_code:        detail.food_code,
    food_name:        detail.food_name,
    serving_weight_g: 100,
    moisture_g:       pickNumber(detail.nutrient_map, ['수분', 'Water']),
    protein_g:        pickNumber(detail.nutrient_map, ['단백질', 'Protein']),
    fat_g:            pickNumber(detail.nutrient_map, ['지방', 'Fat']),
    carbohydrate_g:   pickNumber(detail.nutrient_map, ['탄수화물', 'Carbohydrate']),
    sugar_g:          pickNumber(detail.nutrient_map, ['당류', 'Total sugars']),
    dietary_fiber_g:  pickNumber(detail.nutrient_map, ['총 식이섬유', 'Total Dietary Fiber']),
    calcium_mg:       pickNumber(detail.nutrient_map, ['칼슘', 'Calcium']),
    potassium_mg:     pickNumber(detail.nutrient_map, ['칼륨', 'Potassium']),
    vitamin_c_mg:     pickNumber(detail.nutrient_map, ['비타민 C', 'Vitamin C']),
    basis:            'per_100g',
    source:           'nics_nation_std_food',
  }
}
