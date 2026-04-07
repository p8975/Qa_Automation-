'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Edit3, Sparkles, Loader2, AlertCircle, ArrowRight, Zap } from 'lucide-react';
import { FileUploader } from '@/components/FileUploader';
import { useTestStore, TestCase } from '@/store/useTestStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function HomePage() {
  const router = useRouter();
  const { setTestCases, setUploadedPRD } = useTestStore();

  const [prdFile, setPrdFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateFromPRD = async () => {
    if (!prdFile) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', prdFile);

      const res = await fetch(`${API_BASE}/api/generate-test-cases`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to generate test cases');
      }

      const data = await res.json();
      const testCases: TestCase[] = data.test_cases.map((tc: any) => ({
        ...tc,
        status: 'pending',
        selected: true,
      }));

      if (testCases.length > 0) {
        setTestCases(testCases);
        setUploadedPRD({ name: prdFile.name, content: '' });
        router.push('/test-cases');
      } else {
        setError('No test cases were generated. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test cases');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">QA Test Case Generator</h1>
        <p className="text-gray-500 mt-1">Generate test cases from PRD or write them manually</p>
      </div>

      {/* Main Options */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Option 1: PRD Upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Upload PRD</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Upload a Product Requirements Document to automatically generate comprehensive test cases using AI.
          </p>

          <FileUploader
            label="Click to upload or drag & drop"
            description="PDF, DOC, DOCX, TXT, MD (Max 10MB)"
            accept=".pdf,.doc,.docx,.txt,.md"
            onFileSelect={setPrdFile}
            selectedFile={prdFile}
            onClear={() => setPrdFile(null)}
          />

          {prdFile && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-green-600 flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                Ready to generate test cases from {prdFile.name}
              </p>
              <button
                onClick={handleGenerateFromPRD}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Test Cases...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Generate Test Cases
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Option 2: Manual Test Writing */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Edit3 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Write Manual Test</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Write test cases in natural language with guided input. Select your app build first for better script generation.
          </p>

          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-medium">1</span>
                <span>Select your app build for context</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-medium">2</span>
                <span>Describe test scenarios in natural language</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-medium">3</span>
                <span>Preview generated test cases with steps</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-medium">4</span>
                <span>Save and execute on your device</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/manual-test')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              <Edit3 className="w-4 h-4" />
              Start Writing Test Case
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">Generation Failed</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4 text-center">What You Can Do</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="font-medium text-gray-900 mb-1">AI-Powered Generation</p>
            <p className="text-gray-500">Generate comprehensive test cases from PRD documents using AI</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="font-medium text-gray-900 mb-1">Natural Language Input</p>
            <p className="text-gray-500">Write tests in plain English, we convert them to executable scripts</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="font-medium text-gray-900 mb-1">Mobile App Testing</p>
            <p className="text-gray-500">Execute tests on Android emulators or physical devices via Appium</p>
          </div>
        </div>
      </div>
    </div>
  );
}
