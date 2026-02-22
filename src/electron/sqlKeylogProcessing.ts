const specialChars = new Set([
  "⌃",
  "⌘",
  "⌥",
  "←",
  "→",
  "↑",
  "↓",
  "⎋",
  "↹",
  "§",
  "±",
]);

export function processSqlRawText(text: string): string {
  let buffer = "";
  for (const char of text) {
    if (char === "⌫") {
      buffer = buffer.slice(0, -1);
    } else if (char === "⏎") {
      buffer += "\n";
    } else if (!specialChars.has(char)) {
      buffer += char;
    }
  }
  return buffer;
}

