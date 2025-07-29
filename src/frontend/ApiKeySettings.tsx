import React, { useEffect, useState } from "react";

const ApiKeySettings = () => {
  const [apiKey, setApiKey] = useState<string>("");
  const [keyStatus, setKeyStatus] = useState<{
    hasKey: boolean;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const status = await window.openRouter.checkApiKey();
    setKeyStatus(status);
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setMessage({ text: "API key cannot be empty", isError: true });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const result = await window.openRouter.saveApiKey(apiKey);

      if (result.success) {
        setMessage({ text: result.message, isError: false });
        setApiKey("");
        checkApiKey();
      } else {
        setMessage({ text: result.message, isError: true });
      }
    } catch (error) {
      setMessage({
        text: "An error occurred while saving the API key",
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5">
      <h3 className="text-xl mb-2.5">OpenRouter API Key</h3>

      <div>
        {keyStatus && (
          <div style={{ color: keyStatus.hasKey ? "#0a0" : "#a00" }}>
            {keyStatus.message}
          </div>
        )}
      </div>

      <div>
        <input
          type="password"
          className="w-12 border-2 rounded p-1"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter OpenRouter API key"
          style={{ width: "300px" }}
        />
        <button
          onClick={saveApiKey}
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
        OpenRouter API key is required for text extraction from screenshots. Get
        your API key at{" "}
        <a
          className="text-blue-600"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.userData.openExternalUrl("https://openrouter.ai/keys");
          }}
        >
          openrouter.ai/keys
        </a>
      </div>
    </div>
  );
};

export default ApiKeySettings;
