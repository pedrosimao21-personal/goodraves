/**
 * Shared text normalization utilities for artist name processing.
 * Handles HTML entity decoding and Unicode normalization.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: "\u00A0", ndash: "\u2013", mdash: "\u2014",
  laquo: "\u00AB", raquo: "\u00BB",
  lsquo: "\u2018", rsquo: "\u2019",
  ldquo: "\u201C", rdquo: "\u201D",
  bull: "\u2022", hellip: "\u2026",
  trade: "\u2122", copy: "\u00A9", reg: "\u00AE",
  deg: "\u00B0", micro: "\u00B5",
  acute: "\u00B4", cedil: "\u00B8",
  uml: "\u00A8", macr: "\u00AF",
  Agrave: "\u00C0", Aacute: "\u00C1", Acirc: "\u00C2",
  Atilde: "\u00C3", Auml: "\u00C4", Aring: "\u00C5",
  AElig: "\u00C6", Ccedil: "\u00C7",
  Egrave: "\u00C8", Eacute: "\u00C9", Ecirc: "\u00CA", Euml: "\u00CB",
  Igrave: "\u00CC", Iacute: "\u00CD", Icirc: "\u00CE", Iuml: "\u00CF",
  ETH: "\u00D0", Ntilde: "\u00D1",
  Ograve: "\u00D2", Oacute: "\u00D3", Ocirc: "\u00D4",
  Otilde: "\u00D5", Ouml: "\u00D6", Oslash: "\u00D8",
  Ugrave: "\u00D9", Uacute: "\u00DA", Ucirc: "\u00DB", Uuml: "\u00DC",
  Yacute: "\u00DD", THORN: "\u00DE", szlig: "\u00DF",
  agrave: "\u00E0", aacute: "\u00E1", acirc: "\u00E2",
  atilde: "\u00E3", auml: "\u00E4", aring: "\u00E5",
  aelig: "\u00E6", ccedil: "\u00E7",
  egrave: "\u00E8", eacute: "\u00E9", ecirc: "\u00EA", euml: "\u00EB",
  igrave: "\u00EC", iacute: "\u00ED", icirc: "\u00EE", iuml: "\u00EF",
  eth: "\u00F0", ntilde: "\u00F1",
  ograve: "\u00F2", oacute: "\u00F3", ocirc: "\u00F4",
  otilde: "\u00F5", ouml: "\u00F6", oslash: "\u00F8",
  ugrave: "\u00F9", uacute: "\u00FA", ucirc: "\u00FB", uuml: "\u00FC",
  yacute: "\u00FD", thorn: "\u00FE", yuml: "\u00FF",
};

/**
 * Decode HTML entities (named, decimal, and hex) in a string.
 * Handles &amp;, &#123;, &#x1A;, and all common named entities.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g,
    (match, decimal, hex, named) => {
      if (decimal) return String.fromCodePoint(parseInt(decimal, 10));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (named && NAMED_ENTITIES[named]) return NAMED_ENTITIES[named];
      return match;
    }
  );
}

/**
 * Normalize an artist name: decode HTML entities, apply NFC normalization,
 * collapse whitespace, and trim.
 */
export function normalizeArtistName(name: string): string {
  const decoded = decodeHtmlEntities(name);
  const normalized = decoded.normalize("NFC");
  return normalized.replace(/\s+/g, " ").trim();
}
