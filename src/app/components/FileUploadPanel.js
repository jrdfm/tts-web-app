import { useState } from 'react';

/**
 * FileUploadPanel Component
 * Handles file drag & drop and upload functionality
 */
export default function FileUploadPanel({ onFileContent }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file input change
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    processFile(selectedFile);
  };

  // Process the file and extract content
  const processFile = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      
      // Read the file content and call the callback
      const reader = new FileReader();
      reader.onload = (event) => {
        onFileContent(event.target.result);
      };
      reader.readAsText(selectedFile);
    }
  };

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      processFile(droppedFile);
    }
  };

  return (
    <div className="p-2 pt-16">
      <div 
        className={`flex flex-col items-center justify-center p-2 border-2 border-dashed ${
          isDragging ? 'border-[#e25822] bg-[#2a2a2a]' : 'border-gray-700 bg-[#222222]'
        } rounded-md hover:border-[#e25822] transition-colors cursor-pointer`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Upload Icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <input
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="px-2 py-1 bg-[#2a2a2a] rounded-md text-xs text-white hover:bg-[#333333] cursor-pointer text-center w-full">
          Browse
        </label>
        {file && (
          <div className="mt-2 text-xs text-gray-300 truncate max-w-full overflow-hidden text-center">
            {file.name.length > 8 ? file.name.substring(0, 8) + '...' : file.name}
          </div>
        )}
      </div>
    </div>
  );
} 