import React, { useEffect, useState } from "react";

const EncryptionSettings = () => {
  const [password, setPassword] = useState<string>("");
  const [passwordStatus, setPasswordStatus] = useState<{
    hasPassword: boolean;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  useEffect(() => {
    checkPassword();
  }, []);

  const checkPassword = async () => {
    const status = await window.openpgp.checkPassword();
    setPasswordStatus(status);
  };

  const savePassword = async () => {
    if (!password.trim()) {
      setMessage({ text: "Password cannot be empty", isError: true });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const result = await window.openpgp.savePassword(password);

      if (result.success) {
        setMessage({ text: result.message, isError: false });
        setPassword("");
        checkPassword();
      } else {
        setMessage({ text: result.message, isError: true });
      }
    } catch (error) {
      setMessage({
        text: "An error occurred while saving the password",
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">OpenPGP Encryption Password</h3>

      <div>
        {passwordStatus && (
          <div style={{ color: passwordStatus.hasPassword ? "#0a0" : "#a00" }}>
            {passwordStatus.message}
          </div>
        )}
      </div>

      <div>
        <input
          type="password"
          className="w-12 border-2 rounded p-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter OpenPGP password"
          style={{ width: "300px" }}
        />
        <button
          onClick={savePassword}
          disabled={isSaving}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold rounded ml-2 px-2 py-0.5"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {message && (
        <div style={{ color: message.isError ? "#a00" : "#0a0" }}>
          {message.text}
        </div>
      )}

      <div className="italic text-sm">
        OpenPGP password is used to encrypt key log files.
      </div>
    </div>
  );
};

export default EncryptionSettings;
