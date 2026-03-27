export async function getWikiImage(searchQuery) {
  if (!searchQuery) return null
  try {
    // Wikipedia API to get page thumbnail
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(cityName)}&prop=pageimages&format=json&pithumbsize=600&origin=*`)
    const data = await res.json()
    const pages = data.query?.pages
    if (!pages) return null
    
    // Get the first page object
    const pageId = Object.keys(pages)[0]
    if (pageId === '-1') return null
    
    return pages[pageId]?.thumbnail?.source || null
  } catch (err) {
    console.error('Failed to fetch city image from Wikipedia:', err)
    return null
  }
}
