/**
 * Splits a "YF-2026-000123-<token>" URL segment back into its two parts.
 *
 * A naive split on the last hyphen breaks: the token is a base64url string
 * (randomToken in lib/hash.js), and base64url's own alphabet includes '-'.
 * A token like "ZEojfn6-O8ugeZDLZ_zBOjEu" has a hyphen inside it, so the
 * last hyphen in the full string can land inside the token instead of
 * between it and the appId — which silently produced a wrong appId and a
 * truncated token, and "Not found" for every candidate whose token
 * happened to contain a hyphen.
 *
 * The appId format is fixed — "YF-<4 digit year>-<digits>" — so instead of
 * guessing from the right, this matches that fixed shape from the left and
 * treats everything after it as the token, whatever characters it contains.
 */
export function splitStatusParam(raw) {
  const m = /^(YF-\d{4}-\d+)-(.+)$/s.exec(String(raw || ''));
  if (!m) return { appId: '', token: '' };
  return { appId: m[1], token: m[2] };
}
