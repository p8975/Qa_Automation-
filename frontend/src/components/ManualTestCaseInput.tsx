'use client';

import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { TestCase } from '@/lib/types';

interface ManualTestCaseInputProps {
  onTestCaseCreated: (testCase: TestCase) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function ManualTestCaseInput({ onTestCaseCreated }: ManualTestCaseInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/test-cases/from-natural-language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: input.trim() }),
      });

      if (!res.ok) throw new Error('Failed to create test case');

      const data = await res.json();
      if (data.success && data.test_case) {
        onTestCaseCreated({ ...data.test_case, status: 'pending' });
        setInput('');
        setIsExpanded(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test case');
    } finally {
      setLoading(false);
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 px-4 py-3 w-full border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600"
      >
        <Plus className="w-5 h-5" />
        Add test case (natural language)
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Describe your test case in plain English
      </label>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Example: Test that user can add item to cart and verify cart count increases"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-20"
        disabled={loading}
      />
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={() => { setIsExpanded(false); setInput(''); }}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded text-sm disabled:bg-gray-300"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Add Test Case'}
        </button>
      </div>
    </div>
  );
}
