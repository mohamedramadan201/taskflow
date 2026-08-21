export function parseTelegramCommand(text: string) {
  const match = text.trim().match(/^\/([a-z][a-z0-9_]*)(?:@[^\s]+)?(?:\s+([\s\S]*))?$/i);
  return match ? { command: match[1].toLowerCase(), argument: match[2]?.trim() || "" } : null;
}
