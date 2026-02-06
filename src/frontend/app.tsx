import React, { useEffect, useState } from "react";
import { FileInfo } from "./logsPage/FileInfo";
import { SettingsPage } from "./settingsPage/SettingsPage";
import { TabContainer, Tab } from "./TabContainer";
import EncryptionSettings from "./settingsPage/EncryptionSettings";
import { LOG_FILE_ENCRYPTION } from "../constants/credentials";

export function App() {
  const [_, setHasLogs] = useState(false);
  const [recentErrors, setRecentErrors] = useState<string[]>([]);
  const [defaultTab, setDefaultTab] = useState<"logs" | "settings">("settings");
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  const formatErrorLine = (line: string) => {
    const match = line.match(
      /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)\s+(.*)$/,
    );
    if (!match) return { timestamp: null, rest: line };
    const iso = match[1];
    const rest = match[2];
    const d = new Date(iso);
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const date = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return { timestamp: `${time} ${date}`, rest };
  };

  useEffect(() => {
    // Check if encryption password is set
    window.credentials.checkSecret(LOG_FILE_ENCRYPTION).then((status) => {
      setHasPassword(status);
    });

    // Check if there are any log files
    window.userData.getRecentLogs().then((logs) => {
      if (logs.length > 0) {
        setHasLogs(true);
        setDefaultTab("logs");
      }
    });
  }, []);

  useEffect(() => {
    window.errors.getRecentErrors().then((errors) => setRecentErrors(errors));
    const cleanup = window.errors.onRecentErrors((errors) =>
      setRecentErrors(errors),
    );
    return cleanup;
  }, []);

  return (
    <div className="bg-white p-4">
      {recentErrors.map((error, idx) => {
        const { timestamp, rest } = formatErrorLine(error);
        return (
          <div
            key={idx}
            className="text-red-700 text-sm truncate"
            title={error}
          >
            {timestamp ? (
              <>
                <span className="text-gray-600">{timestamp}</span> {rest}
              </>
            ) : (
              error
            )}
          </div>
        );
      })}
      {recentErrors.length > 0 && <div className="mb-2" />}
      {hasPassword === null ? (
        <div>Loading...</div>
      ) : hasPassword === false ? (
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">Welcome to Thought Logger</h2>
          <p className="mb-6 text-gray-600">
            Please set an encryption password to secure your thought logs before
            continuing.
          </p>
          <EncryptionSettings onPasswordSet={() => setHasPassword(true)} />
        </div>
      ) : (
        <TabContainer defaultTab={defaultTab}>
          <Tab id="logs" label="Logs">
            <FileInfo />
          </Tab>
          <Tab id="settings" label="Settings">
            <SettingsPage />
          </Tab>
        </TabContainer>
      )}
    </div>
  );
}
