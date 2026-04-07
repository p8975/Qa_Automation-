'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, CheckCircle, XCircle, Clock, Download, Share2,
  RotateCcw, ChevronDown, ChevronRight, AlertCircle, ArrowLeft
} from 'lucide-react';
import { useTestStore, ExecutionRun } from '@/store/useTestStore';

export default function ResultsPage() {
  const router = useRouter();
  const { currentRun, executionHistory, setCurrentRun } = useTestStore();

  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(currentRun);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const allRuns = currentRun
    ? [currentRun, ...executionHistory.filter((r) => r.run_id !== currentRun.run_id)]
    : executionHistory;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startStr: string, endStr?: string) => {
    if (!endStr) return '...';
    const start = new Date(startStr);
    const end = new Date(endStr);
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleExportPDF = () => {
    if (!selectedRun) return;

    // Create PDF content
    const content = `
QA Test Execution Report
========================

Run ID: ${selectedRun.run_id}
Date: ${formatDate(selectedRun.started_at)}
Duration: ${formatDuration(selectedRun.started_at, selectedRun.completed_at)}
Status: ${selectedRun.status.toUpperCase()}

Summary
-------
Total Tests: ${selectedRun.total_tests}
Passed: ${selectedRun.passed}
Failed: ${selectedRun.failed}

Test Results
------------
${selectedRun.results.map((r) => `
- ${r.title}
  Status: ${r.status.toUpperCase()}
  Duration: ${r.duration_ms}ms
  Steps: ${r.steps_passed}/${r.steps_total}
  ${r.error_message ? `Error: ${r.error_message}` : ''}
`).join('\n')}
    `.trim();

    // Download as text file (PDF would require a library)
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${selectedRun.run_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareSlack = () => {
    setShowShareModal(true);
    // Mock Slack share - in real app, this would call Slack API
    setTimeout(() => {
      setShowShareModal(false);
      alert('Report shared to #qa-automation channel!');
    }, 1500);
  };

  const handleRetryFailed = () => {
    // In real app, this would re-run only failed tests
    router.push('/execution');
  };

  const handleRerunAll = () => {
    if (selectedRun) {
      setCurrentRun(null);
    }
    router.push('/execution');
  };

  if (allRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">No Results Yet</h2>
        <p className="text-gray-500 mt-2">Run some tests to see results here</p>
        <button
          onClick={() => router.push('/test-cases')}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          Go to Test Cases
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/test-cases')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Test Cases
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Test Results</h1>
            <p className="text-sm text-gray-500">{allRuns.length} execution runs</p>
          </div>
        </div>

        {selectedRun && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-white rounded-lg border border-gray-200"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={handleShareSlack}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-white rounded-lg border border-gray-200"
            >
              <Share2 className="w-4 h-4" />
              Share to Slack
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Run List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-medium text-gray-900">Execution History</h3>
          <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
            {allRuns.map((run) => (
              <button
                key={run.run_id}
                onClick={() => setSelectedRun(run)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedRun?.run_id === run.run_id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{formatDate(run.started_at)}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      run.status === 'completed'
                        ? run.failed === 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                        : run.status === 'failed' || run.status === 'aborted'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-600">{run.passed} passed</span>
                  <span className="text-red-600">{run.failed} failed</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Selected Run Details */}
        <div className="lg:col-span-2">
          {selectedRun ? (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Execution Summary</h2>
                    <p className="text-sm text-gray-500">{formatDate(selectedRun.started_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatDuration(selectedRun.started_at, selectedRun.completed_at)}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{selectedRun.total_tests}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">{selectedRun.passed}</p>
                    <p className="text-xs text-green-600">Passed</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-700">{selectedRun.failed}</p>
                    <p className="text-xs text-red-600">Failed</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">
                      {selectedRun.total_tests > 0
                        ? Math.round((selectedRun.passed / selectedRun.total_tests) * 100)
                        : 0}%
                    </p>
                    <p className="text-xs text-blue-600">Pass Rate</p>
                  </div>
                </div>

                {/* Actions */}
                {selectedRun.failed > 0 && (
                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={handleRetryFailed}
                      className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry Failed ({selectedRun.failed})
                    </button>
                    <button
                      onClick={handleRerunAll}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Rerun All
                    </button>
                  </div>
                )}
              </div>

              {/* Test Results */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Test Results</h3>
                <div className="space-y-2">
                  {selectedRun.results.map((result) => (
                    <div
                      key={result.test_case_id}
                      className={`border rounded-lg overflow-hidden ${
                        result.status === 'pass' ? 'border-green-200' : 'border-red-200'
                      }`}
                    >
                      <button
                        onClick={() =>
                          setExpandedTest(
                            expandedTest === result.test_case_id ? null : result.test_case_id
                          )
                        }
                        className={`w-full flex items-center justify-between p-3 ${
                          result.status === 'pass' ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {expandedTest === result.test_case_id ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          {result.status === 'pass' ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          <span className="font-medium text-gray-900">{result.title}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {result.duration_ms}ms
                          </span>
                          <span
                            className={
                              result.status === 'pass' ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {result.steps_passed}/{result.steps_total} steps
                          </span>
                        </div>
                      </button>

                      {expandedTest === result.test_case_id && result.error_message && (
                        <div className="p-3 bg-red-50 border-t border-red-200">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-700">Error</p>
                              <p className="text-sm text-red-600">{result.error_message}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Select a run to view details
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 text-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-900 font-medium">Sharing to Slack...</p>
          </div>
        </div>
      )}
    </div>
  );
}
