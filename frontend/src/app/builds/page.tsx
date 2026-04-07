'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Upload, ArrowRight, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { FileUploader } from '@/components/FileUploader';
import { BuildCard } from '@/components/BuildCard';
import { useTestStore, Build } from '@/store/useTestStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function BuildsPage() {
  const router = useRouter();
  const {
    builds,
    setBuilds,
    addBuild,
    selectedBuildId,
    selectBuild,
    testCases,
  } = useTestStore();

  const [apkFile, setApkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedCount = testCases.filter((tc) => tc.selected).length;

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
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!apkFile) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
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

  const handleProceed = () => {
    if (selectedBuildId) {
      router.push('/devices');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-14 z-40 bg-gray-50 -mx-4 px-4 py-3 border-b border-gray-200">
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
              <h1 className="text-xl font-bold text-gray-900">Select Build</h1>
              <p className="text-sm text-gray-500">
                {selectedCount} test cases selected for execution
              </p>
            </div>
          </div>
          <button
            onClick={handleProceed}
            disabled={!selectedBuildId}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
          >
            Proceed to Devices
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Upload New APK */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Upload New APK</h2>
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
            onClick={handleUpload}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            <Upload className="w-4 h-4" />
            Upload APK
          </button>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {/* Existing Builds */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Existing Builds</h2>
          <span className="text-sm text-gray-500">({builds.length})</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : builds.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No builds uploaded yet</p>
            <p className="text-sm text-gray-400">Upload an APK to get started</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {builds.map((build) => (
              <BuildCard
                key={build.build_id}
                build={build}
                selected={selectedBuildId === build.build_id}
                onSelect={selectBuild}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
