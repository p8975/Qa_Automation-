'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Package, Edit3, Sparkles, Loader2,
  AlertCircle, CheckCircle, Plus, Trash2, Lightbulb, Code,
  Play, Eye, ChevronDown, ChevronUp, Upload
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
    { num: 2, label: 'Write Test' },
    { num: 3, label: 'Preview & Generate' },
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
  } = useTestStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingBuilds, setLoadingBuilds] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build upload
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Test case input
  const [testTitle, setTestTitle] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [preconditions, setPreconditions] = useState<string[]>(['']);
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [showExamples, setShowExamples] = useState(false);

  // Preview
  const [generatedTestCase, setGeneratedTestCase] = useState<TestCase | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const selectedBuild = builds.find((b) => b.build_id === selectedBuildId);

  // Fetch existing builds
  useEffect(() => {
    fetchBuilds();
  }, []);

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

  const canProceedToStep2 = selectedBuildId !== null;
  const canProceedToStep3 = testTitle.trim() && testDescription.trim();

  const handleGeneratePreview = async () => {
    if (!canProceedToStep3 || !selectedBuild) return;

    setLoading(true);
    setError(null);

    try {
      // Build the natural language description
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
        setGeneratedTestCase({
          ...data.test_case,
          priority,
          status: 'pending',
          selected: true,
        });
        setShowPreview(true);
        setCurrentStep(3);
      } else {
        throw new Error('No test case was generated');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test case');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = () => {
    if (generatedTestCase) {
      setTestCases([generatedTestCase]);
      router.push('/test-cases');
    }
  };

  const handleAddAnother = () => {
    // Reset form for another test case
    setTestTitle('');
    setTestDescription('');
    setPreconditions(['']);
    setExpectedOutcome('');
    setPriority('Medium');
    setGeneratedTestCase(null);
    setShowPreview(false);
    setCurrentStep(2);
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
          <h1 className="text-xl font-bold text-gray-900">Write Manual Test Case</h1>
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

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Continue Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!canProceedToStep2}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue to Write Test
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Write Test Case */}
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

          {/* Examples Toggle */}
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <Lightbulb className="w-4 h-4" />
            {showExamples ? 'Hide examples' : 'Show example test scenarios'}
            {showExamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Examples */}
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

          {/* Test Case Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Edit3 className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Test Case Details</h2>
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
                Describe what the test should do in natural language. Be specific about user actions and expected behaviors.
              </p>
              <textarea
                value={testDescription}
                onChange={(e) => setTestDescription(e.target.value)}
                placeholder="Describe the test scenario in detail. For example:&#10;&#10;1. Open the app and wait for splash screen&#10;2. User enters phone number 9876543210&#10;3. User taps on 'Get OTP' button&#10;4. User receives OTP and enters it&#10;5. User should be navigated to home screen"
                className="w-full h-40 border border-gray-300 rounded-lg px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Preconditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preconditions (Optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                What needs to be true before this test can run?
              </p>
              <div className="space-y-2">
                {preconditions.map((precondition, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={precondition}
                      onChange={(e) => updatePrecondition(idx, e.target.value)}
                      placeholder={`e.g., User must be logged out, App freshly installed`}
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
                placeholder="e.g., User is successfully logged in and sees the home screen"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
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
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleGeneratePreview}
              disabled={!canProceedToStep3 || loading}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Preview Test Case
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Generate */}
      {currentStep === 3 && generatedTestCase && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Generated Test Case Preview</h2>
            </div>

            <div className="space-y-4">
              {/* Title & Priority */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{generatedTestCase.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{generatedTestCase.category}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  generatedTestCase.priority === 'High'
                    ? 'bg-red-100 text-red-700'
                    : generatedTestCase.priority === 'Medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {generatedTestCase.priority}
                </span>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  {generatedTestCase.description}
                </p>
              </div>

              {/* Preconditions */}
              {generatedTestCase.preconditions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Preconditions</p>
                  <ul className="list-disc list-inside text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
                    {generatedTestCase.preconditions.map((pc, idx) => (
                      <li key={idx}>{pc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Steps */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Test Steps</p>
                <ol className="list-decimal list-inside text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-2">
                  {generatedTestCase.steps.map((step, idx) => (
                    <li key={idx} className="pl-1">{step}</li>
                  ))}
                </ol>
              </div>

              {/* Expected Result */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Expected Result</p>
                <p className="text-sm text-gray-600 bg-green-50 border border-green-200 rounded-lg p-3">
                  {generatedTestCase.expected_result}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Edit Test Case
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAddAnother}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Add Another
              </button>
              <button
                onClick={handleSaveAndContinue}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                <Play className="w-4 h-4" />
                Save & Continue to Execution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
