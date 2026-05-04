import fs from 'node:fs'
import path from 'node:path'
import { XMLParser } from 'fast-xml-parser'

function loadLocalEnvIfNeeded() {
  if (process.env.FLAVONOID_SERVICE_KEY || process.env.RDA_SERVICE_KEY || process.env.MFDS_SERVICE_KEY) return
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

const FLAVONOID_BASE_URL = process.env.FLAVONOID_API_URL ?? 'https://apis.data.go.kr/1390803/AgriFood/FlavonoidElement/V2'
const FLAVONOID_SERVICE_KEY = process.env.FLAVONOID_SERVICE_KEY ?? process.env.RDA_SERVICE_KEY ?? process.env.MFDS_SERVICE_KEY

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true,
})

type UnknownRecord = Record<string, unknown>

export interface FlavonoidSample {
  no: number | null
  food_id: string | null
  food_name: string | null
  source: 'rda_flavonoid'
}

export interface FlavonoidCompound {
  first_category: string | null
  first_total: number | null
  second_category: string | null
  second_total: number | null
  compound_name: string | null
  flavonoid_value: number | null
  plant_resources: string | null
  status: string | null
  molecular_formula: string | null
  molecular_weight: number | null
  used_parts: string | null
  chemical_image_url: string | null
  pattern_image_url: string | null
}

export interface FlavonoidDetail {
  food_id: string | null
  food_name: string | null
  main_image_url: string | null
  compounds: FlavonoidCompound[]
  source: 'rda_flavonoid'
}

export interface FlavonoidSampleResult {
  total: number
  page_no: number
  page_size: number
  items: FlavonoidSample[]
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

function normalizeSample(raw: UnknownRecord): FlavonoidSample {
  return {
    no:        asNumber(raw.no),
    food_id:   asString(raw.food_Id),
    food_name: asString(raw.food_Nm),
    source:    'rda_flavonoid',
  }
}

async function requestFlavonoid(operation: string, params: Record<string, string>): Promise<UnknownRecord> {
  if (!FLAVONOID_SERVICE_KEY) {
    throw new Error('FLAVONOID_SERVICE_KEY is not set')
  }

  const searchParams = new URLSearchParams({
    serviceKey: FLAVONOID_SERVICE_KEY,
    ...params,
  })

  const res = await fetch(`${FLAVONOID_BASE_URL}/${operation}?${searchParams.toString()}`, {
    headers: { Accept: 'application/xml' },
    signal:  AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`RDA Flavonoid API error: ${res.status} (${operation})`)
  }

  const xml = await res.text()
  const parsed = asRecord(parser.parse(xml))
  const response = asRecord(parsed.response)
  const header = asRecord(response.header)
  const resultCode = asString(header.result_Code)
  const resultMessage = asString(header.result_Msg)

  if (resultCode !== '200') {
    throw new Error(`RDA Flavonoid API rejected request: ${resultCode ?? 'unknown'} ${resultMessage ?? ''}`.trim())
  }

  return response
}

function flattenCompounds(rawItem: UnknownRecord): FlavonoidCompound[] {
  const compounds: FlavonoidCompound[] = []
  const firstList = asRecord(rawItem.frst_List)
  const firstNames = asArray(firstList.frst_Name)
  const firstTotals = asArray(firstList.frst_Tot)
  const firstSndLists = asArray(firstList.snd_List)
  const firstGroups = firstNames.length > 0
    ? firstNames.map((name, index) => ({
      frst_Name: name,
      frst_Tot:  firstTotals[index],
      snd_List:  firstSndLists[index],
    }))
    : asArray(rawItem.frst_List).map(asRecord)

  for (const first of firstGroups) {
    const secondGroups = asArray(asRecord(first.snd_List).item).map(asRecord)

    for (const second of secondGroups) {
      const thirdItems = asArray(asRecord(second.thd_List).item).map(asRecord)

      for (const third of thirdItems) {
        compounds.push({
          first_category:      asString(first.frst_Name),
          first_total:         asNumber(first.frst_Tot),
          second_category:     asString(second.snd_Name),
          second_total:        asNumber(second.snd_Tot),
          compound_name:       asString(third.thd_Name),
          flavonoid_value:     asNumber(third.flavo_Val),
          plant_resources:     asString(third.planet_resources),
          status:              asString(third.status),
          molecular_formula:   asString(third.molecular_Formula),
          molecular_weight:    asNumber(third.molecular_Weight),
          used_parts:          asString(third.used_Parts),
          chemical_image_url:  asString(third.chemical_Image_Url),
          pattern_image_url:   asString(third.pattern_Image_Url),
        })
      }
    }
  }

  return compounds
}

export async function getFlavonoidSamples(
  pageNo = 1,
  pageSize = 10,
): Promise<FlavonoidSampleResult> {
  const response = await requestFlavonoid('getKoreanFoodFlavonoidSampleList', {
    Page_No:   String(pageNo),
    Page_Size: String(pageSize),
  })

  const body = asRecord(response.body)
  const itemsContainer = asRecord(body.items)
  const rawItems = asArray(itemsContainer.item).map(asRecord)

  return {
    total:     asNumber(body.total_Count) ?? rawItems.length,
    page_no:   asNumber(body.page_No) ?? pageNo,
    page_size: pageSize,
    items:     rawItems.map(normalizeSample),
  }
}

export async function getFlavonoidDetail(
  sampleId: string,
  serviceType = 'D',
): Promise<FlavonoidDetail | null> {
  const response = await requestFlavonoid('getKoreanFoodFlavonoidList', {
    service_Type: serviceType,
    sample_Id:    sampleId,
  })

  const body = asRecord(response.body)
  const itemsContainer = asRecord(body.items)
  const rawItem = asArray(itemsContainer.item).map(asRecord)[0]
  if (!rawItem) return null

  return {
    food_id:        asString(rawItem.food_Id),
    food_name:      asString(rawItem.food_Nm),
    main_image_url: asString(rawItem.main_Image_Url),
    compounds:      flattenCompounds(rawItem),
    source:         'rda_flavonoid',
  }
}
