'use client';

import { useState, useEffect } from 'react';
import { Play, Smartphone, Package, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

interface Device {
  device_id: string;
  model: string;
  platform: string;
  platform_version: string;
  status: string;
}

interface Build {
  build_id: string;
  file_name: string;
  app_package: string;
  app_version: string;
  uploaded_at: string;
}

interface TestCase {
  id: string;
  title: string;
  description: string;
  preconditions: string[];
  steps: string[];
  expected_result: string;
  priority: string;
}

interface StepResult {
  step_number: number;
  status: string;
  duration_ms: number;
  error_message: string | null;
  appium_command: string;
}

interface TestResult {
  test_case_id: string;
  status: string;
  duration_ms: number;
  error_message: string | null;
  step_results: StepResult[];
}

interface ExecutionStatus {
  run_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    total_steps: number;
    passed_steps: number;
    failed_steps: number;
  };
  results: TestResult[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function TestExecutor() {
  const [description, setDescription] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedBuild, setSelectedBuild] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedTestCase, setGeneratedTestCase] = useState<TestCase | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTestCase, setShowTestCase] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [polling, setPolling] = useState(false);

  // Fetch devices and builds on mount
  useEffect(() => {
    fetchDevices();
    fetchBuilds();
  }, []);

  // Poll for execution status when running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (runId && polling) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/mobile-test/status/${runId}`);
          if (res.ok) {
            const status = await res.json();
            setExecutionStatus(status);
            if (status.status === 'completed' || status.status === 'failed') {
              setPolling(false);
              setShowResults(true);
            }
          }
        } catch (err) {
          console.error('Failed to poll status:', err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [runId, polling]);

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/devices`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
        if (data.length > 0) setSelectedDevice(data[0].device_id);
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  };

  const fetchBuilds = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/builds`);
      if (res.ok) {
        const data = await res.json();
        setBuilds(data);
        if (data.length > 0) setSelectedBuild(data[0].build_id);
      }
    } catch (err) {
      console.error('Failed to fetch builds:', err);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setError(null);
    setGeneratedTestCase(null);
    setExecutionStatus(null);

    try {
      const res = await fetch(`${API_BASE}/api/mobile-test/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          build_id: selectedBuild || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to generate test case');
      }

      const data = await res.json();
      if (data.success) {
        setGeneratedTestCase(data.test_case);
        setShowTestCase(true);
      } else {
        throw new Error('Test case generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test case');
    } finally {
      setGenerating(false);
    }
  };

  const handleExecute = async () => {
    if (!generatedTestCase || !selectedDevice || !selectedBuild) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/mobile-test/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_case: generatedTestCase,
          build_id: selectedBuild,
          device_id: selectedDevice,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to execute test');
      }

      const data = await res.json();
      if (data.success) {
        setRunId(data.run_id);
        setPolling(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute test');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAndExecute = async () => {
    if (!description.trim() || !selectedDevice || !selectedBuild) return;
    setLoading(true);
    setGenerating(true);
    setError(null);
    setGeneratedTestCase(null);
    setExecutionStatus(null);

    try {
      const res = await fetch(`${API_BASE}/api/mobile-test/generate-and-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          build_id: selectedBuild,
          device_id: selectedDevice,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to generate and execute');
      }

      const data = await res.json();
      if (data.test_case) {
        setGeneratedTestCase(data.test_case);
        setShowTestCase(true);
      }
      if (data.run_id) {
        setRunId(data.run_id);
        setPolling(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate and execute');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const reset = () => {
    setDescription('');
    setGeneratedTestCase(null);
    setExecutionStatus(null);
    setRunId(null);
    setError(null);
    setShowTestCase(false);
    setShowResults(false);
    setPolling(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-600';
      case 'fail': case 'error': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Mobile App Test Executor</h3>
          <span className="text-xs text-gray-500">Write in natural language → Execute on device via Appium</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Test Description Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Describe your test in natural language
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: Test that user can login with phone number 9876543210, receive OTP, and reach the home screen"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            disabled={loading}
          />
        </div>

        {/* Action Button - Generate */}
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:bg-gray-300 disabled:text-gray-500"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate Test Case
          </button>

          {(generatedTestCase || executionStatus) && (
            <button onClick={reset} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">
              Reset
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Generated Test Case */}
        {generatedTestCase && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowTestCase(!showTestCase)}
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100"
            >
              <div className="flex items-center gap-2">
                {showTestCase ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-medium text-gray-900">{generatedTestCase.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  generatedTestCase.priority === 'High' ? 'bg-red-100 text-red-700' :
                  generatedTestCase.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {generatedTestCase.priority}
                </span>
              </div>
              <span className="text-xs text-gray-500">{generatedTestCase.steps.length} steps</span>
            </button>

            {showTestCase && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                <div>
                  <p className="text-sm text-gray-600">{generatedTestCase.description}</p>
                </div>

                {generatedTestCase.preconditions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Preconditions:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {generatedTestCase.preconditions.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-700">Steps:</p>
                  <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                    {generatedTestCase.steps.map((step, i) => (
                      <li key={i} className="py-1">{step.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Expected Result:</p>
                  <p className="text-sm text-gray-600">{generatedTestCase.expected_result}</p>
                </div>

                {!runId && (
                  <div className="space-y-3 pt-2 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700">Execute on Device</p>

                    {/* Device and Build Selection */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          <Smartphone className="w-3 h-3 inline mr-1" />
                          Device
                        </label>
                        <div className="flex gap-1">
                          <select
                            value={selectedDevice}
                            onChange={(e) => setSelectedDevice(e.target.value)}
                            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                            disabled={loading}
                          >
                            <option value="">Select device...</option>
                            {devices.map((d) => (
                              <option key={d.device_id} value={d.device_id}>
                                {d.model} ({d.platform_version})
                              </option>
                            ))}
                          </select>
                          <button onClick={fetchDevices} className="p-1.5 text-gray-400 hover:text-gray-600">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          <Package className="w-3 h-3 inline mr-1" />
                          APK Build
                        </label>
                        <div className="flex gap-1">
                          <select
                            value={selectedBuild}
                            onChange={(e) => setSelectedBuild(e.target.value)}
                            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                            disabled={loading}
                          >
                            <option value="">Select build...</option>
                            {builds.map((b) => (
                              <option key={b.build_id} value={b.build_id}>
                                {b.file_name} ({b.app_version})
                              </option>
                            ))}
                          </select>
                          <button onClick={fetchBuilds} className="p-1.5 text-gray-400 hover:text-gray-600">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleExecute}
                      disabled={loading || !selectedDevice || !selectedBuild}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium disabled:bg-gray-300"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Execute on Device
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Execution Status */}
        {(polling || executionStatus) && (
          <div className={`border rounded-lg overflow-hidden ${
            executionStatus?.status === 'completed' && executionStatus?.summary?.failed === 0
              ? 'border-green-200'
              : executionStatus?.status === 'completed' || executionStatus?.status === 'failed'
              ? 'border-red-200'
              : 'border-yellow-200'
          }`}>
            <button
              onClick={() => setShowResults(!showResults)}
              className={`flex items-center justify-between w-full px-4 py-3 ${
                executionStatus?.status === 'completed' && executionStatus?.summary?.failed === 0
                  ? 'bg-green-50'
                  : executionStatus?.status === 'completed' || executionStatus?.status === 'failed'
                  ? 'bg-red-50'
                  : 'bg-yellow-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {showResults ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {polling && <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />}
                {executionStatus?.status === 'completed' && executionStatus?.summary?.failed === 0 && (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                {(executionStatus?.status === 'completed' && executionStatus?.summary?.failed > 0) || executionStatus?.status === 'failed' ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : null}
                <span className="font-medium text-gray-900">
                  {polling ? 'Running...' : executionStatus?.status === 'completed' ?
                    (executionStatus?.summary?.failed === 0 ? 'Test Passed' : 'Test Failed') :
                    'Execution Failed'}
                </span>
              </div>
              {executionStatus?.summary && (
                <span className="text-xs text-gray-500">
                  {executionStatus.summary.passed_steps}/{executionStatus.summary.total_steps} steps passed
                </span>
              )}
            </button>

            {showResults && executionStatus && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                {/* Summary */}
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-600">
                    Duration: {executionStatus.duration_seconds?.toFixed(1) || '...'} sec
                  </span>
                  <span className="text-green-600">
                    Passed: {executionStatus.summary?.passed_steps || 0}
                  </span>
                  <span className="text-red-600">
                    Failed: {executionStatus.summary?.failed_steps || 0}
                  </span>
                </div>

                {/* Step Results */}
                {executionStatus.results?.map((result, idx) => (
                  <div key={idx} className="space-y-2">
                    {result.step_results?.map((step) => (
                      <div
                        key={step.step_number}
                        className={`p-2 rounded text-sm ${
                          step.status === 'pass' ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={getStatusColor(step.status)}>
                            Step {step.step_number}: {step.status === 'pass' ? '✓' : '✗'}
                          </span>
                          <span className="text-xs text-gray-500">{step.duration_ms}ms</span>
                        </div>
                        {step.error_message && (
                          <p className="text-xs text-red-600 mt-1">{step.error_message}</p>
                        )}
                        {step.appium_command && (
                          <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                            {step.appium_command}
                          </p>
                        )}
                      </div>
                    ))}

                    {result.error_message && (
                      <div className="p-2 bg-red-50 rounded">
                        <p className="text-sm text-red-700">{result.error_message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
