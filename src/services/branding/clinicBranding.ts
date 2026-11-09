/**
 * Clinic Branding Configuration (§2.6)
 *
 * Defines the extensible clinic white-labeling and visual hierarchy schema:
 *  - Clinic entity name and medical unit subtitle
 *  - Optional logo URL and primary brand accent color
 *  - System descriptor and copyright text
 */

export interface ClinicBrandingConfig {
  clinicName: string;
  unitSubtitle: string;
  systemName: string;
  legalEntityText: string;
  logoUrl?: string;
  primaryColor?: string;
}

export const DEFAULT_CLINIC_BRANDING: ClinicBrandingConfig = {
  clinicName: "AiFV Precision Hospital CDSS",
  unitSubtitle: "Fertility Medicine Unit",
  systemName: "Hospital CDSS",
  legalEntityText: "All copyrights reserved 2026",
};

let activeBranding: ClinicBrandingConfig = { ...DEFAULT_CLINIC_BRANDING };

export function getClinicBranding(): ClinicBrandingConfig {
  return { ...activeBranding };
}

export function updateClinicBranding(update: Partial<ClinicBrandingConfig>): ClinicBrandingConfig {
  activeBranding = { ...activeBranding, ...update };
  return { ...activeBranding };
}
