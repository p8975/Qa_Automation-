'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { TestCase } from '@/lib/types';

interface TestCaseTableProps {
  testCases: TestCase[];
  onUpdateTestCase: (id: string, updates: Partial<TestCase>) => void;
}

type StatusType = 'pending' | 'good' | 'needs_edit' | 'useless';

const STATUS_OPTIONS: { value: StatusType; label: string }[] = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'good', label: 'Good' },
  { value: 'needs_edit', label: 'Needs Edit' },
  { value: 'useless', label: 'Useless' },
];

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-gray-700',
};

const STATUS_COLORS: Record<StatusType, string> = {
  pending: 'bg-gray-100 text-gray-600',
  good: 'bg-green-100 text-green-700',
  needs_edit: 'bg-yellow-100 text-yellow-700',
  useless: 'bg-red-100 text-red-700',
};

export function TestCaseTable({ testCases, onUpdateTestCase }: TestCaseTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TestCase>>({});

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setEditingId(null);
  };

  const startEditing = (tc: TestCase) => {
    setEditingId(tc.id);
    setEditForm({
      title: tc.title,
      description: tc.description,
      expected_result: tc.expected_result,
      steps: tc.steps,
      preconditions: tc.preconditions,
    });
  };

  const saveEdit = (id: string) => {
    onUpdateTestCase(id, editForm);
    setEditingId(null);
  };

  const handleStatusChange = (id: string, status: StatusType) => {
    onUpdateTestCase(id, { status });
  };

  const stats = {
    total: testCases.length,
    good: testCases.filter(tc => tc.status === 'good').length,
    needsEdit: testCases.filter(tc => tc.status === 'needs_edit').length,
    useless: testCases.filter(tc => tc.status === 'useless').length,
    pending: testCases.filter(tc => !tc.status || tc.status === 'pending').length,
  };

  return (
    <div>
      {/* Stats Bar */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-gray-600">Total: {stats.total}</span>
        <span className="text-green-600">Good: {stats.good}</span>
        <span className="text-yellow-600">Needs Edit: {stats.needsEdit}</span>
        <span className="text-red-600">Useless: {stats.useless}</span>
        <span className="text-gray-500">Pending: {stats.pending}</span>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {testCases.map((tc) => (
          <div key={tc.id} className="border-b border-gray-200 last:border-b-0">
            {/* Row Header */}
            <div className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-gray-50">
              <button onClick={() => toggleExpand(tc.id)} className="text-gray-400 hover:text-gray-600">
                {expandedId === tc.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <span className="font-mono text-sm text-gray-400 w-16">{tc.id}</span>
              <span
                className="flex-1 font-medium text-gray-900 truncate cursor-pointer hover:text-blue-600"
                onClick={() => toggleExpand(tc.id)}
              >
                {tc.title}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${PRIORITY_COLORS[tc.priority]}`}>
                {tc.priority}
              </span>

              {/* Status Dropdown */}
              <select
                value={tc.status || 'pending'}
                onChange={(e) => handleStatusChange(tc.id, e.target.value as StatusType)}
                className={`px-3 py-1.5 rounded text-sm font-medium border-0 cursor-pointer ${STATUS_COLORS[tc.status || 'pending']}`}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {/* Expanded Content */}
            {expandedId === tc.id && (
              <div className="px-4 py-4 bg-gray-50 border-t border-gray-200">
                {editingId === tc.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={editForm.title || ''}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Steps (one per line)</label>
                      <textarea
                        value={(editForm.steps || []).join('\n')}
                        onChange={(e) => setEditForm({ ...editForm, steps: e.target.value.split('\n').filter(s => s.trim()) })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-32 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expected Result</label>
                      <textarea
                        value={editForm.expected_result || ''}
                        onChange={(e) => setEditForm({ ...editForm, expected_result: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(tc.id)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Description: </span>
                      <span className="text-gray-600">{tc.description}</span>
                    </div>
                    {tc.preconditions && tc.preconditions.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">Preconditions:</span>
                        <ul className="list-disc list-inside text-gray-600 ml-2">
                          {tc.preconditions.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-700">Steps:</span>
                      <ol className="list-decimal list-inside text-gray-600 ml-2">
                        {tc.steps.map((s, i) => <li key={i}>{s.replace(/^\d+\.\s*/, '')}</li>)}
                      </ol>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Expected Result: </span>
                      <span className="text-gray-600">{tc.expected_result}</span>
                    </div>
                    <button
                      onClick={() => startEditing(tc)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
