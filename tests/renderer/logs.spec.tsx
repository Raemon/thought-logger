import React from "react";
import { expect, test, vi } from "vitest";
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
      date: new Date(),
      loading: false,
      scope: SerializedScopeTypes.Day,
      appPath: "fakepath.by-app.log",
      chronoPath: "fakepath.chronological.log",
      rawPath: "fakepath.log",
      summaryContents: "This is a summary",
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

test("Renders the logs", async () => {
  const { getByText } = render(<FileInfo />);
  await expect.element(getByText("Table of Contents")).toBeInTheDocument();
});
