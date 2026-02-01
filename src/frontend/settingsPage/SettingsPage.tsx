import { UserFilesInfo } from "./UserFilesInfo";
import { ScreenshotController } from "./ScreenshotController";
import SummarySettings from "./SummarySettings";
import ApiKeySettings from "./ApiKeySettings";
import EncryptionSettings from "./EncryptionSettings";
import { Permissions } from "./Permissions";
import BlockedAppsEditor from "./BlockedAppsEditor";
import DebugSettings from "./DebugSettings";

export const SettingsPage = () => {
  return (
    <>
      <UserFilesInfo />
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
};
