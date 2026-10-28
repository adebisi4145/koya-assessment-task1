// Opaque pagination cursors. They encode the position (booking seq) after which the
// next page starts; the version prefix leaves room to change the format later.
const PREFIX = "v1:";

export function encodeCursor(seq: string): string {
  return Buffer.from(`${PREFIX}${seq}`, "utf8").toString("base64url");
}

/** Returns the seq a cursor points after, or null if the cursor is malformed. */
export function decodeCursor(cursor: string): string | null {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  if (!decoded.startsWith(PREFIX)) return null;
  const seq = decoded.slice(PREFIX.length);
  return /^\d{1,18}$/.test(seq) ? seq : null;
}
