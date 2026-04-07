'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckSquare, Square, Filter, Save, FolderOpen, ArrowRight,
  Trash2, Search, X, ArrowLeft
} from 'lucide-react';
import { TestCaseCard } from '@/components/TestCaseCard';
import { useTestStore } from '@/store/useTestStore';

export default function TestCasesPage() {
  const router = useRouter();
  const {
    testCases,
    updateTestCase,
    toggleTestCaseSelection,
    selectAllTestCases,
    deselectAllTestCases,
    savedModules,
    saveModule,
    loadModule,
    deleteModule,
    selectedBuildId,
  } = useTestStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [moduleName, setModuleName] = useState('');

  // Filter test cases
  const filteredTestCases = useMemo(() => {
    return testCases.filter((tc) => {
      if (searchQuery && !tc.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterStatus && tc.status !== filterStatus) {
        return false;
      }
      if (filterModule && tc.module !== filterModule) {
        return false;
      }
      return true;
    });
  }, [testCases, searchQuery, filterStatus, filterModule]);

  // Stats
  const selectedCount = testCases.filter((tc) => tc.selected).length;
  const totalCount = testCases.length;
  const goodCount = testCases.filter((tc) => tc.status === 'good').length;
  const uselessCount = testCases.filter((tc) => tc.status === 'useless').length;

  // Get unique modules
  const modules = useMemo(() => {
    const moduleSet = new Set(testCases.map((tc) => tc.module).filter(Boolean));
    return Array.from(moduleSet);
  }, [testCases]);

  const handleSaveModule = () => {
    if (moduleName.trim() && selectedCount > 0) {
      const selectedIds = testCases.filter((tc) => tc.selected).map((tc) => tc.id);
      saveModule(moduleName.trim(), selectedIds);
      setModuleName('');
      setShowSaveModal(false);
    }
  };

  const handleProceed = () => {
    if (selectedCount > 0) {
      // Skip build selection if build is already selected
      if (selectedBuildId) {
        router.push('/devices');
      } else {
        router.push('/builds');
      }
    }
  };

  if (testCases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <CheckSquare className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">No Test Cases</h2>
        <p className="text-gray-500 mt-2">
          Generate test cases from the home page first
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky Header */}
      <div className="sticky top-14 z-40 bg-gray-50 -mx-4 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Home
            </button>
            <h1 className="text-xl font-bold text-gray-900">Test Cases</h1>
            <span className="text-sm text-gray-500">
              {selectedCount} of {totalCount} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLoadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-white rounded-lg border border-gray-200"
            >
              <FolderOpen className="w-4 h-4" />
              Load Module
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-white rounded-lg border border-gray-200 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save as Module
            </button>
            <button
              onClick={handleProceed}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
            >
              {selectedBuildId ? 'Proceed to Devices' : 'Proceed to Build'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search test cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2">
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="good">Good</option>
            <option value="useless">Useless</option>
            <option value="edited">Edited</option>
          </select>

          {/* Select All / Deselect */}
          <button
            onClick={selectAllTestCases}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <CheckSquare className="w-4 h-4" />
            Select All
          </button>
          <button
            onClick={deselectAllTestCases}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Square className="w-4 h-4" />
            Deselect All
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-4 text-sm">
        <span className="text-gray-600">Total: {totalCount}</span>
        <span className="text-green-600">Good: {goodCount}</span>
        <span className="text-red-600">Useless: {uselessCount}</span>
        <span className="text-blue-600">Selected: {selectedCount}</span>
      </div>

      {/* Test Cases List */}
      <div className="space-y-3">
        {filteredTestCases.map((tc) => (
          <TestCaseCard
            key={tc.id}
            testCase={tc}
            onUpdate={updateTestCase}
            onToggleSelect={toggleTestCaseSelection}
          />
        ))}
      </div>

      {filteredTestCases.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No test cases match your filters
        </div>
      )}

      {/* Save Module Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save as Module</h3>
            <p className="text-sm text-gray-500 mb-4">
              Save {selectedCount} selected test cases as a reusable module
            </p>
            <input
              type="text"
              placeholder="Module name (e.g., Login Tests)"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModule}
                disabled={!moduleName.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:bg-gray-300"
              >
                Save Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Module Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Load Module</h3>
              <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {savedModules.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No saved modules yet
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {savedModules.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{module.name}</p>
                      <p className="text-xs text-gray-500">
                        {module.test_case_ids.length} test cases
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          loadModule(module.id);
                          setShowLoadModal(false);
                        }}
                        className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteModule(module.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
