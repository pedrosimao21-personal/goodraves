"use server";

export async function getWikiImage(searchQuery: string) {
  if (!searchQuery) return null;
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchQuery)}&prop=pageimages&format=json&pithumbsize=600&origin=*`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === "-1") return null;

    return pages[pageId]?.thumbnail?.source || null;
  } catch (err) {
    console.error("Failed to fetch city image from Wikipedia:", err);
    return null;
  }
}
