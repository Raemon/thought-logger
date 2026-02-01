import React from "react";
import { Permissions } from "./Permissions";
import { ScreenshotController } from "./ScreenshotController";
import BlockedAppsEditor from "./BlockedAppsEditor";
import ApiKeySettings from "./ApiKeySettings";
import SummarySettings from "./SummarySettings";
import DebugSettings from "./DebugSettings";
import EncryptionSettings from "./EncryptionSettings";

export const SettingsPage = () => (
  <>
    <p>
      This app takes screenshots at regular intervals (configurable below),
      and logs mouse and keyboard inputs.
    </p>
    <div className="border border-gray-300 pb-4 mt-4 shadow-sm">
      <ScreenshotController />
    </div>
    <div className="border border-gray-300 pb-4 pt-4 mt-4 shadow-sm">
      <SummarySettings />
    </div>
    <div className="border border-gray-300 pb-4 pt-4 mt-4 shadow-sm">
      <ApiKeySettings />
    </div>
    <div className="border border-gray-300 pb-4 pt-4 mt-4 shadow-sm">
      <EncryptionSettings />
    </div>
    <div className="border border-gray-300 pb-4 pt-4 shadow-sm">
      <Permissions />
    </div>
    <div className="border border-gray-300 pb-4 pt-4 shadow-sm">
      <BlockedAppsEditor />
    </div>
    <div className="pt-4 shadow-sm border-t border-gray-300 mt-4">
      <DebugSettings />
    </div>
  </>
);
