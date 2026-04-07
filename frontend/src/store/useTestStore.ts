import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TestCase {
  id: string;
  title: string;
  description: string;
  preconditions: string[];
  steps: string[];
  expected_result: string;
  priority: 'High' | 'Medium' | 'Low';
  category: string;
  status: 'pending' | 'good' | 'useless' | 'edited';
  selected: boolean;
  module?: string;
}

export interface Build {
  build_id: string;
  file_name: string;
  app_package: string;
  app_version: string;
  file_size_bytes: number;
  uploaded_at: string;
}

export interface Device {
  device_id: string;
  name: string;
  model: string;
  platform: string;
  platform_version: string;
  type: 'emulator' | 'physical';
  status: 'available' | 'busy' | 'offline';
}

export interface TestResult {
  test_case_id: string;
  title: string;
  status: 'pass' | 'fail' | 'skipped';
  duration_ms: number;
  error_message?: string;
  steps_passed: number;
  steps_total: number;
}

export interface ExecutionRun {
  run_id: string;
  build_id: string;
  device_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
  started_at: string;
  completed_at?: string;
  total_tests: number;
  passed: number;
  failed: number;
  remaining: number;
  current_test?: string;
  results: TestResult[];
}

export interface ScheduledRun {
  id: string;
  name: string;
  test_case_ids: string[];
  build_id: string;
  device_id: string;
  scheduled_at: string; // ISO string in IST
  status: 'scheduled' | 'completed' | 'cancelled';
  run_id?: string;
}

export interface SavedModule {
  id: string;
  name: string;
  test_case_ids: string[];
  created_at: string;
}

interface TestStore {
  // Test Cases
  testCases: TestCase[];
  setTestCases: (cases: TestCase[]) => void;
  updateTestCase: (id: string, updates: Partial<TestCase>) => void;
  toggleTestCaseSelection: (id: string) => void;
  selectAllTestCases: () => void;
  deselectAllTestCases: () => void;
  getSelectedTestCases: () => TestCase[];

  // Saved Modules
  savedModules: SavedModule[];
  saveModule: (name: string, testCaseIds: string[]) => void;
  loadModule: (moduleId: string) => void;
  deleteModule: (moduleId: string) => void;

  // Builds
  builds: Build[];
  selectedBuildId: string | null;
  setBuilds: (builds: Build[]) => void;
  addBuild: (build: Build) => void;
  selectBuild: (buildId: string) => void;

  // Devices
  devices: Device[];
  selectedDeviceId: string | null;
  setDevices: (devices: Device[]) => void;
  selectDevice: (deviceId: string) => void;

  // Execution
  currentRun: ExecutionRun | null;
  setCurrentRun: (run: ExecutionRun | null) => void;
  updateCurrentRun: (updates: Partial<ExecutionRun>) => void;

  // Execution History
  executionHistory: ExecutionRun[];
  addToHistory: (run: ExecutionRun) => void;

  // Scheduling
  scheduledRuns: ScheduledRun[];
  addScheduledRun: (run: Omit<ScheduledRun, 'id' | 'status'>) => void;
  cancelScheduledRun: (id: string) => void;
  updateScheduledRun: (id: string, updates: Partial<ScheduledRun>) => void;

  // PRD
  uploadedPRD: { name: string; content: string } | null;
  setUploadedPRD: (prd: { name: string; content: string } | null) => void;

  // Reset
  resetStore: () => void;
}

const initialState = {
  testCases: [],
  savedModules: [],
  builds: [],
  selectedBuildId: null,
  devices: [],
  selectedDeviceId: null,
  currentRun: null,
  executionHistory: [],
  scheduledRuns: [],
  uploadedPRD: null,
};

export const useTestStore = create<TestStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Test Cases
      setTestCases: (cases) => set({ testCases: cases }),

      updateTestCase: (id, updates) => set((state) => ({
        testCases: state.testCases.map((tc) =>
          tc.id === id ? { ...tc, ...updates } : tc
        ),
      })),

      toggleTestCaseSelection: (id) => set((state) => ({
        testCases: state.testCases.map((tc) =>
          tc.id === id ? { ...tc, selected: !tc.selected } : tc
        ),
      })),

      selectAllTestCases: () => set((state) => ({
        testCases: state.testCases.map((tc) => ({ ...tc, selected: true })),
      })),

      deselectAllTestCases: () => set((state) => ({
        testCases: state.testCases.map((tc) => ({ ...tc, selected: false })),
      })),

      getSelectedTestCases: () => get().testCases.filter((tc) => tc.selected),

      // Saved Modules
      saveModule: (name, testCaseIds) => set((state) => ({
        savedModules: [
          ...state.savedModules,
          {
            id: `module_${Date.now()}`,
            name,
            test_case_ids: testCaseIds,
            created_at: new Date().toISOString(),
          },
        ],
      })),

      loadModule: (moduleId) => {
        const module = get().savedModules.find((m) => m.id === moduleId);
        if (module) {
          set((state) => ({
            testCases: state.testCases.map((tc) => ({
              ...tc,
              selected: module.test_case_ids.includes(tc.id),
            })),
          }));
        }
      },

      deleteModule: (moduleId) => set((state) => ({
        savedModules: state.savedModules.filter((m) => m.id !== moduleId),
      })),

      // Builds
      setBuilds: (builds) => set({ builds }),

      addBuild: (build) => set((state) => ({
        builds: [build, ...state.builds],
      })),

      selectBuild: (buildId) => set({ selectedBuildId: buildId }),

      // Devices
      setDevices: (devices) => set({ devices }),
      selectDevice: (deviceId) => set({ selectedDeviceId: deviceId }),

      // Execution
      setCurrentRun: (run) => set({ currentRun: run }),

      updateCurrentRun: (updates) => set((state) => ({
        currentRun: state.currentRun ? { ...state.currentRun, ...updates } : null,
      })),

      // Execution History
      addToHistory: (run) => set((state) => ({
        executionHistory: [run, ...state.executionHistory].slice(0, 50),
      })),

      // Scheduling
      addScheduledRun: (run) => set((state) => ({
        scheduledRuns: [
          ...state.scheduledRuns,
          { ...run, id: `sched_${Date.now()}`, status: 'scheduled' },
        ],
      })),

      cancelScheduledRun: (id) => set((state) => ({
        scheduledRuns: state.scheduledRuns.map((r) =>
          r.id === id ? { ...r, status: 'cancelled' } : r
        ),
      })),

      updateScheduledRun: (id, updates) => set((state) => ({
        scheduledRuns: state.scheduledRuns.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      })),

      // PRD
      setUploadedPRD: (prd) => set({ uploadedPRD: prd }),

      // Reset
      resetStore: () => set(initialState),
    }),
    {
      name: 'qa-platform-storage',
      partialize: (state) => ({
        testCases: state.testCases,
        savedModules: state.savedModules,
        builds: state.builds,
        selectedBuildId: state.selectedBuildId,
        executionHistory: state.executionHistory,
        scheduledRuns: state.scheduledRuns,
      }),
    }
  )
);
