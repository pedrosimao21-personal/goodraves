const ONE_MILLION = 1_000_000
const ONE_THOUSAND = 1_000

export function formatPlaycount(n: number | null | undefined): string {
  if (!n) return ''
  if (n >= ONE_MILLION) return `${(n / ONE_MILLION).toFixed(1)}M plays`
  if (n >= ONE_THOUSAND) return `${(n / ONE_THOUSAND).toFixed(1)}K plays`
  return `${n} plays`
}

export function formatFollowers(n: number | null | undefined): string {
  if (!n) return ''
  if (n >= ONE_MILLION) return `${(n / ONE_MILLION).toFixed(1)}M`
  if (n >= ONE_THOUSAND) return `${(n / ONE_THOUSAND).toFixed(1)}K`
  return `${n}`
}
