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

// Helper to create a connection for a specific device without using the global singleton
const createIsolatedConnection = async (
  device: IDevice,
): Promise<IDeviceConnection> => {
  if (device.type === 'hid') {
    return DeviceConnectionHID.connect(device);
  }
  return DeviceConnectionSerial.connect(device);
};

// This function encapsulates the entire onboarding logic for a single device.
// It is self-contained and manages its own connection.
async function runSteps(app: ManagerApp, startStep: OnboardingStep) {
  let isPairRequired = false;
  const deviceId = app.getDeviceSerial();

  const stepHandlers: Record<OnboardingStep, (() => Promise<void>) | undefined> =
    {
      [OnboardingStep.ONBOARDING_STEP_VIRGIN_DEVICE]: async () => {
        console.log(colors.cyan(`[${deviceId}] Authenticating device...`));
        await authDevice(app);
      },
      [OnboardingStep.ONBOARDING_STEP_DEVICE_AUTH]: async () => {
        console.log(colors.cyan(`[${deviceId}] Starting joystick training...`));
        await trainJoystick(app);
      },
      [OnboardingStep.ONBOARDING_STEP_JOYSTICK_TRAINING]: async () => {
        console.log(colors.cyan(`[${deviceId}] Starting card training...`));
        const result = await trainCard(app);
        isPairRequired = !result.cardPaired;
      },
      [OnboardingStep.ONBOARDING_STEP_CARD_CHECKUP]: async () => {
        console.log(colors.cyan(`[${deviceId}] Authenticating all cards...`));
        await authAllCards({ app, isPairRequired });
      },
      // Steps we don't handle
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
) {
  let connection: IDeviceConnection | undefined;
  const deviceId = device.path; // Use path as a temporary ID before we get serial

  try {
    // 1. Create an ISOLATED connection for this device
    console.log(colors.gray(`[${deviceId}] Creating connection...`));
    connection = await createIsolatedConnection(device);

    let app = await ManagerApp.create(connection);
    const deviceSerial = app.getDeviceSerial(); // Get the real serial for logging

    // 2. Run firmware updates if necessary
    const deviceState = await connection.getDeviceState();
    if (deviceState === DeviceState.BOOTLOADER) {
      console.log(
        colors.yellow(`[${deviceSerial}] Device in bootloader mode, updating...`),
      );
      app = await updateFirmwareAndGetApp(app);
    }

    if (!(await app.isSupported())) {
      console.log(
        colors.yellow(`[${deviceSerial}] App version not supported, updating...`),
      );
      app = await updateFirmwareAndGetApp(app);
    }

    // 3. Check if device is already onboarded
    const deviceInfo = await getDeviceInfo(app);
    if (!deviceInfo.isInitial) {
      return {
        deviceSerial: deviceInfo.deviceSerial,
        status: 'skipped',
        message: 'Device is already onboarded.',
      };
    }

    // 4. Run the sequential onboarding steps
    console.log(
      colors.blue(`[${deviceSerial}] Starting onboarding steps...`),
    );
    await runSteps(app, startFromStep ?? deviceInfo.onboardingStep);

    await app.destroy();

    return {
      deviceSerial: deviceInfo.deviceSerial,
      status: 'success',
      message: 'Onboarding completed successfully.',
    };
  } catch (error: any) {
    // 5. On failure, return a structured error
    return {
      deviceSerial: device.serialNumber ?? deviceId,
      status: 'failed',
      message: error.message,
      code: error.code,
    };
  } finally {
    // 6. CRITICAL: Always clean up the isolated connection
    if (connection) {
      await connection.destroy();
      console.log(colors.gray(`[${deviceId}] Connection closed.`));
    }
  }
}