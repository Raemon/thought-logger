import React, { useEffect, useState } from "react";

function openFolder() {
  window.userData.openUserDataFolder();
}

export function UserFilesInfo() {
  const [dataFolder, setDataFolder] = useState("(loading)");

  useEffect(() => {
    window.userData.getUserDataFolder().then(setDataFolder);
  }, []);

  return (
    <div>
      <button onClick={openFolder} className="ml-0 border border-gray-300 rounded-md px-2 py-1">
        Open Files Folder
      </button>
      <span className="ml-2 text-xs text-gray-500">{dataFolder}</span>
    </div>
  );
}
