"use server";

const BASE_URL = "https://app.ticketmaster.com/discovery/v2";
const API_KEY = process.env.TICKETMASTER_KEY;

function normalizeEvent(e: any) {
  const venue = e._embedded?.venues?.[0] ?? {};
  const attraction = e._embedded?.attractions ?? [];
  const image =
    e.images?.find((i: any) => i.ratio === "16_9" && i.width > 1000) ??
    e.images?.find((i: any) => i.ratio === "16_9") ??
    e.images?.[0] ??
    null;

  return {
    id: e.id,
    name: e.name,
    date: e.dates?.start?.localDate ?? null,
    time: e.dates?.start?.localTime ?? null,
    venue: {
      name: venue.name ?? "Unknown Venue",
      city: venue.city?.name ?? "",
      country: venue.country?.name ?? "",
      countryCode: venue.country?.countryCode ?? "",
      address: venue.address?.line1 ?? "",
    },
    image: image?.url ?? null,
    url: e.url ?? null,
    priceRange: e.priceRanges?.[0] ?? null,
    genre: e.classifications?.[0]?.genre?.name ?? null,
    subGenre: e.classifications?.[0]?.subGenre?.name ?? null,
    attractions: attraction.map((a: any) => ({
      id: a.id,
      name: a.name,
      image:
        a.images?.find((i: any) => i.ratio === "16_9")?.url ??
        a.images?.[0]?.url ??
        null,
      url: a.url ?? null,
    })),
    status: e.dates?.status?.code ?? "onsale",
    source: "ticketmaster",
  };
}

export async function searchTicketmaster({
  keyword = "",
  page = 0,
  size = 20,
  countryCode = "",
} = {}) {
  if (!API_KEY || API_KEY === "your_ticketmaster_api_key_here") {
    throw new Error("NO_API_KEY");
  }

  const params = new URLSearchParams({
    apikey: API_KEY,
    keyword,
    classificationName: "music",
    type: "event",
    page: String(page),
    size: String(size),
    sort: "date,asc",
  });

  if (countryCode) params.set("countryCode", countryCode);

  const res = await fetch(`${BASE_URL}/events.json?${params}`, {
    next: { revalidate: 300 }, // Cache for 5 minutes
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ticketmaster error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const events = data?._embedded?.events ?? [];
  const page_info = data?.page ?? { totalElements: 0, totalPages: 0 };

  return {
    events: events.map(normalizeEvent),
    page: page_info,
  };
}

export async function getTicketmasterEvent(id: string) {
  if (!API_KEY || API_KEY === "your_ticketmaster_api_key_here") {
    throw new Error("NO_API_KEY");
  }

  const res = await fetch(`${BASE_URL}/events/${id}.json?apikey=${API_KEY}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Event not found (${res.status})`);
  const data = await res.json();
  return normalizeEvent(data);
}

/** Batch fetch multiple Ticketmaster events in parallel (max 5 concurrent). */
export async function getTicketmasterEvents(ids: string[]) {
  if (!API_KEY || API_KEY === "your_ticketmaster_api_key_here") {
    return {};
  }
  const results: Record<string, any> = {};
  // Process in chunks of 5 to avoid rate limiting
  const CHUNK_SIZE = 5;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map(async (id) => {
        const res = await fetch(
          `${BASE_URL}/events/${id}.json?apikey=${API_KEY}`,
          { next: { revalidate: 300 } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return { id, event: normalizeEvent(data) };
      })
    );
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results[result.value.id] = result.value.event;
      }
    }
  }
  return results;
}

export async function hasTicketmasterKey() {
  return !!(API_KEY && API_KEY !== "your_ticketmaster_api_key_here");
}
