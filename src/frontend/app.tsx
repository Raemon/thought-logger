import React, { useState, useEffect } from "react";
import { FileInfo } from "./FileInfo";
import { Permissions } from "./Permissions";
import { ScreenshotController } from "./ScreenshotController";
import BlockedAppsEditor from "./BlockedAppsEditor";
import ApiKeySettings from "./ApiKeySettings";
import SummarySettings from "./SummarySettings";
import DebugSettings from "./DebugSettings";

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
      `px-4 py-2 border-none cursor-pointer mr-0.5 ` +
      (selected
        ? "bg-white border-b-0"
        : "bg-gray-100 border-b border-gray-300")
    }
  >
    {children}
  </button>
);

export function App() {
  const [activeTab, setActiveTab] = useState<"logs" | "settings">("settings");
  const [hasLogs, setHasLogs] = useState(false);

  useEffect(() => {
    // Check if there are any log files
    window.userData.getRecentLogs().then((logs) => {
      if (logs.length > 0) {
        setHasLogs(true);
        setActiveTab("logs");
      }
    });
  }, []);

  return (
    <div className="bg-white p-4">
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

      {activeTab === "settings" && (
        <>
          <ScreenshotController />
          <SummarySettings />
          <ApiKeySettings />
          <Permissions />
          <BlockedAppsEditor />
          <DebugSettings />
        </>
      )}
    </div>
  );
}
