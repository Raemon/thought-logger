export const DEFAULT_SCREENSHOT_PROMPT = `
Analyze this screenshot and extract information about all visible windows.

For each window visible:
- title: the window title (or, "skipped")
- applicationName: the application (e.g. Chrome, VSCode, Slack) (or, "skipped")
- url: if a browser, the URL shown in the address bar, otherwise empty string (or, "skipped")
- exactText: copy all visible text exactly as shown (or, "skipped")
- frames: any distinct sections/frames within the window (e.g. sidebar, chat panels) with their title and text
- images: descriptions of any images visible

IMPORTANT: If any browser window appears to be in incognito/private mode, or looking at nsfw things, or looking at passwords, api keys or credit card numbers, set title, applicationName and url and exactText to "skipped", frames to [], and images to [], and 
`
