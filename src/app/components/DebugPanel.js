import React, { useState, useEffect } from 'react';

/**
 * DebugPanel Component
 * Displays server debug information from various endpoints
 */
export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugData, setDebugData] = useState({
    threads: null,
    storage: null,
    system: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const togglePanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen && !debugData.threads && !debugData.storage && !debugData.system) {
      fetchAllDebugData();
    }
  };

  const fetchAllDebugData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch all debug endpoints in parallel - using the correct paths
      const [threadsRes, storageRes, systemRes] = await Promise.all([
        fetch('http://localhost:8880/dev/debug/threads'),
        fetch('http://localhost:8880/dev/debug/storage'),
        fetch('http://localhost:8880/dev/debug/system')
      ]);
      
      // Check for response errors
      if (!threadsRes.ok || !storageRes.ok || !systemRes.ok) {
        throw new Error('One or more debug endpoints returned an error');
      }
      
      // Process the responses
      const threads = await threadsRes.json();
      const storage = await storageRes.json();
      const system = await systemRes.json();
      
      setDebugData({
        threads,
        storage,
        system
      });
    } catch (err) {
      console.error('Error fetching debug data:', err);
      setError(`Error fetching debug data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDebugData = () => {
    fetchAllDebugData();
  };

  return (
    <div className={`fixed bottom-0 right-0 z-50 bg-[#1a1a1a] border-l border-t border-gray-800 
      transition-all duration-300 ${isOpen ? 'w-[500px] h-[400px]' : 'w-[100px] h-[40px]'}`}>
      
      {/* Header */}
      <div 
        className="flex justify-between items-center p-2 bg-[#252525] cursor-pointer"
        onClick={togglePanel}
      >
        <h3 className="text-white font-medium text-sm">Server Debug</h3>
        {isOpen && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              refreshDebugData();
            }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
          >
            Refresh
          </button>
        )}
      </div>
      
      {/* Content */}
      {isOpen && (
        <div className="p-4 h-[calc(100%-40px)] overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-400">Loading debug data...</p>
            </div>
          ) : error ? (
            <div className="text-red-400 p-4 border border-red-800 rounded">
              <p>{error}</p>
              <p className="mt-2 text-sm">Make sure the server is running and the debug endpoints are accessible.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* System Info */}
              <div className="bg-[#222] p-3 rounded border border-gray-700">
                <h4 className="text-white font-medium mb-2">System Info</h4>
                {debugData.system ? (
                  <pre className="text-gray-300 text-xs overflow-auto max-h-[100px]">
                    {JSON.stringify(debugData.system, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-400 text-xs">No system data available</p>
                )}
              </div>
              
              {/* Threads Info */}
              <div className="bg-[#222] p-3 rounded border border-gray-700">
                <h4 className="text-white font-medium mb-2">Threads Info</h4>
                {debugData.threads ? (
                  <pre className="text-gray-300 text-xs overflow-auto max-h-[100px]">
                    {JSON.stringify(debugData.threads, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-400 text-xs">No threads data available</p>
                )}
              </div>
              
              {/* Storage Info */}
              <div className="bg-[#222] p-3 rounded border border-gray-700">
                <h4 className="text-white font-medium mb-2">Storage Info</h4>
                {debugData.storage ? (
                  <pre className="text-gray-300 text-xs overflow-auto max-h-[100px]">
                    {JSON.stringify(debugData.storage, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-400 text-xs">No storage data available</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 