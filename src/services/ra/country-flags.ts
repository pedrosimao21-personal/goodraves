/**
 * Country code to flag emoji mapping and helper.
 * Pure utility — no server context required.
 */

export const COUNTRY_FLAGS: Record<string, string> = {
  AF: "🇦🇫", AL: "🇦🇱", DZ: "🇩🇿", AR: "🇦🇷", AM: "🇦🇲",
  AU: "🇦🇺", AT: "🇦🇹", AZ: "🇦🇿", BE: "🇧🇪", BR: "🇧🇷",
  BG: "🇧🇬", CA: "🇨🇦", CL: "🇨🇱", CN: "🇨🇳", CO: "🇨🇴",
  HR: "🇭🇷", CZ: "🇨🇿", DK: "🇩🇰", EG: "🇪🇬", EE: "🇪🇪",
  FI: "🇫🇮", FR: "🇫🇷", DE: "🇩🇪", GR: "🇬🇷", HU: "🇭🇺",
  IS: "🇮🇸", IN: "🇮🇳", ID: "🇮🇩", IE: "🇮🇪", IL: "🇮🇱",
  IT: "🇮🇹", JP: "🇯🇵", KR: "🇰🇷", LV: "🇱🇻", LT: "🇱🇹",
  LU: "🇱🇺", MY: "🇲🇾", MX: "🇲🇽", MA: "🇲🇦", NL: "🇳🇱",
  NZ: "🇳🇿", NO: "🇳🇴", PK: "🇵🇰", PE: "🇵🇪", PH: "🇵🇭",
  PL: "🇵🇱", PT: "🇵🇹", RO: "🇷🇴", RU: "🇷🇺", SA: "🇸🇦",
  RS: "🇷🇸", SG: "🇸🇬", SK: "🇸🇰", SI: "🇸🇮", ZA: "🇿🇦",
  ES: "🇪🇸", SE: "🇸🇪", CH: "🇨🇭", TW: "🇹🇼", TH: "🇹🇭",
  TR: "🇹🇷", UA: "🇺🇦", AE: "🇦🇪", GB: "🇬🇧", UK: "🇬🇧",
  US: "🇺🇸", VE: "🇻🇪", VN: "🇻🇳",
};

/**
 * Returns the flag emoji for a given country code, or empty string if unknown.
 */
export function getCountryFlag(code: string | null): string {
  if (!code) return "";
  return COUNTRY_FLAGS[code.toUpperCase()] ?? "";
}
