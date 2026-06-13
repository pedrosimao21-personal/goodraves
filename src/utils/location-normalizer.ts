/**
 * Maps non-English country names to their English equivalents.
 * Covers common European languages used by festival data sources (RA, Partyflock).
 */
const COUNTRY_NAME_MAP: Record<string, string> = {
  // Dutch
  "Nederland": "Netherlands",
  // German
  "Deutschland": "Germany",
  "Österreich": "Austria",
  "Schweiz": "Switzerland",
  // French
  "Belgique": "Belgium",
  "Suisse": "Switzerland",
  "Espagne": "Spain",
  // Dutch/Flemish
  "België": "Belgium",
  // Spanish
  "España": "Spain",
  "Alemania": "Germany",
  // Italian
  "Italia": "Italy",
  "Germania": "Germany",
  // Polish
  "Polska": "Poland",
  "Niemcy": "Germany",
  // Czech
  "Česko": "Czech Republic",
  "Česká republika": "Czech Republic",
  // Hungarian
  "Magyarország": "Hungary",
  // Romanian
  "România": "Romania",
  // Portuguese
  "Alemanha": "Germany",
  "Países Baixos": "Netherlands",
  // Danish/Norwegian/Swedish
  "Danmark": "Denmark",
  "Norge": "Norway",
  "Sverige": "Sweden",
  "Finland": "Finland",
}

/**
 * Normalizes a country name to its English equivalent.
 * Returns the original string if no mapping exists.
 */
export function normalizeCountryName(country: string): string {
  return COUNTRY_NAME_MAP[country.trim()] ?? country
}

/**
 * Normalizes a full location string (e.g. "Amsterdam, Nederland") by:
 * - Mapping non-English country names to English
 * - Returns null if the location is null/empty
 */
export function normalizeLocation(location: string | null | undefined): string | null {
  if (!location) return null

  const parts = location.split(",").map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const normalizedParts = parts.map(part => normalizeCountryName(part))
  return normalizedParts.join(", ")
}
