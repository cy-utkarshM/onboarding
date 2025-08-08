// src/commands/onboarding/setup.ts

import '../../config';

import { ManagerApp, OnboardingStep } from '@cypherock/sdk-app-manager';
import { DeviceState, IDevice } from '@cypherock/sdk-interfaces';
import { Flags } from '@oclif/core';
import colors from 'colors/safe';

import {
  authAllCards,
  authDevice,
  trainCard,
  trainJoystick,
  updateFirmwareAndGetApp,
} from '~/services';
import { BaseCommand, getDevices } from '~/utils';

export default class OnboardingSetup extends BaseCommand<
  typeof OnboardingSetup
> {
  static description = 'Onboard new device';

  static examples = [`$ <%= config.bin %> <%= command.id %>`];

  static flags = {
    step: Flags.integer({
      min: OnboardingStep.ONBOARDING_STEP_VIRGIN_DEVICE,
      max: OnboardingStep.ONBOARDING_STEP_CARD_CHECKUP,
      char: 's',
      description: 'Onboarding step to start from',
    }),
  };

  protected connectToDevice = true;

  // eslint-disable-next-line class-methods-use-this
  async runOnboardingSteps(app: ManagerApp, deviceStep: OnboardingStep) {
    let isPairRequired = false;

    const stepHandlers: Record<
      OnboardingStep,
      (() => Promise<void>) | undefined
    > = {
      [OnboardingStep.ONBOARDING_STEP_VIRGIN_DEVICE]: async () => {
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

    let startingStep = deviceStep;

    // Start from card training when device is waiting for card auth
    if (startingStep === OnboardingStep.ONBOARDING_STEP_CARD_CHECKUP) {
      startingStep = OnboardingStep.ONBOARDING_STEP_JOYSTICK_TRAINING;
    }

    for (
      let step = startingStep;
      step < OnboardingStep.ONBOARDING_STEP_CARD_AUTHENTICATION;
      step += 1
    ) {
      const handler = stepHandlers[step];
      if (!handler) {
        return;
      }

      await handler();
    }
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(OnboardingSetup);

    this.log(colors.blue('Starting onboarding'));

    let app = await ManagerApp.create(this.connection);
    const deviceState = await this.connection.getDeviceState();

    // We need the device object to pass to the update function.
    // BaseCommand connects to the first device found, so we do the same.
    const devices = await getDevices();
    if (devices.length === 0) {
      throw new Error('No device found for setup.');
    }
    const device: IDevice = devices[0];

    if (deviceState === DeviceState.BOOTLOADER) {
      this.log(colors.yellow('Device is in bootloader mode, updating...'));
      // Correctly call the update function and handle its new return value
      const { newApp, newConnection } = await updateFirmwareAndGetApp({ app, device });
      app = newApp;
      this.connection = newConnection; // Update the base command's connection
    }

    if (!(await app.isSupported())) {
      this.log(colors.yellow('App version not supported, updating...'));
      // Correctly call the update function and handle its new return value
      const { newApp, newConnection } = await updateFirmwareAndGetApp({ app, device });
      app = newApp;
      this.connection = newConnection; // Update the base command's connection
    }

    const deviceInfo = await app.getDeviceInfo();

    if (!deviceInfo.isInitial) {
      this.log(colors.green('Device is already onboarded'));
      return;
    }

    await this.runOnboardingSteps(app, flags.step ?? deviceInfo.onboardingStep);

    this.log(colors.green('Onboarding Completed'));
    await app.destroy();
  }
}