import React, { useEffect, useState } from "react";
import { FileInfo } from "./logsPage/FileInfo";
import { SettingsPage } from "./settingsPage/SettingsPage";
import { TabContainer, Tab } from "./TabContainer";
import EncryptionSettings from "./settingsPage/EncryptionSettings";
import { EncryptionLoader } from "./EncryptionLoader";
import { LOG_FILE_ENCRYPTION } from "../constants/credentials";

export function App() {
  const [recentErrors, setRecentErrors] = useState<string[]>([]);
  const [defaultTab] = useState<"logs" | "settings">("settings");
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [encryptionComplete, setEncryptionComplete] = useState(false);
  const [shouldEncrypt, setShouldEncrypt] = useState(false);

  const handlePasswordSet = () => {
    setHasPassword(true);
    // After password is set, check if we need to encrypt files
    window.encryption.countUnencryptedFiles().then((count) => {
      if (count > 0) {
        setShouldEncrypt(true);
      } else {
        setEncryptionComplete(true);
      }
    });
  };

  const handleEncryptionComplete = () => {
    setEncryptionComplete(true);
    setShouldEncrypt(false);
  };

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
      if (status) {
        // If password is set, check if we need to encrypt files
        window.encryption.countUnencryptedFiles().then((count) => {
          if (count > 0) {
            setShouldEncrypt(true);
          } else {
            setEncryptionComplete(true);
          }
        });
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
      {shouldEncrypt && !encryptionComplete && (
        <EncryptionLoader onComplete={handleEncryptionComplete} />
      )}
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
      {hasPassword === null || (shouldEncrypt && !encryptionComplete) ? (
        <div>Loading...</div>
      ) : hasPassword === false ? (
        <div className="max-w-md mx-auto">
          <p className="mb-6 text-gray-600">
            Please set an encryption password to secure your logs before
            continuing.
          </p>
          <EncryptionSettings onPasswordSet={handlePasswordSet} />
        </div>
      ) : (
        <TabContainer defaultTab={defaultTab}>
          <Tab id="logs" label="API">
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
