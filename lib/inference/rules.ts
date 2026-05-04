import type {
  ByproductRules,
  ByproductRule,
  RuleCondition,
  RuleResult,
  InferenceOutput,
  ExtendedCoAData,
} from './types'

const HEAVY_METAL_LIMITS = {
  Pb_ppm: 0.2,
  Cd_ppm: 0.1,
  As_ppm: 0.3,
  Hg_ppm: 0.05,
} as const

function isHeavyMetalsOk(form: ExtendedCoAData): boolean {
  const { Pb_ppm, Cd_ppm, As_ppm, Hg_ppm } = form
  if (Pb_ppm !== undefined && Pb_ppm > HEAVY_METAL_LIMITS.Pb_ppm) return false
  if (Cd_ppm !== undefined && Cd_ppm > HEAVY_METAL_LIMITS.Cd_ppm) return false
  if (As_ppm !== undefined && As_ppm > HEAVY_METAL_LIMITS.As_ppm) return false
  if (Hg_ppm !== undefined && Hg_ppm > HEAVY_METAL_LIMITS.Hg_ppm) return false
  return true
}

function isMicrobialOk(form: ExtendedCoAData): boolean {
  return form.Ecoli !== 'DETECTED' && form.Salmonella !== 'DETECTED' && form.Listeria !== 'DETECTED'
}

function isCoaComplete(form: ExtendedCoAData): boolean {
  return (
    form.TDF_g_per_100g !== undefined &&
    form.TPC_mgGAE_per_g !== undefined &&
    form.Pb_ppm !== undefined &&
    form.Cd_ppm !== undefined &&
    form.Ecoli !== undefined
  )
}

function getFieldValue(
  form: ExtendedCoAData,
  field: string,
  derivedValues: Record<string, boolean>,
): number | string | boolean | undefined {
  if (field in derivedValues) return derivedValues[field]
  return (form as unknown as Record<string, unknown>)[field] as number | string | boolean | undefined
}

function evaluateSingleCondition(
  condition: RuleCondition,
  form: ExtendedCoAData,
  derivedValues: Record<string, boolean>,
): { pass: boolean; flag?: { field: string; level: 'warning' | 'critical'; message: string } } {
  const rawValue = getFieldValue(form, condition.field, derivedValues)
  const flag = condition.flag

  if (rawValue === undefined || rawValue === null) {
    return {
      pass: false,
      ...(flag ? { flag: { field: condition.field, level: flag, message: `${condition.field} is missing` } } : {}),
    }
  }

  let pass = false
  switch (condition.operator) {
    case 'gte': pass = (rawValue as number) >= (condition.threshold ?? 0); break
    case 'lte': pass = (rawValue as number) <= (condition.threshold ?? 0); break
    case 'lt':  pass = (rawValue as number) <  (condition.threshold ?? 0); break
    case 'gt':  pass = (rawValue as number) >  (condition.threshold ?? 0); break
    case 'eq':  pass = rawValue === condition.value; break
    case 'neq': pass = rawValue !== condition.value; break
  }

  if (!pass && flag) {
    return {
      pass,
      flag: { field: condition.field, level: flag, message: `${condition.field} condition not met` },
    }
  }
  return { pass }
}

function evaluateRule(
  code: 'R1' | 'R2' | 'R3' | 'R4' | 'R5',
  rule: ByproductRule,
  form: ExtendedCoAData,
  derivedValues: Record<string, boolean>,
): RuleResult {
  const flags: RuleResult['flags'] = []
  const details: string[] = []
  let passCount = 0
  let hasOrLogic = false
  let orPassCount = 0

  for (const cond of rule.conditions) {
    const { pass, flag } = evaluateSingleCondition(cond, form, derivedValues)

    if (cond.logic === 'OR') {
      hasOrLogic = true
      if (pass) orPassCount++
    } else {
      if (pass) passCount++
    }

    if (flag) flags.push(flag)
    details.push(`${cond.field}: ${pass ? 'pass' : 'fail'}`)
  }

  const nonOrConditions = rule.conditions.filter((c) => c.logic !== 'OR')
  const nonOrPass = nonOrConditions.length === 0 || passCount === nonOrConditions.length
  const orPass = !hasOrLogic || orPassCount > 0

  let pass = nonOrPass && orPass
  if (code === 'R3') {
    pass = flags.filter((f) => f.level === 'critical').length === 0
  }

  const confidence: RuleResult['confidence'] =
    flags.some((f) => f.level === 'critical') ? 'low' :
    flags.some((f) => f.level === 'warning')  ? 'medium' : 'high'

  const action = pass
    ? (rule.pass_action ?? `${rule.name} conditions met`)
    : (rule.fail_action ?? `${rule.name} conditions not met`)

  return { code, name: rule.name, pass, confidence, flags, action, details }
}

export function computeInference(
  form: ExtendedCoAData,
  rules: ByproductRules,
): InferenceOutput {
  const heavy_metals_ok = isHeavyMetalsOk(form)
  const microbial_ok = isMicrobialOk(form)
  const coa_complete = isCoaComplete(form)

  const derived = { heavy_metals_ok, microbial_ok, coa_complete }
  const R1 = evaluateRule('R1', rules.R1, form, derived)
  const R2 = evaluateRule('R2', rules.R2, form, derived)
  const R3 = evaluateRule('R3', rules.R3, form, derived)
  const R4 = evaluateRule('R4', rules.R4, form, derived)
  const R5 = evaluateRule('R5', rules.R5, form, {
    ...derived,
    'R1.pass': R1.pass,
    pesticide_ok: form.pesticide_ok ?? false,
  })

  return {
    byproduct_type: form.byproduct_type,
    R1, R2, R3, R4, R5,
    heavy_metals_ok,
    microbial_ok,
    coa_complete,
    computed_at: new Date().toISOString(),
  }
}

export function loadByproductRules(
  allRules: Record<string, ByproductRules>,
  byproductType: string,
): ByproductRules {
  const rules = allRules[byproductType] ?? allRules['apple_pomace']
  if (!rules) throw new Error(`Rules not found for byproduct_type: ${byproductType}`)
  return rules
}
