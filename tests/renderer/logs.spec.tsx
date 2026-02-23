import React from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { FileInfo } from "../../src/frontend/logsPage/FileInfo";

const userData: UserData = {
  openUserDataFolder: vi.fn<UserData["openUserDataFolder"]>(),
  getUserDataFolder: vi
    .fn<UserData["getUserDataFolder"]>()
    .mockResolvedValue("/User/test/files"),
  openDebugLogsFolder: vi.fn<UserData["openDebugLogsFolder"]>(),
  getDebugLogsFolder: vi
    .fn<UserData["getDebugLogsFolder"]>()
    .mockResolvedValue("/User/test/logs"),
  openExternalUrl: vi.fn<UserData["openExternalUrl"]>(),
  openFile: vi.fn<UserData["openFile"]>(),
  readFile: vi
    .fn<UserData["readFile"]>()
    .mockResolvedValue("fake file contents"),
};

vi.stubGlobal("userData", userData);

test("Renders the logs", async () => {
  const { asFragment, getByText } = render(<FileInfo />);
  await expect.element(getByText("today")).toBeVisible();
  expect(asFragment()).toMatchSnapshot();
});
