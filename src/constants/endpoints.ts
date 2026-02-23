export const endpointList = [
  { path: "/today", label: "today", description: "Aggregated keylogs JSON from past 24 hours" },
  { path: "/log", label: "log", description: "Keylog aggregation + discrete screenshot summaries (defaults to past 24 hours, supports ?search= and ?type=keylog|screenshot)" },
  // { path: "/log/raw", label: "log/raw", description: "Decrypted logevents JSON (keylogs + screenshot summaries) from past 24 hours (supports ?type=keylog|screenshot)" },
  { path: "/yesterday", label: "yesterday", description: "Aggregated keylogs JSON from previous midnight to midnight" },
  { path: "/week", label: "week", description: "Aggregated keylogs JSON from past 168 hours" },
];

export const otherEndpoints = [
  { path: "/health", label: "health", description: "Past week per-minute activity overview" },
];

// Combined list for the index page
export const allEndpoints = [
  ...endpointList.map(({ path, description }) => ({ path, description })),
  ...otherEndpoints,
];
