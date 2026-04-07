'use client';

import { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { TestCase } from '@/lib/types';

interface ExportButtonProps {
  testCases: TestCase[];
  documentName: string;
}

export function ExportButton({ testCases, documentName }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  const exportJSON = () => {
    const data = { document_name: documentName, test_cases: testCases };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `test-cases-${documentName.replace(/\.[^/.]+$/, '')}.json`);
    setShowMenu(false);
  };

  const exportCSV = () => {
    const headers = ['ID', 'Title', 'Description', 'Steps', 'Expected Result', 'Priority', 'Status'];
    const rows = testCases.map(tc => [
      tc.id,
      `"${tc.title.replace(/"/g, '""')}"`,
      `"${tc.description.replace(/"/g, '""')}"`,
      `"${tc.steps.join('; ').replace(/"/g, '""')}"`,
      `"${tc.expected_result.replace(/"/g, '""')}"`,
      tc.priority,
      tc.status || 'pending',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `test-cases-${documentName.replace(/\.[^/.]+$/, '')}.csv`);
    setShowMenu(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className="w-4 h-4" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <button onClick={exportJSON} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">
              Export JSON
            </button>
            <button onClick={exportCSV} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-t border-gray-100">
              Export CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
