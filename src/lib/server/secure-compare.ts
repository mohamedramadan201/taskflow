import { timingSafeEqual } from "node:crypto";

/** Compare bearer secrets without leaking content through timing. */
export function secureSecretMatches(actual: string | null | undefined, expected: string | null | undefined) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
