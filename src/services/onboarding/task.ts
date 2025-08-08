import { ManagerApp, OnboardingStep } from '@cypherock/sdk-app-manager';
import { DeviceConnection as DeviceConnectionHID } from '@cypherock/sdk-hw-hid';
import { DeviceConnection as DeviceConnectionSerial } from '@cypherock/sdk-hw-serialport';
import {
  DeviceState,
  IDevice,
  IDeviceConnection,
} from '@cypherock/sdk-interfaces';
import colors from 'colors/safe';

import {
  authAllCards,
  authDevice,
  getDeviceInfo,
  trainCard,
  trainJoystick,
  updateFirmwareAndGetApp,
} from '~/services/device';

export interface OnboardingResult {
  deviceSerial: string;
  status: 'success' | 'skipped' | 'failed';
  message: string;
  code?: any;
}

const createIsolatedConnection = async (
  device: IDevice,
): Promise<IDeviceConnection> => {
  if (device.type === 'hid') {
    return DeviceConnectionHID.connect(device);
  }
  return DeviceConnectionSerial.connect(device);
};

async function runSteps(app: ManagerApp, startStep: OnboardingStep) {
  let isPairRequired = false;
  const deviceInfo = await getDeviceInfo(app);
  const deviceId = deviceInfo.deviceSerial;

  const stepHandlers: Record<OnboardingStep, (() => Promise<void>) | undefined> =
    {
      [OnboardingStep.ONBOARDING_STEP_VIRGIN_DEVICE]: async () => {
        // Console logs are now handled by the TUI, so we remove them here
        await authDevice(app);
      },
      [OnboardingStep.ONBOARDING_STEP_DEVICE_AUTH]: async () => {
        await trainJoystick(app);
      },
      [OnboardingStep.ONBOARDING_STEP_JOYSTICK_TRAINING]: async () => {
        const result = await trainCard(app);
        isPairRequired = !result.cardPaired;
      },
      [OnboardingStep.ONBOARDING_STEP_CARD_CHECKUP]: async () => {
        await authAllCards({ app, isPairRequired });
      },
      [OnboardingStep.UNRECOGNIZED]: undefined,
      [OnboardingStep.ONBOARDING_STEP_CARD_AUTHENTICATION]: undefined,
      [OnboardingStep.ONBOARDING_STEP_COMPLETE]: undefined,
    };

  let startingStep = startStep;
  if (startingStep === OnboardingStep.ONBOARDING_STEP_CARD_CHECKUP) {
    startingStep = OnboardingStep.ONBOARDING_STEP_JOYSTICK_TRAINING;
  }

  for (
    let step = startingStep;
    step < OnboardingStep.ONBOARDING_STEP_CARD_AUTHENTICATION;
    step += 1
  ) {
    const handler = stepHandlers[step];
    if (handler) {
      await handler();
    }
  }
}

export async function runOnboardingForDevice(
  device: IDevice,
  startFromStep?: OnboardingStep,
): Promise<OnboardingResult> {
  let connection: IDeviceConnection | undefined;
  // Use device path for initial identification
  const deviceId = device.path;

  try {
    connection = await createIsolatedConnection(device);
    let app = await ManagerApp.create(connection);
    const initialDeviceInfo = await getDeviceInfo(app);
    const deviceSerial = initialDeviceInfo.deviceSerial;

    const deviceState = await connection.getDeviceState();
    if (deviceState === DeviceState.BOOTLOADER) {
      // MODIFIED: Calling the refactored update function
      const { newApp, newConnection } = await updateFirmwareAndGetApp({
        app,
        device,
      });
      // CRITICAL: Replace old connection and app instances with the new ones
      await app.destroy();
      await connection.destroy();
      app = newApp;
      connection = newConnection;
    }

    if (!(await app.isSupported())) {
      // MODIFIED: Calling the refactored update function
      const { newApp, newConnection } = await updateFirmwareAndGetApp({
        app,
        device,
      });
      // CRITICAL: Replace old connection and app instances with the new ones
      await app.destroy();
      await connection.destroy();
      app = newApp;
      connection = newConnection;
    }

    const deviceInfo = await getDeviceInfo(app);
    if (!deviceInfo.isInitial) {
      return {
        deviceSerial: deviceInfo.deviceSerial,
        status: 'skipped',
        message: 'Device is already onboarded.',
      };
    }

    await runSteps(app, startFromStep ?? deviceInfo.onboardingStep);
    await app.destroy();

    return {
      deviceSerial: deviceInfo.deviceSerial,
      status: 'success',
      message: 'Onboarding completed successfully.',
    };
  } catch (error: any) {
    return {
      deviceSerial: deviceId, // May not have serial yet on early failure
      status: 'failed',
      message: error.message,
      code: error.code,
    };
  } finally {
    if (connection) {
      await connection.destroy();
    }
  }
}