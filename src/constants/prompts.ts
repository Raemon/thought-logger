export const DEFAULT_SCREENSHOT_PROMPT = `
Summarize the contents of this screenshot. Include the application is in use, project names, filename or document title. If a chat app is in use, give the channel name. Include each section of the screen with text in it, with an exact copy of all text. Include a summary of images on the screen. Organize the summary into titled sections.

Return it as json formatted like:

{
"filename": string,
"applicationName": string,
"windowTitle": string,
"channelName": string,
"textSummary": string,
"imagesSummary": string,
"textExactContents": string
}

fill in as many details as you can. Include no other text but the json.
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
