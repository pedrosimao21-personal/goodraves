/** POSTs JSON to one of the logged-out auth routes. `error` is the route's message, or a generic one. */
export async function postJson(url: string, body: unknown): Promise<{ isOk: boolean; error: string | null }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return { isOk: true, error: null };
    const data = await res.json().catch(() => ({}));
    return { isOk: false, error: data.error || "Something went wrong. Try again." };
  } catch {
    return { isOk: false, error: "Could not reach the server. Check your connection and try again." };
  }
}
