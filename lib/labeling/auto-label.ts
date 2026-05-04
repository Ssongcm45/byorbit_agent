import type { CoAFormData } from '@/lib/coa/schema'
import type { LabelSet } from '@/lib/inference/types'

export function autoLabel(form: CoAFormData): LabelSet {
  const component_trait: string[] = []
  const risk: string[] = []
  const application: string[] = []
  const evidence: string[] = []

  if (form.TDF_g_per_100g >= 30) component_trait.push('high_fiber', 'fiber_source')
  else if (form.TDF_g_per_100g >= 20) component_trait.push('medium_fiber')

  if (form.TPC_mgGAE_per_g >= 4.0) component_trait.push('high_polyphenol', 'antioxidant_potential')
  else if (form.TPC_mgGAE_per_g >= 3.0) component_trait.push('polyphenol_potential')

  if (form.pectin_g_per_100g !== undefined && form.pectin_g_per_100g >= 5) {
    component_trait.push('pectin_potential', 'pectin_source')
  }

  if (form.dry_moisture_pct <= 12) component_trait.push('low_moisture')
  else if (form.fresh_moisture_pct > 50) component_trait.push('high_moisture', 'drying_required')

  if (form.fresh_moisture_pct > 50 && form.drying_method === 'none') risk.push('high_moisture_spoilage')

  if (
    (form.Pb_ppm !== undefined && form.Pb_ppm > 0.2) ||
    (form.Cd_ppm !== undefined && form.Cd_ppm > 0.1) ||
    (form.As_ppm !== undefined && form.As_ppm > 0.3) ||
    (form.Hg_ppm !== undefined && form.Hg_ppm > 0.05)
  ) {
    risk.push('heavy_metal_risk')
  }

  if (form.Ecoli === 'DETECTED' || form.Salmonella === 'DETECTED' || form.Listeria === 'DETECTED') {
    risk.push('microbial_risk')
  }

  if (form.color_state === 'browning' || form.color_state === 'dark') risk.push('browning_risk')
  if (form.odor_level === 'strong') risk.push('odor_risk')

  if (form.TDF_g_per_100g >= 25 && form.drying_method !== 'none') application.push('food_material', 'fiber_source')
  if (form.TPC_mgGAE_per_g >= 3.0 && form.dry_moisture_pct <= 12) application.push('cosmetic_material', 'antioxidant_material')
  if (form.pectin_g_per_100g !== undefined && form.pectin_g_per_100g >= 10) application.push('pectin_extract_material')

  if (form.TDF_g_per_100g !== undefined && form.Pb_ppm !== undefined) evidence.push('coa_internal')
  else evidence.push('estimated')

  return { component_trait, risk, application, evidence }
}
