import React, { useCallback, useEffect, useState } from "react";

const EncryptionSettings = () => {
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [passwordStatus, setPasswordStatus] = useState<{
    hasPassword: boolean;
    message: string;
  } | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  useEffect(() => {
    checkPassword();
  }, []);

  const checkPassword = async () => {
    const status = await window.encryption.checkPassword();
    setPasswordStatus(status);
  };

  const savePassword = async () => {
    setSaving(true);

    try {
      const result = await window.encryption.changePassword(password);

      if (result.success) {
        setMessage({ text: result.message, isError: false });
        setPassword("");
        setConfirmation("");
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
      setSaving(false);
    }
  };

  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">Encryption Password</h3>

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
          className="w-12 border-2 rounded p-1 block"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter encryption password"
          style={{ width: "300px" }}
        />
        <input
          type="password"
          className="w-12 border-2 rounded p-1 block"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Confirm encryption password"
          style={{ width: "300px" }}
        />
        <button
          onClick={savePassword}
          disabled={saving || password !== confirmation}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold rounded ml-2 px-2 py-0.5"
        >
          {saving
            ? "Saving..."
            : password !== confirmation
              ? "Passwords don't match"
              : "Save Password"}
        </button>
      </div>

      {message && (
        <div style={{ color: message.isError ? "#a00" : "#0a0" }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default EncryptionSettings;
