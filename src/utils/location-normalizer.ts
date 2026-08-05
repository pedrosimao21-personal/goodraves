/**
 * Maps non-English country names (as emitted by RA/Partyflock/etc.) to their
 * canonical English name. Lookups are case-insensitive — diacritics are not
 * folded because the source data (mostly Dutch, from Partyflock) already
 * carries them correctly, so the map keys match as written.
 */
const COUNTRY_NAME_MAP: Record<string, string> = {
  // Dutch
  "Nederland": "Netherlands",
  "Duitsland": "Germany",
  "Spanje": "Spain",
  "Frankrijk": "France",
  "België": "Belgium",
  "Oostenrijk": "Austria",
  "Zwitserland": "Switzerland",
  "Verenigd Koninkrijk": "United Kingdom",
  "Engeland": "United Kingdom",
  "Verenigde Staten": "United States of America",
  "Italië": "Italy",
  "Polen": "Poland",
  "Tsjechië": "Czech Republic",
  "Hongarije": "Hungary",
  "Roemenië": "Romania",
  "Kroatië": "Croatia",
  "Denemarken": "Denmark",
  "Noorwegen": "Norway",
  "Zweden": "Sweden",
  "Griekenland": "Greece",
  "Servië": "Serbia",
  "Ierland": "Ireland",
  // German
  "Deutschland": "Germany",
  "Österreich": "Austria",
  "Schweiz": "Switzerland",
  // French
  "Belgique": "Belgium",
  "Suisse": "Switzerland",
  "Espagne": "Spain",
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
}

/**
 * Canonical English country name (proper case, for display/storage) paired
 * with its ISO-2 code, for populating `festivals.countryCode`/`countryName`
 * and looking up flags (see ra/country-flags.ts). Looked up both directions
 * via `getCountryIsoCode` / `getCountryNameFromIsoCode` below, not directly.
 */
const COUNTRY_ISO: Array<{ name: string; code: string }> = [
  { name: "Netherlands", code: "NL" },
  { name: "Germany", code: "DE" },
  { name: "Belgium", code: "BE" },
  { name: "Spain", code: "ES" },
  { name: "United States of America", code: "US" },
  { name: "United Kingdom", code: "GB" },
  { name: "Croatia", code: "HR" },
  { name: "India", code: "IN" },
  { name: "Hungary", code: "HU" },
  { name: "France", code: "FR" },
  { name: "Chile", code: "CL" },
  { name: "Romania", code: "RO" },
  { name: "Austria", code: "AT" },
  { name: "Italy", code: "IT" },
  { name: "Czech Republic", code: "CZ" },
  { name: "Thailand", code: "TH" },
  { name: "Switzerland", code: "CH" },
  { name: "Mexico", code: "MX" },
  { name: "Indonesia", code: "ID" },
  { name: "Peru", code: "PE" },
  { name: "Azerbaijan", code: "AZ" },
  { name: "Australia", code: "AU" },
  { name: "Portugal", code: "PT" },
  { name: "Malta", code: "MT" },
  { name: "Brazil", code: "BR" },
  { name: "China", code: "CN" },
  { name: "Japan", code: "JP" },
  { name: "Israel", code: "IL" },
  { name: "Bulgaria", code: "BG" },
  { name: "South Africa", code: "ZA" },
  { name: "Poland", code: "PL" },
  { name: "Denmark", code: "DK" },
  { name: "Norway", code: "NO" },
  { name: "Sweden", code: "SE" },
  { name: "Greece", code: "GR" },
  { name: "Serbia", code: "RS" },
  { name: "Ireland", code: "IE" },
  { name: "Finland", code: "FI" },
]

function foldKey(value: string): string {
  return value.trim().toLowerCase()
}

const COUNTRY_ISO_BY_NAME = new Map(COUNTRY_ISO.map(c => [foldKey(c.name), c.code]))
const COUNTRY_NAME_BY_ISO = new Map(COUNTRY_ISO.map(c => [c.code, c.name]))

const FOLDED_COUNTRY_NAME_MAP = new Map(
  Object.entries(COUNTRY_NAME_MAP).map(([foreign, english]) => [foldKey(foreign), english])
)

/**
 * Normalizes a country name to its English equivalent (case-insensitive).
 * Returns the original string if no mapping exists.
 */
export function normalizeCountryName(country: string): string {
  return FOLDED_COUNTRY_NAME_MAP.get(foldKey(country)) ?? country
}

/**
 * Resolves a country name (in any language this module knows) to its ISO-2
 * code. Returns null if the country isn't recognized.
 */
export function getCountryIsoCode(countryName: string | null | undefined): string | null {
  if (!countryName) return null
  const english = normalizeCountryName(countryName)
  return COUNTRY_ISO_BY_NAME.get(foldKey(english)) ?? null
}

/**
 * Reverse of `getCountryIsoCode` — resolves an ISO-2 code (e.g. from a
 * Nominatim geocode result) to the canonical English country name.
 */
export function getCountryNameFromIsoCode(code: string | null | undefined): string | null {
  if (!code) return null
  return COUNTRY_NAME_BY_ISO.get(code.toUpperCase()) ?? null
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

/**
 * Extracts the trailing country segment from a "City, Country" (or
 * "City, Region, Country") location string. Returns null when the string
 * has no comma — i.e. it's city-only, with no country to extract.
 */
export function extractCountryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null
  const parts = location.split(",").map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  return parts[parts.length - 1]
}
