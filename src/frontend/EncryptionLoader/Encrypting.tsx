import React from "react";

interface EncryptionProgress {
  current: number;
  total: number;
  fileName: string;
  percentage: number; // TODO: calculate this
}

interface EncryptingProps {
  progress: EncryptionProgress | null;
}

export function Encrypting({ progress }: EncryptingProps) {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Encrypting Files
        </h2>

        {progress && (
          <div className="w-full">
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>
                  {progress.current} / {progress.total} files
                </span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                ></div>
              </div>
            </div>
            <p className="text-sm text-gray-500 truncate">
              {progress.fileName}
            </p>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-4">
          Please wait while we secure your thought logs...
        </p>
      </div>
    </div>
  );
}
