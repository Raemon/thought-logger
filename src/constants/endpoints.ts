export const endpointList = [
  { path: "/today", label: "today", description: "Today's processed keylog" },
  { path: "/today/raw", label: "today/raw", description: "Today's raw keylog" },
  { path: "/today/screenshots", label: "today/screenshots", description: "Today's screenshot image paths" },
  { path: "/today/screenshots/all", label: "today/screenshots/all", description: "Today's screenshot images gallery" },
  { path: "/today/screenshots/summaries", label: "today/summaries", description: "Today's screenshot summaries" },
  { path: "/yesterday", label: "yesterday", description: "Yesterday's processed keylog" },
  { path: "/yesterday/raw", label: "yesterday/raw", description: "Yesterday's raw keylog" },
  { path: "/yesterday/screenshots", label: "yesterday/screenshots", description: "Yesterday's screenshot image paths" },
  { path: "/yesterday/screenshots/all", label: "yesterday/screenshots/all", description: "Yesterday's screenshot images gallery" },
  { path: "/yesterday/screenshots/summaries", label: "yesterday/summaries", description: "Yesterday's screenshot summaries" },
  { path: "/week", label: "week", description: "Past week processed keylogs" },
  { path: "/week/raw", label: "week/raw", description: "Past week raw keylogs" },
  { path: "/sql", label: "sql", description: "Processed SQL logitems past 24h (newest to oldest)" },
  { path: "/sql/raw", label: "sql/raw", description: "Raw SQL logitems past 24h (JSON)" },
];

// These endpoints have dynamic paths and are not directly linkable from the UI
export const dynamicEndpoints = [
  { path: "/screenshot/[filepath]", label: "Screenshot", description: "Serve a screenshot image" },
  { path: "/mcp", label: "MCP", description: "MCP server endpoint" },
  { path: "/YYYY-MM-DD", label: "Keylog", description: "Processed keylog for date" },
  { path: "/YYYY-MM-DD/screenshots", label: "Screenshots", description: "Screenshot images for date" },
  { path: "/YYYY-MM-DD/screenshots/summaries", label: "Summaries", description: "Screenshot summaries for date" },
];

// Combined list for the index page
export const allEndpoints = [
  ...endpointList.map(({ path, description }) => ({ path, description })),
  ...dynamicEndpoints,
];
