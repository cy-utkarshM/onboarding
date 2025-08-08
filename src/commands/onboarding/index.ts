import '../../config';

import { OnboardingStep } from '@cypherock/sdk-app-manager';
import { IDevice } from '@cypherock/sdk-interfaces';
import { Flags } from '@oclif/core';
import colors from 'colors/safe';
import { Listr, ListrTask } from 'listr2'; // MODIFIED: Using Listr2 for a better TUI

// OnboardingResult is already imported, which is good
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
      description:
        'Force onboarding to start from a specific step for all devices',
    }),
  };

  protected connectToDevice = false;

  async run(): Promise<void> {
    const { flags } = await this.parse(Onboarding);

    this.log(
      colors.bold(colors.blue('--- Cypherock Parallel Onboarding Tool ---')),
    );
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

    this.log(colors.green(`Found ${devices.length} device(s).`));
    this.log(
      colors.gray(
        'Follow instructions on each device. The process will run in parallel.',
      ),
    );

    // NEW: Create a Listr task for each device
    const tasks: ListrTask[] = devices.map((device: IDevice) => ({
      // Use the device path as the initial title
      title: `Device: ${device.path}`,
      task: async (ctx, task): Promise<void> => {
        const result = await runOnboardingForDevice(device, flags.step);

        // Update task title with device serial once known
        if (result.deviceSerial !== device.path) {
          task.title = `Device: ${result.deviceSerial}`;
        }

        // Handle the outcome
        switch (result.status) {
          case 'success':
            task.output = `✔️ ${result.message}`;
            break;
          case 'skipped':
            // Mark as skipped, which Listr handles nicely
            task.skip(`☑️ ${result.message}`);
            break;
          case 'failed':
            // Throw an error to make Listr mark the task as failed
            throw new Error(
              `❌ ${result.message} ${
                result.code ? `(Code: ${result.code})` : ''
              }`,
            );
          default:
            break;
        }
      },
      // Retry option can be useful for transient connection issues
      options: {
        persistentOutput: true,
      },
    }));

    // Create and run the main task list
    const list = new Listr(tasks, {
      concurrent: true, // Run all device tasks in parallel
      exitOnError: false, // Don't stop other devices if one fails
      rendererOptions: {
        collapseErrors: false,
        collapseSkips: false,
      },
    });

    try {
      await list.run();
    } catch (e) {
      // Listr2 handles error display, so we don't need to do much here
      this.log(colors.red('\nSome tasks failed. Please see details above.'));
    }

    this.log(colors.bold(colors.blue('\n--- Onboarding Complete ---')));
  }
}