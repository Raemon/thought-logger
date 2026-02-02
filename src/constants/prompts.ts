export const DEFAULT_SCREENSHOT_PROMPT = `
Analyze this screenshot and extract information about all visible windows. For each window, identify:
- The window title
- The application name
- The URL (if applicable)
- All exact text visible in the window
- A summary of the window's content
- Any frames within the window (with their titles and exact text)
- Any images in the window (with descriptions)

Also provide an overall summary of the entire screenshot.

Return only valid JSON matching this structure:
{
  "windows": [
    {
      "title": "window title",
      "applicationName": "application name",
      "url": "url if applicable",
      "exactText": "all text visible in window",
      "summary": "summary of window content",
      "frames": [
        {
          "title": "frame title",
          "exactText": "exact text in frame"
        }
      ],
      "images": [
        {
          "description": "description of image"
        }
      ]
    }
  ],
  "summary": "overall summary of screenshot"
}

Include no other text but the JSON.
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
