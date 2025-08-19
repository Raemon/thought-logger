import React from "react";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { FileInfo } from "../../src/frontend/FileInfo";
import { SerializedScopeTypes } from "../../src/types/files.d";

const userData: UserData = {
  openUserDataFolder: vi.fn<UserData["openUserDataFolder"]>(),
  generateAISummary: vi
    .fn<UserData["generateAISummary"]>()
    .mockResolvedValue("Stub summary"),
  getRecentApps: vi.fn<UserData["getRecentApps"]>().mockResolvedValue(["foo"]),
  getRecentLogs: vi.fn<UserData["getRecentLogs"]>().mockResolvedValue([
    {
      date: new Date(2025, 8, 19),
      loading: false,
      scope: SerializedScopeTypes.Day,
      appPath: "fakepath.by-app.log",
      chronoPath: "fakepath.chronological.log",
      rawPath: "fakepath.log",
      summaryContents: "This is a daily summary",
    },
    {
      date: new Date(2025, 8, 12),
      loading: false,
      scope: SerializedScopeTypes.Week,
      appPath: "fakepath.by-app.log",
      chronoPath: "fakepath.chronological.log",
      rawPath: "fakepath.log",
      summaryContents: "This is a weekly summary",
    },
  ]),
  getUserDataFolder: vi
    .fn<UserData["getUserDataFolder"]>()
    .mockResolvedValue("/User/test/files"),
  onUpdateRecentLogs: vi.fn<UserData["onUpdateRecentLogs"]>(),
  openExternalUrl: vi.fn<UserData["openExternalUrl"]>(),
  openFile: vi.fn<UserData["openFile"]>(),
  readFile: vi
    .fn<UserData["readFile"]>()
    .mockResolvedValue("fake file contents"),
};

vi.stubGlobal("userData", userData);

beforeAll(() => {
  vi.useFakeTimers();
  const date = new Date(2025, 8, 19);
  vi.setSystemTime(date);
});

afterAll(() => {
  vi.useRealTimers();
});

test("Renders the logs", async () => {
  const { asFragment, getByText } = render(<FileInfo />);
  await expect.element(getByText("This is a daily summary")).toBeVisible();
  expect(asFragment()).toMatchSnapshot();
});
