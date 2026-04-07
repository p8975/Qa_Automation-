'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';

interface FileUploaderProps {
  accept?: string;
  label: string;
  description?: string;
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClear?: () => void;
  showProgress?: boolean;
  progress?: number;
}

export function FileUploader({
  accept = '.pdf,.doc,.docx,.txt,.md',
  label,
  description,
  onFileSelect,
  selectedFile,
  onClear,
  showProgress = false,
  progress = 0,
}: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  if (selectedFile) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showProgress && progress < 100 ? (
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {onClear && (
              <button
                onClick={onClear}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        {showProgress && progress < 100 && (
          <p className="text-xs text-gray-500 mt-2">Uploading... {progress}%</p>
        )}
      </div>
    );
  }

  return (
    <label
      className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        dragActive
          ? 'border-green-500 bg-green-50'
          : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center py-4">
        <Upload
          className={`w-10 h-10 mb-3 ${
            dragActive ? 'text-green-500' : 'text-gray-400'
          }`}
        />
        <p className="mb-1 text-sm text-gray-600">
          <span className="font-semibold">{label}</span>
        </p>
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
      </div>
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleChange}
      />
    </label>
  );
}
