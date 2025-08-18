
import '../../config';

import { OnboardingResult, runOnboardingForDevice } from '~/services/onboarding/task';
import { BaseCommand, getDevices } from '~/utils';
import colors from 'colors/safe';

export default class OnboardingSetupMultiple extends BaseCommand<
  typeof OnboardingSetupMultiple
> {
  static description = 'Onboard multiple new devices at once.';

  static examples = [`$ <%= config.bin %> <%= command.id %>`];

  // No flags needed for the initial version
  static flags = {};

  // No need to connect to a single device beforehand
  protected connectToDevice = false;

  async run(): Promise<void> {
    this.log(colors.blue('Starting concurrent onboarding for all connected devices...'));

    const devices = await getDevices();

    if (devices.length === 0) {
      this.log(colors.yellow('No devices found. Please connect devices and try again.'));
      return;
    }

    this.log(colors.cyan(`Found ${devices.length} devices. Starting onboarding for each...`));

    const onboardingPromises = devices.map(device => runOnboardingForDevice(device));

    const results = await Promise.allSettled(onboardingPromises);

    this.log(colors.blue('\n--- Onboarding Results ---'));

    results.forEach((result, index) => {
      const devicePath = devices[index].path;

      if (result.status === 'fulfilled') {
        const data = result.value as OnboardingResult;
        const serial = data.deviceSerial ? `(Serial: ${data.deviceSerial})` : '';

        if (data.status === 'success') {
          this.log(colors.green(`✔ Device ${devicePath} ${serial}: Success!`));
          this.log(`  - ${data.message}`);
        } else if (data.status === 'skipped') {
          this.log(colors.yellow(`➤ Device ${devicePath} ${serial}: Skipped`));
          this.log(`  - ${data.message}`);
        } else {
          this.log(colors.red(`✗ Device ${devicePath} ${serial}: Failed`));
          this.log(`  - ${data.message}`);
        }
      } else {
        // Promise was rejected
        this.log(colors.red(`✗ Device ${devicePath}: Critical Failure`));
        this.log(`  - An unexpected error occurred: ${result.reason.message ?? result.reason}`);
      }
      this.log('---');
    });
  }
}
