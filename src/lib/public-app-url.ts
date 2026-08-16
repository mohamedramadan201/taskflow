const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /\.local$/i,
];

export function normalizePublicHttpsUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function taskflowPublicUrl(requestUrl: string) {
  return normalizePublicHttpsUrl(process.env.TASKFLOW_PUBLIC_URL)
    || normalizePublicHttpsUrl(process.env.NEXT_PUBLIC_APP_URL)
    || normalizePublicHttpsUrl(new URL(requestUrl).origin);
}
