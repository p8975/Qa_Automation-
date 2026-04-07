'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, Monitor, ArrowRight, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { DeviceCard } from '@/components/DeviceCard';
import { useTestStore, Device } from '@/store/useTestStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Mock devices for demo
const MOCK_DEVICES: Device[] = [
  {
    device_id: 'emulator-5554',
    name: 'Pixel 6 Emulator',
    model: 'Pixel 6',
    platform: 'Android',
    platform_version: '13',
    type: 'emulator',
    status: 'available',
  },
  {
    device_id: 'emulator-5556',
    name: 'Pixel 4 Emulator',
    model: 'Pixel 4',
    platform: 'Android',
    platform_version: '12',
    type: 'emulator',
    status: 'available',
  },
  {
    device_id: 'physical-001',
    name: 'Samsung Galaxy S21',
    model: 'SM-G991B',
    platform: 'Android',
    platform_version: '13',
    type: 'physical',
    status: 'available',
  },
  {
    device_id: 'physical-002',
    name: 'OnePlus 9 Pro',
    model: 'LE2121',
    platform: 'Android',
    platform_version: '12',
    type: 'physical',
    status: 'busy',
  },
  {
    device_id: 'emulator-5558',
    name: 'Nexus 5X Emulator',
    model: 'Nexus 5X',
    platform: 'Android',
    platform_version: '11',
    type: 'emulator',
    status: 'offline',
  },
];

export default function DevicesPage() {
  const router = useRouter();
  const {
    devices,
    setDevices,
    selectedDeviceId,
    selectDevice,
    selectedBuildId,
    testCases,
  } = useTestStore();

  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'emulator' | 'physical'>('all');

  const selectedCount = testCases.filter((tc) => tc.selected).length;

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/devices`);
      if (res.ok) {
        const data = await res.json();
        // Map API response to our Device interface
        const mappedDevices: Device[] = data.map((d: any) => ({
          device_id: d.device_id,
          name: d.model || d.device_id,
          model: d.model,
          platform: d.platform,
          platform_version: d.platform_version,
          type: d.device_id.includes('emulator') ? 'emulator' : 'physical',
          status: d.status || 'available',
        }));
        setDevices(mappedDevices.length > 0 ? mappedDevices : MOCK_DEVICES);
      } else {
        // Use mock data if API fails
        setDevices(MOCK_DEVICES);
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      setDevices(MOCK_DEVICES);
    } finally {
      setLoading(false);
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (filterType === 'all') return true;
    return d.type === filterType;
  });

  const emulators = devices.filter((d) => d.type === 'emulator');
  const physicalDevices = devices.filter((d) => d.type === 'physical');

  const handleStartExecution = () => {
    if (selectedDeviceId && selectedBuildId) {
      router.push('/execution');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-14 z-40 bg-gray-50 -mx-4 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/builds')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Builds
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Select Device</h1>
              <p className="text-sm text-gray-500">
                {selectedCount} test cases • Build selected
              </p>
            </div>
          </div>
          <button
            onClick={handleStartExecution}
            disabled={!selectedDeviceId}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
          >
            Start Execution
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-green-100 text-green-700'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            All ({devices.length})
          </button>
          <button
            onClick={() => setFilterType('emulator')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'emulator'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Emulators ({emulators.length})
          </button>
          <button
            onClick={() => setFilterType('physical')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'physical'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Physical ({physicalDevices.length})
          </button>
        </div>

        <button
          onClick={fetchDevices}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-white rounded-lg border border-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Devices Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No devices found</p>
          <p className="text-sm text-gray-400">Connect a device or start an emulator</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.device_id}
              device={device}
              selected={selectedDeviceId === device.device_id}
              onSelect={selectDevice}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Available
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          Busy
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Offline
        </div>
      </div>
    </div>
  );
}
