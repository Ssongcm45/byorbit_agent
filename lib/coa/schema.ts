import { z } from 'zod'

export const DryingMethodSchema = z.enum(['none', 'hot_air', 'freeze_dry', 'sun_dry', 'spray_dry'])
export const DetectionSchema = z.enum(['ND', 'DETECTED'])

export const CoAFormSchema = z.object({
  batch_id:       z.string().default(() => `batch-${Date.now()}`),
  byproduct_type: z.enum(['apple_pomace', 'coffee_grounds', 'citrus_pomace', 'cabbage_residue', 'other']),
  variety:        z.string().min(1),
  region:         z.string().min(1),
  harvest_season: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM format'),
  lab:            z.string().optional(),
  measured_at:    z.string().optional(),
  drying_method:  DryingMethodSchema,
  drying_temp_c:  z.number().optional(),
  drying_time_h:  z.number().optional(),
  fresh_moisture_pct: z.number().min(0).max(100),
  dry_moisture_pct:   z.number().min(0).max(100),
  shelf_life_h:       z.number().min(0),
  ph:             z.number().min(0).max(14).optional(),
  odor_level:     z.enum(['none', 'mild', 'strong']).optional(),
  color_state:    z.enum(['normal', 'browning', 'dark']).optional(),
  foreign_matter: z.boolean().optional(),
  TDF_g_per_100g:     z.number().min(0).max(100),
  TPC_mgGAE_per_g:    z.number().min(0).max(100),
  pectin_g_per_100g:  z.number().optional(),
  protein_g_per_100g: z.number().optional(),
  sugar_g_per_100g:   z.number().optional(),
  fat_g_per_100g:     z.number().optional(),
  Pb_ppm: z.number().optional(),
  Cd_ppm: z.number().optional(),
  As_ppm: z.number().optional(),
  Hg_ppm: z.number().optional(),
  total_aerobic_CFU_g: z.number().optional(),
  Ecoli:      DetectionSchema.default('ND'),
  Salmonella: DetectionSchema.default('ND'),
  Listeria:   DetectionSchema.default('ND'),
  annual_supply_ton:  z.number().optional(),
  pomace_ratio_pct:   z.number().optional(),
  monthly_volume_kg:     z.number().optional(),
  current_disposal_cost: z.number().optional(),
})

export type CoAFormData = z.infer<typeof CoAFormSchema>

export const DiagnosisInputSchema = z.object({
  byproduct_name:          z.string().min(1),
  region:                  z.string().min(1),
  monthly_volume_kg:       z.number().min(0),
  current_disposal_method: z.string(),
  current_disposal_cost:   z.number().min(0).optional(),
  moisture_level:          z.enum(['low', 'medium', 'high']),
  odor_issue:              z.boolean(),
  has_photo:               z.boolean().optional(),
})

export type DiagnosisInput = z.infer<typeof DiagnosisInputSchema>
