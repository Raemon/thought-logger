import { app } from "electron";
import { Summary } from "../types/files.d";

export async function getRecentSummaries(): Promise<Summary[]> {
  const userDataPath = app.getPath("userData");
  return Promise.resolve([]);
}
