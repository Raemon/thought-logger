import React from "react";

interface CompleteProps {
  totalFiles: number;
  processedFiles: string[];
  onComplete: () => void;
}

export function Complete({ totalFiles, processedFiles, onComplete }: CompleteProps) {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          Encryption Complete
        </h2>
        
        <div className="mb-6">
          {totalFiles > 0 ? (
            <>
              <p className="text-lg font-semibold text-green-600 mb-3">
                {totalFiles} files successfully encrypted
              </p>
              {processedFiles.length > 0 && (
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-700 mb-2">Files encrypted:</p>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <ul className="text-xs text-gray-600 space-y-1">
                      {processedFiles.slice(-5).map((fileName, index) => (
                        <li key={index} className="flex items-center">
                          <svg className="w-3 h-3 mr-2 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {fileName}
                        </li>
                      ))}
                      {processedFiles.length > 5 && (
                        <li className="text-gray-400 italic">... and {processedFiles.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-600">All files are already encrypted</p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-700">
            <strong>Your data is now secure!</strong> All files are encrypted and can only be accessed with your password.
          </p>
        </div>

        <button
          onClick={onComplete}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Continue to App
        </button>
      </div>
    </div>
  );
}