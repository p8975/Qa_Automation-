'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, StopCircle, Smartphone, RotateCcw, ArrowLeft } from 'lucide-react';
import { ExecutionDashboard } from '@/components/ExecutionDashboard';
import { useTestStore, ExecutionRun, TestResult } from '@/store/useTestStore';

export default function ExecutionPage() {
  const router = useRouter();
  const {
    testCases,
    selectedBuildId,
    selectedDeviceId,
    devices,
    builds,
    currentRun,
    setCurrentRun,
    updateCurrentRun,
    addToHistory,
  } = useTestStore();

  const [isPaused, setIsPaused] = useState(false);

  // Use refs to track state that callbacks need to access
  const isPausedRef = useRef(false);
  const isAbortedRef = useRef(false);
  const currentTestIndexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);

  const selectedTestCases = testCases.filter((tc) => tc.selected);
  const selectedDevice = devices.find((d) => d.device_id === selectedDeviceId);
  const selectedBuild = builds.find((b) => b.build_id === selectedBuildId);

  // Sync isPaused state with ref
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Initialize execution run
  useEffect(() => {
    if (!currentRun && selectedTestCases.length > 0 && selectedBuildId && selectedDeviceId) {
      const run: ExecutionRun = {
        run_id: `run_${Date.now()}`,
        build_id: selectedBuildId,
        device_id: selectedDeviceId,
        status: 'pending',
        started_at: new Date().toISOString(),
        total_tests: selectedTestCases.length,
        passed: 0,
        failed: 0,
        remaining: selectedTestCases.length,
        results: [],
      };
      setCurrentRun(run);
      currentTestIndexRef.current = 0;
      isAbortedRef.current = false;
      isExecutingRef.current = false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Execute a single test
  const executeNextTest = () => {
    // Check abort/pause state using refs (always fresh)
    if (isAbortedRef.current || isPausedRef.current) {
      isExecutingRef.current = false;
      return;
    }

    const currentIndex = currentTestIndexRef.current;

    if (currentIndex >= selectedTestCases.length) {
      // All tests completed
      const finalRun = useTestStore.getState().currentRun;
      if (finalRun && finalRun.status === 'running') {
        updateCurrentRun({
          status: 'completed',
          completed_at: new Date().toISOString(),
          remaining: 0,
          current_test: undefined,
        });
        addToHistory({ ...finalRun, status: 'completed' });
      }
      isExecutingRef.current = false;
      return;
    }

    const currentTest = selectedTestCases[currentIndex];

    // Update current test being executed
    updateCurrentRun({
      current_test: currentTest.title,
    });

    // Simulate test execution with delay
    const executionTime = 2000 + Math.random() * 2000;

    timeoutRef.current = setTimeout(() => {
      // Check again after delay
      if (isAbortedRef.current || isPausedRef.current) {
        isExecutingRef.current = false;
        return;
      }

      const passed = Math.random() > 0.2; // 80% pass rate
      const result: TestResult = {
        test_case_id: currentTest.id,
        title: currentTest.title,
        status: passed ? 'pass' : 'fail',
        duration_ms: Math.floor(executionTime),
        error_message: passed ? undefined : 'Element not found: login_button',
        steps_passed: passed ? currentTest.steps.length : Math.floor(currentTest.steps.length * 0.6),
        steps_total: currentTest.steps.length,
      };

      // Get fresh state from store
      const freshRun = useTestStore.getState().currentRun;
      if (!freshRun || freshRun.status !== 'running') {
        isExecutingRef.current = false;
        return;
      }

      // Update with new result
      updateCurrentRun({
        passed: freshRun.passed + (passed ? 1 : 0),
        failed: freshRun.failed + (passed ? 0 : 1),
        remaining: freshRun.remaining - 1,
        results: [...freshRun.results, result],
      });

      // Move to next test
      currentTestIndexRef.current = currentIndex + 1;

      // Schedule next test execution
      if (!isAbortedRef.current && !isPausedRef.current) {
        timeoutRef.current = setTimeout(executeNextTest, 500);
      } else {
        isExecutingRef.current = false;
      }
    }, executionTime);
  };

  // Start execution when status changes to running
  useEffect(() => {
    if (currentRun?.status === 'running' && !isPaused && !isExecutingRef.current) {
      isExecutingRef.current = true;
      executeNextTest();
    }
  }, [currentRun?.status, isPaused]);

  const handleStart = () => {
    if (currentRun?.status === 'pending') {
      isAbortedRef.current = false;
      isPausedRef.current = false;
      currentTestIndexRef.current = 0;
      updateCurrentRun({ status: 'running' });
    }
    setIsPaused(false);
  };

  const handlePause = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    isExecutingRef.current = false;

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setIsPaused(false);

    // Resume execution if still running
    if (currentRun?.status === 'running' && !isExecutingRef.current) {
      isExecutingRef.current = true;
      executeNextTest();
    }
  };

  const handleAbort = () => {
    isAbortedRef.current = true;
    isExecutingRef.current = false;

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (currentRun) {
      const abortedRun = {
        ...currentRun,
        status: 'aborted' as const,
        completed_at: new Date().toISOString(),
      };
      updateCurrentRun({
        status: 'aborted',
        completed_at: new Date().toISOString(),
      });
      addToHistory(abortedRun);
    }
  };

  const handleRestart = () => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    isAbortedRef.current = false;
    isPausedRef.current = false;
    isExecutingRef.current = false;
    currentTestIndexRef.current = 0;

    const run: ExecutionRun = {
      run_id: `run_${Date.now()}`,
      build_id: selectedBuildId!,
      device_id: selectedDeviceId!,
      status: 'pending',
      started_at: new Date().toISOString(),
      total_tests: selectedTestCases.length,
      passed: 0,
      failed: 0,
      remaining: selectedTestCases.length,
      results: [],
    };
    setCurrentRun(run);
    setIsPaused(false);
  };

  const handleViewResults = () => {
    router.push('/results');
  };

  if (!selectedBuildId || !selectedDeviceId || selectedTestCases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Smartphone className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Setup Required</h2>
        <p className="text-gray-500 mt-2">
          Please select test cases, build, and device first
        </p>
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(currentRun?.status === 'pending' || currentRun?.status === 'completed' || currentRun?.status === 'aborted') && (
            <button
              onClick={() => router.push('/devices')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Devices
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">Test Execution</h1>
            <p className="text-sm text-gray-500">
              {selectedBuild?.file_name} on {selectedDevice?.name}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {currentRun?.status === 'pending' && (
            <button
              onClick={handleStart}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          )}

          {currentRun?.status === 'running' && (
            <>
              {isPaused ? (
                <button
                  onClick={handleResume}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              )}
              <button
                onClick={handleAbort}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
              >
                <StopCircle className="w-4 h-4" />
                Abort
              </button>
            </>
          )}

          {(currentRun?.status === 'completed' || currentRun?.status === 'aborted') && (
            <>
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </button>
              <button
                onClick={handleViewResults}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                View Results
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Device View */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">{selectedDevice?.name}</h2>
            <span className="text-xs text-gray-500">
              {selectedDevice?.platform} {selectedDevice?.platform_version}
            </span>
          </div>

          {/* Device Screen Simulation */}
          <div className="relative bg-gray-900 rounded-2xl p-2 mx-auto max-w-[280px]">
            {/* Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full" />

            {/* Screen */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl h-[480px] flex flex-col items-center justify-center overflow-hidden">
              {currentRun?.status === 'running' && !isPaused ? (
                <div className="text-center p-4">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white text-sm font-medium mb-2">Running Test</p>
                  <p className="text-gray-400 text-xs px-4 truncate max-w-full">
                    {currentRun.current_test}
                  </p>
                  <div className="mt-4 flex justify-center gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                </div>
              ) : isPaused ? (
                <div className="text-center">
                  <Pause className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-white text-sm font-medium">Paused</p>
                </div>
              ) : currentRun?.status === 'completed' ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-white text-sm font-medium">Execution Complete</p>
                </div>
              ) : currentRun?.status === 'aborted' ? (
                <div className="text-center">
                  <StopCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-white text-sm font-medium">Aborted</p>
                </div>
              ) : (
                <div className="text-center">
                  <Play className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">Ready to Start</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Dashboard */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Execution Dashboard</h2>
          {currentRun && <ExecutionDashboard run={currentRun} />}
        </div>
      </div>

      {/* Test Results List */}
      {currentRun && currentRun.results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Test Results</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {currentRun.results.map((result, idx) => (
              <div
                key={result.test_case_id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  result.status === 'pass' ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      result.status === 'pass' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm font-medium text-gray-900">{result.title}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-500">{result.duration_ms}ms</span>
                  <span className={result.status === 'pass' ? 'text-green-600' : 'text-red-600'}>
                    {result.steps_passed}/{result.steps_total} steps
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
