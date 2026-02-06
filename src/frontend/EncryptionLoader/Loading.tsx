import React from "react";

interface LoadingProps {
  message?: string;
}

export function Loading({ message = "Counting files that need encryption..." }: LoadingProps) {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {message === "Counting files that need encryption..." ? "Checking Files" : "Loading"}
        </h2>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}