// Documented bias seeds for the synthetic client generator.
//
// The engine never reads protected attributes (age_band, zip_cluster, gender).
// But proxy variables — variables the engine DOES read — can correlate with
// protected attributes in the real world. The seeds below model two such
// proxy effects so the audit has something to catch. Both are transparent
// and surfaced in the README and on the dashboard.
//
// --- Seed 1: AGE proxy effect ---
// 65+ clients are oversampled with investment_experience = "none" AND with
// existing_va_holdings_usd > 0 (a prior annuity sale). Reality: senior clients
// are disproportionately targeted by annuity marketing, so prior holdings
// correlate with age. The engine's matching then prefers the senior-marketed
// VA-005 ("Sentinel Senior Income VA") — high fee, long surrender — over
// equivalent low-cost mutual fund options for conservative under-65 clients.
//
// --- Seed 2: ZIP proxy effect ---
// ZIP cluster D clients are oversampled with time_horizon_years that's
// shorter than their stated investment objective would naturally suggest
// (a growth-objective client reporting only 4-year horizon). Reality: clients
// in historically under-served ZIPs are more likely to have been advised
// toward shorter horizons regardless of life stage. The engine then disqualifies
// these clients from growth products, steering them to bond/treasury funds.

export interface SeedConfig {
  // Seed 1
  age_senior_vahold_rate: number; // 0.55 = 55% of 65+ get existing VA holdings
  age_senior_no_experience_rate: number; // among 65+, fraction with experience=none
  age_under_65_vahold_rate: number; // baseline for comparison
  age_under_65_no_experience_rate: number;

  // Seed 2
  zip_d_short_horizon_rate: number; // 0.6 = 60% of ZIP-D get truncated horizon
  zip_d_short_horizon_max_years: number; // truncation ceiling
  zip_baseline_short_horizon_rate: number;
}

export const SEED_CONFIG: SeedConfig = {
  age_senior_vahold_rate: 0.55,
  age_senior_no_experience_rate: 0.45,
  age_under_65_vahold_rate: 0.08,
  age_under_65_no_experience_rate: 0.12,

  zip_d_short_horizon_rate: 0.6,
  zip_d_short_horizon_max_years: 4,
  zip_baseline_short_horizon_rate: 0.1,
};
