'use client';

import { Package, Calendar, HardDrive, Check } from 'lucide-react';
import { Build } from '@/store/useTestStore';

interface BuildCardProps {
  build: Build;
  selected: boolean;
  onSelect: (buildId: string) => void;
}

export function BuildCard({ build, selected, onSelect }: BuildCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={() => onSelect(build.build_id)}
      className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
        selected
          ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${selected ? 'bg-green-100' : 'bg-gray-100'}`}>
          <Package className={`w-6 h-6 ${selected ? 'text-green-600' : 'text-gray-500'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{build.file_name}</h3>
          <p className="text-sm text-gray-500 truncate">{build.app_package}</p>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(build.uploaded_at)}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatSize(build.file_size_bytes)}
            </span>
          </div>

          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
              v{build.app_version}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
