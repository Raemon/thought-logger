export function parseApplicationActivatedRaw(raw: string): null | {
  appName: string;
  windowTitle: string;
} {
  const jsonMatch = raw.match(/\{\{([\s\S]*?\})\}\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as {
        appName?: string;
        windowTitle?: string;
      };
      return { appName: parsed.appName || "Unknown", windowTitle: parsed.windowTitle || "" };
    } catch {
      // Fall through to the non-JSON matcher
    }
  }

  const textMatch = raw.match(/\{\{([\s\S]*?)\}\}/);
  if (!textMatch) return null;
  return { appName: textMatch[1] || "Unknown", windowTitle: "" };
}
