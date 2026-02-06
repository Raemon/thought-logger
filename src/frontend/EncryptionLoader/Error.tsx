import React from "react";

interface ErrorProps {
  error: string | null;
  onRetry: () => void;
  onSkip: () => void;
}

export function Error({ error, onRetry, onSkip }: ErrorProps) {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <h2 className="text-xl font-bold text-red-600 mb-4">Encryption Error</h2>
        <p className="text-gray-700 mb-4">{error}</p>
        <div className="flex space-x-3">
          <button
            onClick={onRetry}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
          <button
            onClick={onSkip}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded"
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}