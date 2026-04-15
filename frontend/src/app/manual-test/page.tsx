'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Package, Edit3, Sparkles, Loader2,
  AlertCircle, CheckCircle, Plus, Trash2, Lightbulb, Code,
  Play, Eye, ChevronDown, ChevronUp, Upload, FileText, X
} from 'lucide-react';
import { FileUploader } from '@/components/FileUploader';
import { useTestStore, Build, TestCase } from '@/store/useTestStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Example test scenarios for guidance
const EXAMPLE_SCENARIOS = [
  {
    title: 'Login Flow',
    description: 'Test that user can login with phone number, receive OTP, verify OTP successfully, and reach the home screen.',
  },
  {
    title: 'Search & Play',
    description: 'Test that user can search for a movie by name, select it from results, and play the content.',
  },
  {
    title: 'Profile Update',
    description: 'Test that user can navigate to profile, update display name, save changes, and verify the update persists.',
  },
  {
    title: 'Subscription Flow',
    description: 'Test that user can view subscription plans, select a plan, complete payment, and access premium content.',
  },
];

// Step indicator component
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Select Build' },
    { num: 2, label: 'Write Tests' },
    { num: 3, label: 'Review & Continue' },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            currentStep === step.num
              ? 'bg-green-600 text-white'
              : currentStep > step.num
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {currentStep > step.num ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
                {step.num}
              </span>
            )}
            {step.label}
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-2 ${
              currentStep > step.num ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ManualTestPage() {
  const router = useRouter();
  const {
    builds,
    setBuilds,
    addBuild,
    selectedBuildId,
    selectBuild,
    setTestCases,
    testCases: existingTestCases,
  } = useTestStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingBuilds, setLoadingBuilds] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build upload
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Created test cases list
  const [createdTestCases, setCreatedTestCases] = useState<TestCase[]>([]);

  // Test case input form
  const [testTitle, setTestTitle] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [preconditions, setPreconditions] = useState<string[]>(['']);
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [showExamples, setShowExamples] = useState(false);
  const [showForm, setShowForm] = useState(true);

  // Preview for current test case
  const [previewTestCase, setPreviewTestCase] = useState<TestCase | null>(null);

  const selectedBuild = builds.find((b) => b.build_id === selectedBuildId);

  // Fetch existing builds
  useEffect(() => {
    fetchBuilds();
  }, []);

  // Auto-proceed to step 2 if build already selected
  useEffect(() => {
    if (selectedBuildId && currentStep === 1 && !loadingBuilds) {
      // Don't auto-proceed, let user confirm
    }
  }, [selectedBuildId, loadingBuilds]);

  const fetchBuilds = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/builds`);
      if (res.ok) {
        const data = await res.json();
        setBuilds(data);
      }
    } catch (err) {
      console.error('Failed to fetch builds:', err);
    } finally {
      setLoadingBuilds(false);
    }
  };

  const handleUploadBuild = async () => {
    if (!apkFile) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? prev : prev + 10));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', apkFile);

      const res = await fetch(`${API_BASE}/api/builds/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Upload failed');
      }

      const build: Build = await res.json();
      addBuild(build);
      selectBuild(build.build_id);
      setApkFile(null);
      setUploadProgress(0);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const addPrecondition = () => {
    setPreconditions([...preconditions, '']);
  };

  const updatePrecondition = (index: number, value: string) => {
    const updated = [...preconditions];
    updated[index] = value;
    setPreconditions(updated);
  };

  const removePrecondition = (index: number) => {
    if (preconditions.length > 1) {
      setPreconditions(preconditions.filter((_, i) => i !== index));
    }
  };

  const useExample = (example: typeof EXAMPLE_SCENARIOS[0]) => {
    setTestTitle(example.title);
    setTestDescription(example.description);
    setShowExamples(false);
  };

  const resetForm = () => {
    setTestTitle('');
    setTestDescription('');
    setPreconditions(['']);
    setExpectedOutcome('');
    setPriority('Medium');
    setPreviewTestCase(null);
    setError(null);
  };

  const canProceedToStep2 = selectedBuildId !== null;
  const canGeneratePreview = testTitle.trim() && testDescription.trim();

  const handleGeneratePreview = async () => {
    if (!canGeneratePreview || !selectedBuild) return;

    setLoading(true);
    setError(null);

    try {
      const fullDescription = `
Test Title: ${testTitle}

Description: ${testDescription}

${preconditions.filter(p => p.trim()).length > 0 ? `Preconditions:
${preconditions.filter(p => p.trim()).map(p => `- ${p}`).join('\n')}` : ''}

${expectedOutcome ? `Expected Outcome: ${expectedOutcome}` : ''}

Priority: ${priority}

App Context:
- Package: ${selectedBuild.app_package}
- Version: ${selectedBuild.app_version}
      `.trim();

      const res = await fetch(`${API_BASE}/api/test-cases/from-natural-language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: fullDescription,
          build_id: selectedBuildId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to generate test case');
      }

      const data = await res.json();
      if (data.success && data.test_case) {
        setPreviewTestCase({
          ...data.test_case,
          priority,
          status: 'pending',
          selected: true,
        });
      } else {
        throw new Error('No test case was generated');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test case');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToList = () => {
    if (previewTestCase) {
      setCreatedTestCases([...createdTestCases, previewTestCase]);
      resetForm();
      setShowForm(true);
    }
  };

  const handleRemoveFromList = (id: string) => {
    setCreatedTestCases(createdTestCases.filter(tc => tc.id !== id));
  };

  const saveTestCasesToBackend = async (testCases: TestCase[]): Promise<TestCase[]> => {
    const savedTestCases: TestCase[] = [];

    for (const tc of testCases) {
      try {
        // Generate UUID if the id is not already a UUID
        const tcId = tc.id.includes('-') && tc.id.length > 30 ? tc.id : crypto.randomUUID();
        const res = await fetch(`${API_BASE}/api/test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tc_id: tcId,
            original_id: tc.id,
            prd_hash: 'manual_' + Date.now(),
            title: tc.title,
            description: tc.description,
            preconditions: tc.preconditions,
            steps: tc.steps.map((step, idx) => ({
              step_number: idx + 1,
              description: step,
              locator_override: null,
              expected_element: null,
            })),
            expected_result: tc.expected_result,
            priority: tc.priority,
            category: tc.category || 'Functional',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });

        if (res.ok) {
          const savedTc = await res.json();
          savedTestCases.push({ ...tc, id: savedTc.tc_id });
        } else {
          const errText = await res.text();
          console.error('Failed to save test case:', tc.title, errText);
          // Use the generated UUID anyway so execution can at least be attempted
          savedTestCases.push({ ...tc, id: tcId });
        }
      } catch (err) {
        console.error('Error saving test case:', err);
        savedTestCases.push({ ...tc, id: tc.id.includes('-') && tc.id.length > 30 ? tc.id : crypto.randomUUID() });
      }
    }

    return savedTestCases;
  };

  const handleContinueToDevices = async () => {
    if (createdTestCases.length > 0) {
      setLoading(true);
      try {
        // Save test cases to backend first
        const savedTestCases = await saveTestCasesToBackend(createdTestCases);
        // Merge with existing test cases
        setTestCases([...existingTestCases, ...savedTestCases]);
        router.push('/devices');
      } catch (err) {
        setError('Failed to save test cases');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveCurrentAndContinue = async () => {
    let finalTestCases = [...createdTestCases];
    if (previewTestCase) {
      finalTestCases.push(previewTestCase);
    }

    if (finalTestCases.length > 0) {
      setLoading(true);
      try {
        // Save test cases to backend first
        const savedTestCases = await saveTestCasesToBackend(finalTestCases);
        setTestCases([...existingTestCases, ...savedTestCases]);
        router.push('/devices');
      } catch (err) {
        setError('Failed to save test cases');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Write Manual Test Cases</h1>
          <p className="text-sm text-gray-500">Create test cases using natural language</p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Step 1: Select Build */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Why select a build first?</p>
                <p className="text-sm text-blue-700 mt-1">
                  Selecting a build helps us understand your app's structure, activities, and UI elements.
                  This enables better script generation with accurate element locators and navigation paths.
                </p>
              </div>
            </div>
          </div>

          {/* Upload New Build */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">Upload New Build</h2>
            </div>

            <FileUploader
              label="Click to upload or drag & drop APK"
              description="Android APK files only"
              accept=".apk"
              onFileSelect={setApkFile}
              selectedFile={apkFile}
              onClear={() => setApkFile(null)}
              showProgress={uploading}
              progress={uploadProgress}
            />

            {apkFile && !uploading && (
              <button
                onClick={handleUploadBuild}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <Upload className="w-4 h-4" />
                Upload APK
              </button>
            )}
          </div>

          {/* Existing Builds */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Or Select Existing Build</h2>
              <span className="text-sm text-gray-500">({builds.length})</span>
            </div>

            {loadingBuilds ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : builds.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No builds uploaded yet</p>
                <p className="text-sm text-gray-400">Upload an APK above to get started</p>
              </div>
            ) : (
              <div className="grid gap-3 max-h-64 overflow-y-auto">
                {builds.map((build) => (
                  <button
                    key={build.build_id}
                    onClick={() => selectBuild(build.build_id)}
                    className={`flex items-center justify-between p-4 rounded-lg border text-left transition-all ${
                      selectedBuildId === build.build_id
                        ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedBuildId === build.build_id ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Package className={`w-5 h-5 ${
                          selectedBuildId === build.build_id ? 'text-green-600' : 'text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{build.file_name}</p>
                        <p className="text-sm text-gray-500">
                          {build.app_package} • v{build.app_version}
                        </p>
                      </div>
                    </div>
                    {selectedBuildId === build.build_id && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!canProceedToStep2}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue to Write Tests
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Write Test Cases */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Selected Build Info */}
          {selectedBuild && (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">{selectedBuild.file_name}</p>
                  <p className="text-sm text-gray-500">{selectedBuild.app_package}</p>
                </div>
              </div>
              <button
                onClick={() => setCurrentStep(1)}
                className="text-sm text-blue-600 hover:underline"
              >
                Change Build
              </button>
            </div>
          )}

          {/* Created Test Cases List */}
          {createdTestCases.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  Created Test Cases ({createdTestCases.length})
                </h3>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Review All & Continue →
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {createdTestCases.map((tc) => (
                  <div
                    key={tc.id}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{tc.title}</p>
                        <p className="text-xs text-gray-500">{tc.steps.length} steps • {tc.priority} priority</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFromList(tc.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview of current test case */}
          {previewTestCase && (
            <div className="bg-white rounded-xl border border-blue-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-600" />
                  Preview: {previewTestCase.title}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewTestCase(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleAddToList}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add to List
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Steps:</p>
                  <ol className="list-decimal list-inside text-gray-600 bg-gray-50 rounded-lg p-3 mt-1">
                    {previewTestCase.steps.map((step, idx) => (
                      <li key={idx} className="py-0.5">{step}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Expected Result:</p>
                  <p className="text-gray-600 bg-green-50 rounded-lg p-3 mt-1">{previewTestCase.expected_result}</p>
                </div>
              </div>
            </div>
          )}

          {/* Test Case Form */}
          {showForm && !previewTestCase && (
            <>
              {/* Examples Toggle */}
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <Lightbulb className="w-4 h-4" />
                {showExamples ? 'Hide examples' : 'Show example test scenarios'}
                {showExamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showExamples && (
                <div className="grid md:grid-cols-2 gap-3">
                  {EXAMPLE_SCENARIOS.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => useExample(example)}
                      className="text-left p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <p className="font-medium text-blue-900">{example.title}</p>
                      <p className="text-sm text-blue-700 mt-1 line-clamp-2">{example.description}</p>
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">
                    {createdTestCases.length > 0 ? 'Add Another Test Case' : 'Test Case Details'}
                  </h2>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder="e.g., Verify user login with valid phone number"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Description <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Describe what the test should do in natural language. Be specific about user actions.
                  </p>
                  <textarea
                    value={testDescription}
                    onChange={(e) => setTestDescription(e.target.value)}
                    placeholder="Describe the test scenario in detail..."
                    className="w-full h-32 border border-gray-300 rounded-lg px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Preconditions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preconditions (Optional)
                  </label>
                  <div className="space-y-2">
                    {preconditions.map((precondition, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={precondition}
                          onChange={(e) => updatePrecondition(idx, e.target.value)}
                          placeholder="e.g., User must be logged out"
                          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {preconditions.length > 1 && (
                          <button
                            onClick={() => removePrecondition(idx)}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addPrecondition}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add precondition
                    </button>
                  </div>
                </div>

                {/* Expected Outcome */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Outcome (Optional)
                  </label>
                  <input
                    type="text"
                    value={expectedOutcome}
                    onChange={(e) => setExpectedOutcome(e.target.value)}
                    placeholder="e.g., User is successfully logged in"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <div className="flex gap-3">
                    {(['High', 'Medium', 'Low'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          priority === p
                            ? p === 'High'
                              ? 'bg-red-100 border-red-300 text-red-700'
                              : p === 'Medium'
                              ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                              : 'bg-green-100 border-green-300 text-green-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGeneratePreview}
                  disabled={!canGeneratePreview || loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Preview...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Test Case Preview
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Build
            </button>

            {(createdTestCases.length > 0 || previewTestCase) && (
              <button
                onClick={handleSaveCurrentAndContinue}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                <Play className="w-4 h-4" />
                Continue to Device Selection
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review & Continue */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Review Test Cases ({createdTestCases.length})
              </h2>
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add More
              </button>
            </div>

            <div className="space-y-4">
              {createdTestCases.map((tc, idx) => (
                <div key={tc.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{tc.title}</p>
                        <p className="text-xs text-gray-500">{tc.category} • {tc.priority} priority</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFromList(tc.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Steps:</p>
                      <ol className="list-decimal list-inside text-gray-600 space-y-1">
                        {tc.steps.map((step, sidx) => (
                          <li key={sidx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Expected Result:</p>
                      <p className="text-gray-600">{tc.expected_result}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {createdTestCases.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No test cases created yet</p>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="mt-2 text-blue-600 hover:underline text-sm"
                >
                  Go back to write test cases
                </button>
              </div>
            )}
          </div>

          {/* Build Info Reminder */}
          {selectedBuild && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Selected Build:</span> {selectedBuild.file_name} ({selectedBuild.app_package})
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Write Tests
            </button>

            <button
              onClick={handleContinueToDevices}
              disabled={createdTestCases.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Continue to Device Selection
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
