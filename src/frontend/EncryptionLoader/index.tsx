import React, { useState, useEffect } from "react";
import { Loading } from "./Loading";
import { Confirmation } from "./Confirmation";
import { Encrypting } from "./Encrypting";
import { Error } from "./Error";
import { Complete } from "./Complete";

interface EncryptionProgress {
  current: number;
  total: number;
  fileName: string;
  percentage: number;
}

interface EncryptionLoaderProps {
  onComplete: () => void;
}

type EncryptionState =
  | "loading"
  | "confirmation"
  | "encrypting"
  | "complete"
  | "error";

export function EncryptionLoader({ onComplete }: EncryptionLoaderProps) {
  const [state, setState] = useState<EncryptionState>("loading");
  const [progress, setProgress] = useState<EncryptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]);

  useEffect(() => {
    const checkFiles = async (): Promise<void> => {
      try {
        const count = await window.encryption.countUnencryptedFiles();
        setTotalFiles(count);

        if (count === 0) {
          // No files to encrypt, just complete
          setState("complete");
        } else {
          setState("confirmation");
        }
      } catch (err) {
        const errorMessage = err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Failed to check files";
        setError(errorMessage);
        setState("error");
      }
    };

    checkFiles();
  }, []);

  const startEncryption = async (): Promise<void> => {
    try {
      setState("encrypting");
      setProcessedFiles([]);

      const cleanup = window.encryption.onEncryptionProgress((progress) => {
        setProgress(progress);
        setProcessedFiles((prev) => [...prev, progress.fileName]);

        if (progress.current === progress.total) {
          // Encryption complete
          setTimeout(() => {
            setState("complete");
          }, 500);
        }
      });

      await window.encryption.encryptAllFiles();
      cleanup();
    } catch (err) {
      const errorMessage = err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Failed to encrypt files";
      setError(errorMessage);
      setState("error");
    }
  };

  const handleRetry = (): void => {
    window.location.reload();
  };

  const handleSkip = (): void => {
    onComplete();
  };

  const handleComplete = (): void => {
    onComplete();
  };

  const handleCancel = (): void => {
    window.location.reload();
  };

  // Render appropriate state component
  switch (state) {
    case "loading":
      return <Loading />;
    
    case "confirmation":
      return (
        <Confirmation
          totalFiles={totalFiles}
          onStartEncryption={startEncryption}
          onCancel={handleCancel}
        />
      );
    
    case "encrypting":
      return <Encrypting progress={progress} />;
    
    case "error":
      return (
        <Error
          error={error}
          onRetry={handleRetry}
          onSkip={handleSkip}
        />
      );
    
    case "complete":
      return (
        <Complete
          totalFiles={totalFiles}
          processedFiles={processedFiles}
          onComplete={handleComplete}
        />
      );
    
    default:
      return null;
  }
}