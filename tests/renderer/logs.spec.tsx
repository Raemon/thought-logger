import React from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { FileInfo } from "../../src/frontend/logsPage/FileInfo";
import { SummaryScopeTypes } from "../../src/types/files.d";

const userData: UserData = {
  openUserDataFolder: vi.fn<UserData["openUserDataFolder"]>(),
  openDebugLogsFolder: vi.fn<UserData["openDebugLogsFolder"]>(),
  generateAISummary: vi
    .fn<UserData["generateAISummary"]>()
    .mockResolvedValue("Stub summary"),
  getRecentApps: vi.fn<UserData["getRecentApps"]>().mockResolvedValue(["foo"]),
  getRecentLogs: vi.fn<UserData["getRecentLogs"]>().mockResolvedValue([
    {
      date: new Date(2025, 7, 19),
      loading: false,
      scope: SummaryScopeTypes.Day,
      path: "fakepath.log",
      contents: "This is a daily summary",
      keylogs: [
        {
          appPath: "fakepath.by-app.log",
          chronoPath: "fakepath.chronological.log",
          rawPath: "fakepath.log",
          date: new Date(),
        },
      ],
      screenshots: [],
    },
    {
      date: new Date(2025, 7, 12),
      loading: false,
      scope: SummaryScopeTypes.Week,
      path: "fakepath.log",
      contents: "This is a weekly summary",
      keylogs: [],
      screenshots: [],
    },
  ]),
  getUserDataFolder: vi
    .fn<UserData["getUserDataFolder"]>()
    .mockResolvedValue("/User/test/files"),
  getDebugLogsFolder: vi
    .fn<UserData["getDebugLogsFolder"]>()
    .mockResolvedValue("/User/test/logs"),
  onUpdateRecentLogs: vi.fn<UserData["onUpdateRecentLogs"]>(),
  openExternalUrl: vi.fn<UserData["openExternalUrl"]>(),
  openFile: vi.fn<UserData["openFile"]>(),
  readFile: vi
    .fn<UserData["readFile"]>()
    .mockResolvedValue("fake file contents"),
  getAllLogs: vi.fn<UserData["getAllLogs"]>(),
};

vi.stubGlobal("userData", userData);

test("Renders the logs", async () => {
  const { asFragment, getByText } = render(<FileInfo />);
  await expect.element(getByText("This is a daily summary")).toBeVisible();
  expect(asFragment()).toMatchSnapshot();
});
