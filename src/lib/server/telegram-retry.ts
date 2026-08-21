export function telegramRetryDelayMs(attempts: number) {
  return Math.min(5 * 60 * 1000, 5 * 1000 * (2 ** Math.max(0, attempts - 1)));
}
