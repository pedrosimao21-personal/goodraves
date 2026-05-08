"use server";

const BASE_URL = "https://edmtrain.com/api";
const API_KEY = process.env.EDMTRAIN_KEY;

function normalizeEdmtrainEvent(e: any) {
  const locationParts = e.venue?.location?.split(", ") ?? [];
  const city = locationParts[0] ?? "";
  const stateOrCountry = locationParts.slice(1).join(", ");

  return {
    id: `edm_${e.id}`,
    name: e.name || (e.artistList?.[0]?.name ?? "Unnamed Event"),
    date: e.date ?? null,
    time: e.startTime ?? null,
    venue: {
      name: e.venue?.name ?? "Unknown Venue",
      city,
      country: e.venue?.country ?? stateOrCountry,
      countryCode: "",
      address: e.venue?.address ?? "",
      state: e.venue?.state ?? "",
      latitude: e.venue?.latitude ?? null,
      longitude: e.venue?.longitude ?? null,
    },
    image: null,
    url: e.link ?? null,
    priceRange: null,
    genre: e.electronicGenreInd
      ? "Electronic"
      : e.otherGenreInd
        ? "Other"
        : null,
    subGenre: e.festivalInd ? "Festival" : null,
    attractions: (e.artistList ?? []).map((a: any) => ({
      id: `edm_artist_${a.id}`,
      name: a.name,
      image: null,
      url: a.link ?? null,
    })),
    status: "onsale",
    source: "edmtrain",
    ages: e.ages ?? null,
    festivalInd: e.festivalInd ?? false,
    edmtrainLink: e.link ?? null,
  };
}

export async function searchEdmtrain({
  keyword = "",
  festivalOnly = false,
  startDate = "",
  endDate = "",
  locationIds = "",
  includeOtherGenres = false,
} = {}) {
  if (!API_KEY || API_KEY === "your_edmtrain_api_key_here") {
    throw new Error("NO_EDMTRAIN_KEY");
  }

  const params = new URLSearchParams({ client: API_KEY });

  if (keyword.trim()) params.set("eventName", keyword.trim());
  if (festivalOnly) params.set("festivalInd", "true");
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (locationIds) params.set("locationIds", locationIds);
  if (includeOtherGenres) params.set("includeOtherGenreInd", "true");

  const res = await fetch(`${BASE_URL}/events?${params}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`EDMTrain error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const events = json.data ?? [];

  let filtered = events;
  if (keyword.trim()) {
    const q = keyword.trim().toLowerCase();
    filtered = events.filter((e: any) => {
      if (e.name && e.name.toLowerCase().includes(q)) return true;
      if (e.artistList?.some((a: any) => a.name.toLowerCase().includes(q)))
        return true;
      if (e.venue?.name?.toLowerCase().includes(q)) return true;
      if (e.venue?.location?.toLowerCase().includes(q)) return true;
      return false;
    });
  }

  return {
    events: filtered.map(normalizeEdmtrainEvent),
    total: filtered.length,
  };
}

export async function hasEdmtrainKey() {
  return !!(API_KEY && API_KEY !== "your_edmtrain_api_key_here");
}
