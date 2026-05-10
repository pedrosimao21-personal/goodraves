/**
 * Maps raw genre tags from Spotify/Last.fm to canonical genre groups
 * used in the Insights genre chart.
 */
export const GENRE_MAP: Record<string, string> = {
  'techno': 'techno', 'berlin techno': 'techno', 'amsterdam techno': 'techno',
  'minimal techno': 'techno', 'acid techno': 'techno', 'industrial techno': 'techno',
  'hard techno': 'techno', 'detroit techno': 'techno', 'dark techno': 'techno',
  'uk techno': 'techno', 'dub techno': 'techno', 'raw techno': 'techno',
  'schranz': 'techno', 'peak time techno': 'techno', 'melodic techno': 'melodic techno & house',
  'house': 'house', 'deep house': 'house', 'tech house': 'house',
  'afro house': 'house', 'minimal house': 'house', 'chicago house': 'house',
  'soulful house': 'house', 'vocal house': 'house', 'organic house': 'house',
  'micro house': 'house', 'microhouse': 'house', 'nu house': 'house',
  'french house': 'house', 'dutch house': 'house', 'funky house': 'house',
  'minimal': 'house', 'minimal deep tech': 'house',
  'melodic techno and house': 'melodic techno & house',
  'melodic techno & house': 'melodic techno & house',
  'progressive house': 'melodic techno & house', 'melodic house': 'melodic techno & house',
  'afterhours': 'melodic techno & house',
  'trance': 'trance', 'progressive trance': 'trance', 'psytrance': 'trance',
  'goa trance': 'trance', 'uplifting trance': 'trance', 'tech trance': 'trance',
  'electronic': 'electronic', 'electronica': 'electronic', 'idm': 'electronic',
  'ambient': 'electronic', 'experimental': 'electronic', 'modular synth': 'electronic',
  'electro': 'electronic', 'electro music': 'electronic',
  'braindance': 'electronic', 'glitch': 'electronic',
  'drum and bass': 'drum & bass', 'drum & bass': 'drum & bass',
  'jungle': 'drum & bass', 'neurofunk': 'drum & bass', 'liquid funk': 'drum & bass',
  'd&b': 'drum & bass', 'dnb': 'drum & bass',
  'breakbeat': 'breaks', 'breaks': 'breaks', 'break': 'breaks',
  'nu-skool breaks': 'breaks',
  'disco': 'disco', 'nu disco': 'disco', 'disco house': 'disco',
  'funk': 'disco', 'funk carioca': 'disco',
  'hip hop': 'hip-hop', 'rap': 'hip-hop', 'trap': 'hip-hop',
  'ebm': 'industrial', 'industrial': 'industrial', 'dark electro': 'industrial',
  'post-industrial': 'industrial',
  'noise': 'experimental', 'power electronics': 'experimental',
  'uk garage': 'garage & bass', 'bassline': 'garage & bass', 'speed garage': 'garage & bass',
  'grime': 'garage & bass', 'bass music': 'garage & bass', 'footwork': 'garage & bass',
}

export const GENRE_BLACKLIST = new Set([
  'dj', 'dj music', 'swedish', 'dancehall', 'rave', 'club', 'filter house',
  'dutch', 'german', 'uk', 'belgian', 'french', 'belgian edm',
])
