"use server";

/**
 * Resident Advisor GraphQL API client.
 * Handles all HTTP communication with ra.co/graphql.
 */

const RA_GRAPHQL_URL = "https://ra.co/graphql";
const RA_USER_AGENT = "Mozilla/5.0";
const RA_EVENTS_BASE_URL = "https://ra.co/events";
const RA_ARTIST_BASE_URL = "https://ra.co/dj";
const MAX_UPCOMING_EVENTS = 10;

const SEARCH_EVENTS_QUERY = `
  query SEARCH_EVENTS($title: MatchFilterInputDtoInput) {
    facetedSearch(types: [EVENT], filters: { title: $title }) {
      totalResults
      results {
        data {
          ... on Event {
            id
            title
            startTime
            endTime
            interestedCount
            attending
            venue {
              name
              area {
                name
                country {
                  name
                }
              }
            }
            images {
              filename
            }
            artists {
              name
            }
            lineup
          }
        }
      }
    }
  }
`;

const GET_EVENT_QUERY = `
  query GET_EVENT($id: ID!) {
    event(id: $id) {
      id
      title
      startTime
      endTime
      interestedCount
      attending
      venue {
        name
        area {
          name
          country {
            name
          }
        }
      }
      images {
        filename
      }
      artists {
        name
      }
      lineup
    }
  }
`;

export type RAEventRaw = {
  id: string;
  title: string | null;
  startTime: string | null;
  endTime: string | null;
  interestedCount: number | null;
  attending: number | null;
  venue: {
    name: string | null;
    area: {
      name: string | null;
      country: { name: string | null } | null;
    } | null;
  } | null;
  images: Array<{ filename: string }> | null;
  artists: Array<{ name: string }> | null;
  lineup: string | null;
};

/** Search RA events by title query. Returns raw GraphQL results. */
export async function searchRAEventsRaw(query: string): Promise<RAEventRaw[]> {
  try {
    const res = await fetch(RA_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": RA_USER_AGENT,
        "Referer": RA_EVENTS_BASE_URL,
      },
      body: JSON.stringify({
        query: SEARCH_EVENTS_QUERY,
        variables: { title: { value: query } },
      }),
    });

    if (!res.ok) return [];
    const json = await res.json();
    const results = json?.data?.facetedSearch?.results ?? [];

    return results
      .map((r: any) => r?.data)
      .filter((e: any) => e?.id) as RAEventRaw[];
  } catch {
    return [];
  }
}

/** Fetch a single RA event by numeric ID. Returns raw event data or null. */
export async function fetchRAEventRaw(id: string): Promise<RAEventRaw | null> {
  try {
    const res = await fetch(RA_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": RA_USER_AGENT,
        "Referer": `${RA_EVENTS_BASE_URL}/${id}`,
      },
      body: JSON.stringify({
        query: GET_EVENT_QUERY,
        variables: { id },
      }),
    });

    if (!res.ok) {
      console.error(`[ra/client] RA API returned ${res.status} for event ${id}`);
      return null;
    }

    const json = await res.json();
    const data = json?.data?.event;

    if (!data && json?.errors) {
      console.error(`[ra/client] RA GraphQL errors for event ${id}:`, json.errors);
    }

    return data ?? null;
  } catch (err) {
    console.error(`[ra/client] Failed to fetch RA event ${id}:`, err);
    return null;
  }
}

const GET_ARTIST_EVENTS_QUERY = `
  query GET_ARTIST_EVENTS($id: ID!) {
    artist(id: $id) {
      urlSafeName
      events(type: LATEST) {
        id
        title
        date
        startTime
        venue {
          name
          area {
            name
          }
        }
      }
    }
  }
`;

export type RAUpcomingEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  venue: string | null;
  city: string | null;
  raUrl: string;
};

/**
 * Fetch upcoming events for an RA artist by their numeric RA artist ID.
 * Returns only future events, capped at MAX_UPCOMING_EVENTS.
 */
export async function fetchRArtistEvents(raArtistId: string): Promise<RAUpcomingEvent[]> {
  try {
    const res = await fetch(RA_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": RA_USER_AGENT,
        "Referer": `${RA_ARTIST_BASE_URL}/${raArtistId}`,
      },
      body: JSON.stringify({
        query: GET_ARTIST_EVENTS_QUERY,
        variables: { id: raArtistId },
      }),
    });

    if (!res.ok) {
      console.error(`[ra/client] RA API returned ${res.status} for artist ${raArtistId}`);
      return [];
    }

    const json = await res.json();
    const artistData = json?.data?.artist;
    if (!artistData) return [];

    const todayStr = new Date().toISOString().slice(0, 10);

    return (artistData.events ?? [])
      .filter((e: any) => e?.id && e.date >= todayStr)
      .slice(0, MAX_UPCOMING_EVENTS)
      .map((e: any): RAUpcomingEvent => ({
        id: String(e.id),
        title: e.title ?? "Untitled Event",
        date: e.date.slice(0, 10),
        startTime: e.startTime ?? null,
        venue: e.venue?.name ?? null,
        city: e.venue?.area?.name ?? null,
        raUrl: `https://ra.co/events/${e.id}`,
      }));
  } catch (err) {
    console.error(`[ra/client] Failed to fetch events for RA artist ${raArtistId}:`, err);
    return [];
  }
}
