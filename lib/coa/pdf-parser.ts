import type { CoAFormData } from './schema'

export interface ParsedCoAResult {
  fields: Partial<CoAFormData>
  confidence: number
  raw_markdown: string
  warnings: string[]
}

function extractNumber(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const value = parseFloat(match[1].replace(/,/g, ''))
      if (!Number.isNaN(value)) return value
    }
  }
  return undefined
}

function extractText(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return undefined
}

function extractDetection(text: string, name: RegExp): 'ND' | 'DETECTED' | undefined {
  const windowMatch = text.match(new RegExp(`${name.source}.{0,80}`, 'i'))
  const scope = windowMatch?.[0] ?? text
  if (/detected|positive|검출/i.test(scope)) return 'DETECTED'
  if (/ND|not\s*detected|negative|불검출/i.test(scope)) return 'ND'
  return undefined
}

function extractFields(markdown: string): Partial<CoAFormData> {
  const t = markdown
  const fields: Partial<CoAFormData> = {}

  const tdf = extractNumber(t, [/TDF[^\d]*(\d+\.?\d*)/i, /dietary\s*fiber[^\d]*(\d+\.?\d*)\s*g/i, /식이섬유[^\d]*(\d+\.?\d*)\s*g/i])
  if (tdf !== undefined) fields.TDF_g_per_100g = tdf

  const tpc = extractNumber(t, [/TPC[^\d]*(\d+\.?\d*)/i, /polyphenol[^\d]*(\d+\.?\d*)\s*mg/i, /GAE[^\d]*(\d+\.?\d*)/i])
  if (tpc !== undefined) fields.TPC_mgGAE_per_g = tpc

  const pectin = extractNumber(t, [/pectin[^\d]*(\d+\.?\d*)\s*g/i, /펙틴[^\d]*(\d+\.?\d*)\s*g/i])
  if (pectin !== undefined) fields.pectin_g_per_100g = pectin

  const protein = extractNumber(t, [/protein[^\d]*(\d+\.?\d*)\s*g/i, /crude\s*protein[^\d]*(\d+\.?\d*)/i, /단백질[^\d]*(\d+\.?\d*)\s*g/i])
  if (protein !== undefined) fields.protein_g_per_100g = protein

  const sugar = extractNumber(t, [/sugar[^\d]*(\d+\.?\d*)\s*g/i, /당류[^\d]*(\d+\.?\d*)\s*g/i])
  if (sugar !== undefined) fields.sugar_g_per_100g = sugar

  const fat = extractNumber(t, [/fat[^\d]*(\d+\.?\d*)\s*g/i, /crude\s*fat[^\d]*(\d+\.?\d*)/i, /지방[^\d]*(\d+\.?\d*)\s*g/i])
  if (fat !== undefined) fields.fat_g_per_100g = fat

  const moisture = extractNumber(t, [/moisture[^\d]*(\d+\.?\d*)\s*%/i, /수분[^\d]*(\d+\.?\d*)\s*%/i])
  if (moisture !== undefined) fields.dry_moisture_pct = moisture

  const pb = extractNumber(t, [/Pb[^\d]*(\d+\.?\d*)\s*ppm/i, /lead[^\d]*(\d+\.?\d*)/i])
  if (pb !== undefined) fields.Pb_ppm = pb
  const cd = extractNumber(t, [/Cd[^\d]*(\d+\.?\d*)\s*ppm/i, /cadmium[^\d]*(\d+\.?\d*)/i])
  if (cd !== undefined) fields.Cd_ppm = cd
  const asValue = extractNumber(t, [/As[^\d]*(\d+\.?\d*)\s*ppm/i, /arsenic[^\d]*(\d+\.?\d*)/i])
  if (asValue !== undefined) fields.As_ppm = asValue
  const hg = extractNumber(t, [/Hg[^\d]*(\d+\.?\d*)\s*ppm/i, /mercury[^\d]*(\d+\.?\d*)/i])
  if (hg !== undefined) fields.Hg_ppm = hg

  fields.Ecoli = extractDetection(t, /E[.\s]*coli|대장균/i) ?? fields.Ecoli
  fields.Salmonella = extractDetection(t, /salmonella|살모넬라/i) ?? fields.Salmonella
  fields.Listeria = extractDetection(t, /listeria|리스테리아/i) ?? fields.Listeria

  const aerobic = extractNumber(t, [/aerobic[^\d]*(\d+)\s*CFU/i, /일반세균[^\d]*(\d+)\s*CFU/i])
  if (aerobic !== undefined) fields.total_aerobic_CFU_g = aerobic

  if (/hot\s*air|열풍|히트펌프/i.test(t)) fields.drying_method = 'hot_air'
  else if (/freeze|동결/i.test(t)) fields.drying_method = 'freeze_dry'
  else if (/spray|분무/i.test(t)) fields.drying_method = 'spray_dry'
  else if (/sun\s*dry|태양|일광/i.test(t)) fields.drying_method = 'sun_dry'

  const lab = extractText(t, [/laboratory[:\s]*([^\n]+)/i, /분석\s*기관[:\s]*([^\n]+)/i])
  if (lab) fields.lab = lab.substring(0, 100)

  const measuredAt = extractText(t, [/analysis\s*date[:\s]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i, /분석일[:\s]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i])
  if (measuredAt) fields.measured_at = measuredAt

  const ph = extractNumber(t, [/pH[^\d]*(\d+\.?\d*)/i])
  if (ph !== undefined) fields.ph = ph

  return fields
}

const REQUIRED_FIELDS: (keyof CoAFormData)[] = ['TDF_g_per_100g', 'TPC_mgGAE_per_g', 'dry_moisture_pct', 'Pb_ppm', 'Cd_ppm', 'Ecoli']

export async function parseCoAPDF(buffer: ArrayBuffer): Promise<ParsedCoAResult> {
  const warnings: string[] = []
  const { parsePdf } = await import('kordoc')
  const result = await parsePdf(buffer)

  if (!result.success) {
    return { fields: {}, confidence: 0, raw_markdown: '', warnings: ['PDF parsing failed'] }
  }

  if (result.warnings?.length) warnings.push(...result.warnings.map(w => w.message))
  const fields = extractFields(result.markdown)
  const extracted = REQUIRED_FIELDS.filter(f => fields[f] !== undefined).length
  return { fields, confidence: extracted / REQUIRED_FIELDS.length, raw_markdown: result.markdown, warnings }
}

export async function parseCoAPDFFile(filePath: string): Promise<ParsedCoAResult> {
  const { readFileSync } = await import('fs')
  const buf = readFileSync(filePath)
  return parseCoAPDF(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
}
