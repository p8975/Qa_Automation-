'use client';

import { Smartphone, Monitor, Check, Wifi, WifiOff } from 'lucide-react';
import { Device } from '@/store/useTestStore';

interface DeviceCardProps {
  device: Device;
  selected: boolean;
  onSelect: (deviceId: string) => void;
}

const STATUS_CONFIG = {
  available: { color: 'text-green-500', bg: 'bg-green-100', label: 'Available' },
  busy: { color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Busy' },
  offline: { color: 'text-red-500', bg: 'bg-red-100', label: 'Offline' },
};

export function DeviceCard({ device, selected, onSelect }: DeviceCardProps) {
  const isDisabled = device.status !== 'available';
  const statusConfig = STATUS_CONFIG[device.status];
  const Icon = device.type === 'emulator' ? Monitor : Smartphone;

  return (
    <div
      onClick={() => !isDisabled && onSelect(device.device_id)}
      className={`relative border rounded-lg p-4 transition-all ${
        isDisabled
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
          : selected
          ? 'border-green-500 bg-green-50 ring-2 ring-green-200 cursor-pointer'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <div
          className={`p-4 rounded-xl mb-3 ${
            selected ? 'bg-green-100' : 'bg-gray-100'
          }`}
        >
          <Icon
            className={`w-10 h-10 ${selected ? 'text-green-600' : 'text-gray-500'}`}
          />
        </div>

        <h3 className="font-medium text-gray-900">{device.name}</h3>
        <p className="text-sm text-gray-500">{device.model}</p>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-400">
            {device.platform} {device.platform_version}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              device.status === 'available'
                ? 'bg-green-500'
                : device.status === 'busy'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          />
          <span className={`text-xs font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
              device.type === 'emulator'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {device.type === 'emulator' ? (
              <Monitor className="w-3 h-3" />
            ) : (
              <Smartphone className="w-3 h-3" />
            )}
            {device.type === 'emulator' ? 'Emulator' : 'Physical'}
          </span>
        </div>
      </div>
    </div>
  );
}
