'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, Clock, Plus, Trash2, Play, CheckCircle, XCircle,
  AlertCircle, ArrowLeft
} from 'lucide-react';
import { Scheduler } from '@/components/Scheduler';
import { useTestStore, ScheduledRun } from '@/store/useTestStore';

export default function SchedulePage() {
  const router = useRouter();
  const {
    scheduledRuns,
    addScheduledRun,
    cancelScheduledRun,
    testCases,
    selectedBuildId,
    selectedDeviceId,
    builds,
    devices,
  } = useTestStore();

  const [showScheduler, setShowScheduler] = useState(false);

  const selectedTestCases = testCases.filter((tc) => tc.selected);
  const selectedBuild = builds.find((b) => b.build_id === selectedBuildId);
  const selectedDevice = devices.find((d) => d.device_id === selectedDeviceId);

  const canSchedule = selectedTestCases.length > 0 && selectedBuildId && selectedDeviceId;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const handleSchedule = (datetime: string, name: string) => {
    if (!canSchedule) return;

    addScheduledRun({
      name,
      test_case_ids: selectedTestCases.map((tc) => tc.id),
      build_id: selectedBuildId!,
      device_id: selectedDeviceId!,
      scheduled_at: datetime,
    });

    setShowScheduler(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const upcomingRuns = scheduledRuns.filter((r) => r.status === 'scheduled');
  const pastRuns = scheduledRuns.filter((r) => r.status !== 'scheduled');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Scheduled Runs</h1>
            <p className="text-sm text-gray-500">Schedule test executions in Indian Standard Time (IST)</p>
          </div>
        </div>

        <button
          onClick={() => setShowScheduler(true)}
          disabled={!canSchedule}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Schedule New Run
        </button>
      </div>

      {/* Prerequisites Warning */}
      {!canSchedule && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-700">Setup Required</p>
            <p className="text-sm text-yellow-600 mt-1">
              To schedule a run, please:
              {selectedTestCases.length === 0 && ' Select test cases'}
              {!selectedBuildId && ' Select a build'}
              {!selectedDeviceId && ' Select a device'}
            </p>
          </div>
        </div>
      )}

      {/* Current Selection Info */}
      {canSchedule && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Current Selection</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Test Cases:</span>
              <span className="ml-2 font-medium text-gray-900">{selectedTestCases.length} selected</span>
            </div>
            <div>
              <span className="text-gray-500">Build:</span>
              <span className="ml-2 font-medium text-gray-900">{selectedBuild?.file_name || 'None'}</span>
            </div>
            <div>
              <span className="text-gray-500">Device:</span>
              <span className="ml-2 font-medium text-gray-900">{selectedDevice?.name || 'None'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Runs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Upcoming Runs ({upcomingRuns.length})
        </h2>

        {upcomingRuns.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No scheduled runs</p>
            <p className="text-sm text-gray-400">Schedule a test execution to see it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingRuns.map((run) => (
              <div
                key={run.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{run.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(run.scheduled_at)}
                      </span>
                      <span>{run.test_case_ids.length} test cases</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(run.status)}`}>
                    {run.status}
                  </span>
                  <button
                    onClick={() => cancelScheduledRun(run.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Runs */}
      {pastRuns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            Past Scheduled Runs ({pastRuns.length})
          </h2>

          <div className="space-y-2">
            {pastRuns.map((run) => (
              <div
                key={run.id}
                className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between opacity-75"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(run.status)}
                  <div>
                    <span className="font-medium text-gray-900">{run.name}</span>
                    <span className="text-sm text-gray-500 ml-3">{formatDate(run.scheduled_at)}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(run.status)}`}>
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduler Modal */}
      {showScheduler && (
        <Scheduler
          onSchedule={handleSchedule}
          onCancel={() => setShowScheduler(false)}
        />
      )}
    </div>
  );
}
