'use client';

import { CheckCircle, XCircle, Clock, PlayCircle, AlertCircle } from 'lucide-react';
import { ExecutionRun } from '@/store/useTestStore';

interface ExecutionDashboardProps {
  run: ExecutionRun;
}

export function ExecutionDashboard({ run }: ExecutionDashboardProps) {
  const progress = run.total_tests > 0
    ? Math.round(((run.passed + run.failed) / run.total_tests) * 100)
    : 0;

  const estimatedTimeLeft = run.remaining * 30; // Assume 30s per test

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-500">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <PlayCircle className="w-4 h-4" />
            <span className="text-xs">Total Tests</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{run.total_tests}</p>
        </div>

        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs">Passed</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{run.passed}</p>
        </div>

        <div className="bg-red-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-xs">Failed</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{run.failed}</p>
        </div>

        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Remaining</span>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{run.remaining}</p>
        </div>
      </div>

      {/* Time Estimate */}
      <div className="bg-blue-50 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Estimated Time Left</span>
          </div>
          <span className="text-lg font-bold text-blue-700">
            {run.remaining > 0 ? formatTime(estimatedTimeLeft) : 'Done'}
          </span>
        </div>
      </div>

      {/* Current Test */}
      {run.current_test && run.status === 'running' && (
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-500">RUNNING</span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">
            {run.current_test}
          </p>
        </div>
      )}

      {/* Status */}
      <div className={`rounded-lg p-3 ${
        run.status === 'completed' ? 'bg-green-100' :
        run.status === 'failed' || run.status === 'aborted' ? 'bg-red-100' :
        run.status === 'running' ? 'bg-blue-100' : 'bg-gray-100'
      }`}>
        <div className="flex items-center gap-2">
          {run.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600" />}
          {run.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
          {run.status === 'aborted' && <AlertCircle className="w-5 h-5 text-red-600" />}
          {run.status === 'running' && (
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
          {run.status === 'pending' && <Clock className="w-5 h-5 text-gray-600" />}
          <span className={`font-medium capitalize ${
            run.status === 'completed' ? 'text-green-700' :
            run.status === 'failed' || run.status === 'aborted' ? 'text-red-700' :
            run.status === 'running' ? 'text-blue-700' : 'text-gray-700'
          }`}>
            {run.status}
          </span>
        </div>
      </div>
    </div>
  );
}
