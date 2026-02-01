import React, { useState, useEffect } from "react";
import { FileInfo } from "./logsPage/FileInfo";
import { SettingsPage } from "./settingsPage/SettingsPage";

const TabButton = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={
      `px-4 py-2 cursor-pointer mr-0.5 -mb-px ` +
      (selected
        ? "bg-white border-t border-l border-r border-gray-300 border-b-0"
        : "border-transparent border-t border-l border-r")
    }
  >
    {children}
  </button>
);

export function App() {
  const [activeTab, setActiveTab] = useState<"logs" | "settings">("settings");
  const [_, setHasLogs] = useState(false);
  const [recentErrors, setRecentErrors] = useState<string[]>([]);

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
    // Check if there are any log files
    window.userData.getRecentLogs().then((logs) => {
      if (logs.length > 0) {
        setHasLogs(true);
        setActiveTab("logs");
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
      <div className="border-b border-gray-300 mb-4">
        <TabButton
          selected={activeTab === "logs"}
          onClick={() => setActiveTab("logs")}
        >
          Logs
        </TabButton>
        <TabButton
          selected={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </TabButton>
      </div>

      {activeTab === "logs" && <FileInfo />}

      {activeTab === "settings" && <SettingsPage />}
    </div>
  );
}
