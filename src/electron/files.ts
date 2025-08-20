import path from "path";
import fs from "node:fs/promises";
import { parse, setDefaultOptions } from "date-fns";
import { app } from "electron";
import {
  Keylog,
  Screenshot,
  Summary,
  SummaryScopeTypes,
} from "../types/files.d";

setDefaultOptions({ weekStartsOn: 1 });

export async function getRecentSummaries(): Promise<Summary[]> {
  const userDataPath = app.getPath("userData");
  const keylogsPath = path.join(userDataPath, "files", "keylogs");

  const files = await fs.readdir(keylogsPath, {
    recursive: true,
    withFileTypes: true,
  });

  const keylogs: Keylog[] = files
    .filter((file) => file.isFile())
    .map((file) => {
      const fileName = path.basename(file.name);
      const dir = file.parentPath;
      const result = fileName.match(/[^.]+/);
      const dateString = result[0];
      let date = parse(dateString, "yyyy-MM-dd", new Date());

      return {
        appPath: path.join(dir, dateString + ".processed.by-app.log"),
        chronoPath: path.join(dir, dateString + ".processed.chronological.log"),
        rawPath: path.join(dir, dateString + ".log"),
        date,
      };
    });

  const summaries: Summary[] = keylogs.map((keylog) => {
    return {
      contents: "",
      date: keylog.date,
      keylogs: [keylog],
      screenshots: [] as Screenshot[],
      loading: false,
      scope: SummaryScopeTypes.Day,
    };
  });

  return summaries;
}
