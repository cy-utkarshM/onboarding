// src/services/onboarding/index.ts

import '../../config';

import { OnboardingStep } from '@cypherock/sdk-app-manager';
import { IDevice } from '@cypherock/sdk-interfaces';
import { Flags } from '@oclif/core';
import colors from 'colors/safe';

// FIXED: Import OnboardingResult along with the function
import {
  runOnboardingForDevice,
  OnboardingResult,
} from '~/services/onboarding/task';
import { BaseCommand, getDevices } from '~/utils';

export default class Onboarding extends BaseCommand<typeof Onboarding> {
  static description =
    'Onboard one or more new devices in parallel. Connect all devices before running.';

  static examples = [`$ <%= config.bin %> <%= command.id %>`];

  static flags = {
    step: Flags.integer({
      min: OnboardingStep.ONBOARDING_STEP_VIRGIN_DEVICE,
      max: OnboardingStep.ONBOARDING_STEP_CARD_CHECKUP,
      char: 's',
      description: 'Force onboarding to start from a specific step for all devices',
    }),
  };

  // Set to false: This command will manage its own connections,
  // not use the global singleton from BaseCommand.
  protected connectToDevice = false;

  async run(): Promise<void> {
    const { flags } = await this.parse(Onboarding);

    // FIXED: Corrected colors syntax to composition
    this.log(colors.bold(colors.blue('--- Cypherock Parallel Onboarding Tool ---')));
    this.log('🔎 Discovering connected devices...');

    const devices = await getDevices();

    if (devices.length === 0) {
      this.log(
        colors.yellow(
          '\nNo devices found. Please connect your Cypherock device(s) and try again.',
        ),
      );
      return;
    }

    this.log(
      colors.green(
        `Found ${devices.length} device(s). Starting onboarding...`,
      ),
    );
    this.log(
      colors.gray(
        'Follow the instructions on each device screen. The process will run in parallel.',
      ),
    );

    // Create an array of promises. Each promise is a full, independent onboarding task.
    const onboardingPromises = devices.map((device: IDevice) =>
      runOnboardingForDevice(device, flags.step),
    );

    // Wait for all tasks to complete, whether they succeed or fail.
    const results = await Promise.all(onboardingPromises);

    // Display the final summary report
    // FIXED: Corrected colors syntax to composition
    this.log(colors.bold(colors.blue('\n--- Onboarding Summary ---')));

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // This is now correctly typed and will work
    results.forEach((result: OnboardingResult) => {
      switch (result.status) {
        case 'success':
          this.log(
            `✔️  ${colors.green('[SUCCESS]')} Device ${result.deviceSerial}: ${
              result.message
            }`,
          );
          successCount++;
          break;
        case 'skipped':
          this.log(
            `☑️  ${colors.yellow('[SKIPPED]')} Device ${result.deviceSerial}: ${
              result.message
            }`,
          );
          skippedCount++;
          break;
        case 'failed':
          this.log(
            `❌ ${colors.red('[FAILURE]')} Device ${result.deviceSerial}: ${
              result.message
            } ${result.code ? `(Code: ${result.code})` : ''}`,
          );
          failedCount++;
          break;
        default:
          break;
      }
    });

    this.log(
      `\nReport: ${successCount} Succeeded, ${failedCount} Failed, ${skippedCount} Skipped.`,
    );
  }
}