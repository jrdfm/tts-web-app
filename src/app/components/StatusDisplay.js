import React from 'react';

/**
 * StatusDisplay Component
 * Displays status updates and error messages
 */
export default function StatusDisplay({ status, error }) {
  if (!status && !error) return null;
  
  return (
    <div className="mt-4 text-center">
      {status && (
        <div className="text-sm text-gray-300">
          {status}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
} 