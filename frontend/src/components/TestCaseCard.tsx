'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Pencil, ThumbsUp, ThumbsDown, Save } from 'lucide-react';
import { TestCase } from '@/store/useTestStore';

interface TestCaseCardProps {
  testCase: TestCase;
  onUpdate: (id: string, updates: Partial<TestCase>) => void;
  onToggleSelect: (id: string) => void;
  showSelection?: boolean;
}

const PRIORITY_COLORS = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-gray-700',
};

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-600',
  good: 'bg-green-100 text-green-700',
  useless: 'bg-red-100 text-red-700',
  edited: 'bg-blue-100 text-blue-700',
};

export function TestCaseCard({
  testCase,
  onUpdate,
  onToggleSelect,
  showSelection = true,
}: TestCaseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: testCase.title,
    description: testCase.description,
    steps: testCase.steps.join('\n'),
    expected_result: testCase.expected_result,
  });

  const handleSaveEdit = () => {
    onUpdate(testCase.id, {
      title: editForm.title,
      description: editForm.description,
      steps: editForm.steps.split('\n').filter((s) => s.trim()),
      expected_result: editForm.expected_result,
      status: 'edited',
    });
    setEditing(false);
  };

  const handleMarkGood = () => {
    onUpdate(testCase.id, { status: 'good' });
  };

  const handleMarkUseless = () => {
    onUpdate(testCase.id, { status: 'useless', selected: false });
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        testCase.selected ? 'border-green-300 bg-green-50/30' : 'border-gray-200 bg-white'
      } ${testCase.status === 'useless' ? 'opacity-50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {showSelection && (
          <input
            type="checkbox"
            checked={testCase.selected}
            onChange={() => onToggleSelect(testCase.id)}
            className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
          />
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        <span className="text-xs font-mono text-gray-400 w-16">{testCase.id}</span>

        <span
          className="flex-1 font-medium text-gray-900 cursor-pointer hover:text-green-700"
          onClick={() => setExpanded(!expanded)}
        >
          {testCase.title}
        </span>

        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[testCase.priority]}`}>
          {testCase.priority}
        </span>

        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[testCase.status]}`}>
          {testCase.status}
        </span>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleMarkGood}
            className={`p-1.5 rounded transition-colors ${
              testCase.status === 'good'
                ? 'bg-green-100 text-green-600'
                : 'text-gray-400 hover:bg-green-50 hover:text-green-600'
            }`}
            title="Mark as Good"
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleMarkUseless}
            className={`p-1.5 rounded transition-colors ${
              testCase.status === 'useless'
                ? 'bg-red-100 text-red-600'
                : 'text-gray-400 hover:bg-red-50 hover:text-red-600'
            }`}
            title="Mark as Useless"
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setExpanded(true);
              setEditing(true);
            }}
            className="p-1.5 rounded text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 py-4 border-t border-gray-100 bg-gray-50/50">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Steps (one per line)</label>
                <textarea
                  value={editForm.steps}
                  onChange={(e) => setEditForm({ ...editForm, steps: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-32 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expected Result</label>
                <textarea
                  value={editForm.expected_result}
                  onChange={(e) => setEditForm({ ...editForm, expected_result: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-16"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Description: </span>
                <span className="text-gray-600">{testCase.description}</span>
              </div>
              {testCase.preconditions?.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Preconditions:</span>
                  <ul className="list-disc list-inside text-gray-600 ml-2 mt-1">
                    {testCase.preconditions.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <span className="font-medium text-gray-700">Steps:</span>
                <ol className="list-decimal list-inside text-gray-600 ml-2 mt-1">
                  {testCase.steps.map((s, i) => (
                    <li key={i}>{s.replace(/^\d+\.\s*/, '')}</li>
                  ))}
                </ol>
              </div>
              <div>
                <span className="font-medium text-gray-700">Expected Result: </span>
                <span className="text-gray-600">{testCase.expected_result}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
