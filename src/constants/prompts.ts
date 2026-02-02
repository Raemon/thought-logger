export const DEFAULT_SCREENSHOT_PROMPT = `
Analyze this screenshot and extract information about all visible windows.

For each window visible:
- title: the window title
- applicationName: the application (e.g. Chrome, VSCode, Slack)
- url: if a browser, the URL shown in the address bar, otherwise empty string
- exactText: copy all visible text exactly as shown
- summary: brief summary of what the window shows
- frames: any distinct sections/frames within the window (e.g. sidebar, chat panels) with their title and text
- images: descriptions of any images visible

Provide an overall summary of what's happening on screen.
`

export const DEFAULT_DAILY_SUMMARY_PROMPT =`
Analyze this computer activity log, and summarize any surprising updates or things I am likely to want to remember in a few months.

Don't summarize projects, just surprising/interesting things. Write just one short sentence per thing. If there's too much to read my eyes will glaze over. These should be in short sentence fragments.

List the documents I was working on at the end, but, just as a short list of document titles.

ignore nswf things
`

export const DEFAULT_WEEKLY_SUMMARY_PROMPT =
  "Please analyze this computer activity log and summarize the major projects and tasks worked on:";

export const SUMMARIZER_SYSTEM_PROMPT =
  "You are a helpful assistant that analyzes computer activity logs and identifies major projects and tasks worked on. Focus on identifying distinct projects, and significant activities. Be concise but informative.";
