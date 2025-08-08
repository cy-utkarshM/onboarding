import Onboarding from './index';

// --- Mock Listr2 to produce predictable output and support skip ---
jest.mock('listr2', () => {
  return {
    Listr: class {
      constructor(private tasks: any[]) {
        this.tasks = tasks;
      }
      async run() {
        for (const t of this.tasks) {
          const taskObj: any = {
            title: t.title,
            output: '',
            skip: (msg: string) => {
              taskObj.output = msg;
            },
          };
          try {
            await t.task({}, taskObj);
            console.log(`Device: ${taskObj.deviceSerial || taskObj.title.replace('Onboarding', '').trim()}`);
            if (taskObj.output) console.log(taskObj.output);
          } catch (err: any) {
            console.log(`Device: ${taskObj.deviceSerial || taskObj.title.replace('Onboarding', '').trim()}`);
            console.log(err.message);
          }
        }
      }
    },
  };
});

// --- Mock runOnboardingForDevice ---
jest.mock('~/services/onboarding/task', () => ({
  runOnboardingForDevice: jest.fn(),
}));

// --- Mock getDevices but keep real cleanUpDeviceConnection ---
jest.mock('~/utils/device', () => {
  const actual = jest.requireActual('~/utils/device');
  return {
    ...actual,
    getDevices: jest.fn(),
  };
});

import { runOnboardingForDevice } from '~/services/onboarding/task';
import { getDevices } from '~/utils/device';

describe('Onboarding Command', () => {
  let consoleSpy: jest.SpyInstance;
  let oclifLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    oclifLogSpy = jest.spyOn(Onboarding.prototype as any, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    oclifLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  const getOutput = () => {
    const consoleCalls = consoleSpy.mock.calls.map(call => call[0]);
    const oclifCalls = oclifLogSpy.mock.calls.map(call => call[0]);
    return [...oclifCalls, ...consoleCalls].join('\n');
  };

  test('should successfully onboard two new devices', async () => {
    (getDevices as jest.Mock).mockResolvedValue([
      { type: 'hid', path: 'path-A' },
      { type: 'hid', path: 'path-B' },
    ]);

    (runOnboardingForDevice as jest.Mock)
      .mockResolvedValueOnce({
        deviceSerial: 'serial-A',
        status: 'success',
        message: 'Onboarding completed successfully.',
      })
      .mockResolvedValueOnce({
        deviceSerial: 'serial-B',
        status: 'success',
        message: 'Onboarding completed successfully.',
      });

    await Onboarding.run([]);

    const output = getOutput();
    expect(output).toContain('Found 2 device(s)');
    expect(output).toContain('Device: serial-A');
    expect(output).toContain('Onboarding completed successfully.');
    expect(output).toContain('Device: serial-B');
  });

  test('should onboard one new device and skip one already onboarded device', async () => {
    (getDevices as jest.Mock).mockResolvedValue([
      { type: 'hid', path: 'path-A' },
      { type: 'hid', path: 'path-B' },
    ]);

    (runOnboardingForDevice as jest.Mock)
      .mockResolvedValueOnce({
        deviceSerial: 'serial-A',
        status: 'success',
        message: 'Onboarding completed successfully.',
      })
      .mockResolvedValueOnce({
        deviceSerial: 'serial-B',
        status: 'skipped',
        message: 'Device is already onboarded.',
      });

    await Onboarding.run([]);

    const output = getOutput();
    expect(output).toContain('Device: serial-A');
    expect(output).toContain('Onboarding completed successfully.');
    expect(output).toContain('Device: serial-B');
    expect(output).toContain('Device is already onboarded.');
  });

  test('should fail one device if an invalid card is used', async () => {
    (getDevices as jest.Mock).mockResolvedValue([
      { type: 'hid', path: 'path-A' },
    ]);

    (runOnboardingForDevice as jest.Mock).mockResolvedValueOnce({
      deviceSerial: 'serial-A',
      status: 'failed',
      message: 'Card seems to be compromised.',
      code: 'APP_0701',
    });

    await Onboarding.run([]);

    const output = getOutput();
    expect(output).toContain('Device: serial-A');
    expect(output).toContain('Card seems to be compromised.');
    expect(output).toContain('(Code: APP_0701)');
  });

  test('should show a message when no devices are found', async () => {
    (getDevices as jest.Mock).mockResolvedValue([]);

    await Onboarding.run([]);

    const output = getOutput();
    expect(output).toContain('No devices found.');
  });
});
