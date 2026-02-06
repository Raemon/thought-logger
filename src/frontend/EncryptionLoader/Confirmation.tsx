import React from "react";

interface ConfirmationProps {
  totalFiles: number;
  onStartEncryption: () => void;
  onCancel: () => void;
}

export function Confirmation({ totalFiles, onStartEncryption, onCancel }: ConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          Encrypt Files
        </h2>
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-lg font-semibold text-blue-800">
              {totalFiles} files need encryption
            </p>
            <p className="text-sm text-blue-600 mt-1">
              These files will be secured with your encryption password
            </p>
          </div>
          <div className="text-left text-sm text-gray-600 space-y-2">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Files are encrypted with military-grade security
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Only accessible with your password
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Original files are securely deleted
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onStartEncryption}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Start Encryption
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}