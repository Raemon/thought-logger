import React, { useEffect, useState } from "react";

const EncryptionSettings = () => {
  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">Encryption Password</h3>

      <div className="flex items-center mb-2.5">
        <input
          type="checkbox"
          id="encrypt"
          className="mr-2 h-5 w-5"
          // checked={debugPrefs.encryptFiles}
          // onChange={(e) => handleEncryptFilesChange(e.target.checked)}
        />
        <label htmlFor="encrypt" className="text-lg">
          Encrypt log files and screenshots
        </label>
      </div>

      <div>
        <input
          type="password"
          className="w-12 border-2 rounded p-1 block"
          // value={password}
          // onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter encryption password"
          style={{ width: "300px" }}
        />
        <input
          type="password"
          className="w-12 border-2 rounded p-1 block"
          // value={passwordConfirmation}
          // onChange={(e) => setPasswordConfirmation(e.target.value)}
          placeholder="Confirm encryption password"
          style={{ width: "300px" }}
        />
        <button
          // onClick={savePassword}
          // disabled={isSaving}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold rounded ml-2 px-2 py-0.5"
        >
          {
            // isSaving ? "Saving..." : "Save Password"
          }
          Save Password
        </button>
      </div>

      <div>Master key is present at /files/masterkey</div>
    </div>
  );
};

export default EncryptionSettings;
