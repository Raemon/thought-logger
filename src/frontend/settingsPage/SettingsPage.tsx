import { UserFilesInfo } from "./UserFilesInfo";
import { ScreenshotController } from "./ScreenshotController";
import ApiKeySettings from "./ApiKeySettings";
import EncryptionSettings from "./EncryptionSettings";
import { Permissions } from "./Permissions";
import BlockedAppsEditor from "./BlockedAppsEditor";
import DebugSettings from "./DebugSettings";

export const SettingsPage = () => {
  return (
    <>
      <UserFilesInfo />
      <div className="border border-gray-300 pb-4 pt-4 shadow-sm mt-3">
        <Permissions />
      </div>
      <div className="border border-gray-300 pb-4 mt-3 shadow-sm">
        <ScreenshotController />
      </div>
      <div className="border border-gray-300 pb-4 pt-4 mt-3 shadow-sm">
        <ApiKeySettings />
      </div>
      <div className="border border-gray-300 pb-4 pt-4 mt-3 shadow-sm">
        <EncryptionSettings />
      </div>  
      <div className="border border-gray-300 pb-4 pt-4 shadow-sm mt-3">
        <BlockedAppsEditor />
      </div>
      <div className="pt-4 shadow-sm border border-gray-300 mt-3">
        <DebugSettings />
      </div>
    </>
  );
};
