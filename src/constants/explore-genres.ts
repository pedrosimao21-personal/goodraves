/**
 * Curated list of electronic/dance music genres for the Explore page.
 * Kept in a plain constants file so it can be imported from both
 * server actions ("use server") and client components without
 * violating the Next.js "use server" export rules.
 */
export const EXPLORE_GENRE_OPTIONS: { value: string; label: string }[] = [
  { value: 'techno', label: 'Techno' },
  { value: 'house', label: 'House' },
  { value: 'trance', label: 'Trance' },
  { value: 'drum and bass', label: 'Drum & Bass' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'melodic techno', label: 'Melodic Techno' },
  { value: 'deep house', label: 'Deep House' },
  { value: 'tech house', label: 'Tech House' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'hardstyle', label: 'Hardstyle' },
  { value: 'psytrance', label: 'Psytrance' },
  { value: 'dubstep', label: 'Dubstep' },
  { value: 'electro', label: 'Electro' },
  { value: 'disco', label: 'Disco' },
  { value: 'progressive house', label: 'Progressive House' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'breakbeat', label: 'Breakbeat' },
]
