const COMBINING_MARKS = /\p{M}+/gu;
const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]+/gu;

/**
 * Key that two spellings of one artist name share: "Adrián Mills" and
 * "Adrian Mills", "L.F.T." and "L.F.T", "Tau Ceti" and "Tauceti", "O’Callaghan"
 * and "O'Callaghan" all fold to the same key. Used only to compare names inside
 * ONE festival's lineup — never to merge artists across the whole database.
 */
export function foldArtistName(name: string): string {
  const folded = name
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NOT_LETTER_OR_DIGIT, "");
  // A name with no letters or digits at all (all symbols) still needs a key.
  return folded || name.trim().toLowerCase();
}
