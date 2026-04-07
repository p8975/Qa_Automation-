'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Edit3, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { FileUploader } from '@/components/FileUploader';
import { useTestStore, TestCase } from '@/store/useTestStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function HomePage() {
  const router = useRouter();
  const { setTestCases, setUploadedPRD } = useTestStore();

  const [prdFile, setPrdFile] = useState<File | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = prdFile || manualInput.trim().length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setLoading(true);
    setError(null);

    try {
      let testCases: TestCase[] = [];

      if (prdFile) {
        // Upload PRD and generate test cases
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
        testCases = data.test_cases.map((tc: any) => ({
          ...tc,
          status: 'pending',
          selected: true,
        }));

        setUploadedPRD({ name: prdFile.name, content: '' });
      } else if (manualInput.trim()) {
        // Generate from manual input
        const res = await fetch(`${API_BASE}/api/test-cases/from-natural-language`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: manualInput }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Failed to generate test case');
        }

        const data = await res.json();
        if (data.success && data.test_case) {
          testCases = [{
            ...data.test_case,
            status: 'pending',
            selected: true,
          }];
        }
      }

      if (testCases.length > 0) {
        setTestCases(testCases);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">QA Test Case Generator</h1>
        <p className="text-gray-500 mt-1">Upload a PRD or describe your test cases manually</p>
      </div>

      {/* Main Content - Split Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: PRD Upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Upload PRD</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Upload a Product Requirements Document to automatically generate test cases
          </p>

          <FileUploader
            label="Click to upload or drag & drop"
            description="PDF, DOC, DOCX, TXT, MD (Max 10MB)"
            accept=".pdf,.doc,.docx,.txt,.md"
            onFileSelect={(file) => {
              setPrdFile(file);
              setManualInput(''); // Clear manual input when file is selected
            }}
            selectedFile={prdFile}
            onClear={() => setPrdFile(null)}
          />

          {prdFile && (
            <p className="text-sm text-green-600 mt-3 flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Ready to generate test cases from {prdFile.name}
            </p>
          )}
        </div>

        {/* Right: Manual Input */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Edit3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Manual Input</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Describe your test scenarios in natural language
          </p>

          <textarea
            value={manualInput}
            onChange={(e) => {
              setManualInput(e.target.value);
              if (e.target.value.trim()) setPrdFile(null); // Clear file when typing
            }}
            placeholder="Example: Test that user can login with phone number, receive OTP, verify OTP, and reach the home screen. Also test invalid phone number and wrong OTP scenarios."
            className="w-full h-40 border border-gray-300 rounded-lg px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />

          {manualInput.trim() && (
            <p className="text-sm text-blue-600 mt-3 flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Ready to generate test cases from your description
            </p>
          )}
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

      {/* Generate CTA */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
          className={`flex items-center gap-2 px-8 py-3 rounded-lg text-lg font-semibold transition-all ${
            canGenerate && !loading
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Test Cases...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Test Cases
            </>
          )}
        </button>
      </div>

      {/* Hint */}
      {!canGenerate && (
        <p className="text-center text-sm text-gray-400">
          Upload a PRD document or enter manual test description to enable generation
        </p>
      )}
    </div>
  );
}
