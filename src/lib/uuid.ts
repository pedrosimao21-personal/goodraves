const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical UUID string; guards ids from the client before they hit a uuid column. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
