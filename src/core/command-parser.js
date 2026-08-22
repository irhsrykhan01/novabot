export function parseCommand(text, prefix) {
  if (!text || !text.startsWith(prefix)) {
    return null;
  }

  const body = text
    .slice(prefix.length)
    .trim();

  if (!body) {
    return null;
  }

  const parts = body.split(/\s+/);

  const command = parts
    .shift()
    .toLowerCase();

  return {
    command,
    args: parts,
    raw: body
  };
}
