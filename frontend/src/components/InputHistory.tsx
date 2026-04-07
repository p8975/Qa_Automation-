'use client';

import { useState, useEffect } from 'react';
import { History, FileText, MessageSquare, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

interface InputHistoryEntry {
  id: string;
  input_type: 'prd_upload' | 'natural_language';
  filename: string | null;
  content_preview: string;
  file_size_bytes: number | null;
  test_cases_generated: number;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function InputHistory() {
  const [entries, setEntries] = useState<InputHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/input-history`);
      if (res.ok) setEntries(await res.json());
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) fetchHistory();
  }, [isExpanded]);

  const handleDelete = async (entryId: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/input-history/${entryId}`, { method: 'DELETE' });
      if (res.ok) setEntries(prev => prev.filter(e => e.id !== entryId));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <History className="w-4 h-4" />
        History
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">Input History</span>
          <span className="text-xs text-gray-500">({entries.length})</span>
        </div>
        <button onClick={() => setIsExpanded(false)} className="text-sm text-gray-500 hover:text-gray-700">
          Close
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">No history yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {entry.input_type === 'prd_upload' ? (
                    <FileText className="w-4 h-4 text-blue-500" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {entry.input_type === 'prd_upload' ? entry.filename : 'Natural Language Input'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(entry.created_at)} · {entry.test_cases_generated} test cases
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {expandedId === entry.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDelete(entry.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {expandedId === entry.id && (
                  <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600 font-mono whitespace-pre-wrap">
                    {entry.content_preview}{entry.content_preview.length >= 500 && '...'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
