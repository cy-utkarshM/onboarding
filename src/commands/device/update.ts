// src/commands/device/update.ts

// eslint-disable-next-line import/order
import config from '../../config';

import { ManagerApp } from '@cypherock/sdk-app-manager';
import { DeviceState, IDevice } from '@cypherock/sdk-interfaces';
import { Flags } from '@oclif/core';
import colors from 'colors/safe';
import semver from 'semver';

import { updateFirmwareAndGetApp } from '~/services';
import { BaseCommand, getDevices } from '~/utils';

export default class DeviceUpdate extends BaseCommand<typeof DeviceUpdate> {
  static description = 'Update firmware on device';

  static examples = [`$ <%= config.bin %> <%= command.id %>`];

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Force update even when device is already up to date',
    }),
  };

  protected connectToDevice = true;

  async run(): Promise<void> {
    this.log(colors.blue('Starting device firmware update'));

    const { flags } = await this.parse(DeviceUpdate);

    const app = await ManagerApp.create(this.connection);

    if (
      !flags.force &&
      (await this.connection.getDeviceState()) !== DeviceState.BOOTLOADER
    ) {
      const latestVersion = await ManagerApp.getLatestFirmware({
        prerelease: config.ALLOW_PRERELEASE,
      });

      const deviceInfo = await app.getDeviceInfo();

      if (
        deviceInfo.firmwareVersion &&
        semver.gte(
          `${deviceInfo.firmwareVersion.major}.${deviceInfo.firmwareVersion.minor}.${deviceInfo.firmwareVersion.patch}`,
          latestVersion.version,
        )
      ) {
        this.log(colors.green('Device firmware is already up to date'));
        return;
      }
    }

    // Get the device object to pass to the update function.
    // BaseCommand connects to the first device, so we fetch it here.
    const devices = await getDevices();
    if (devices.length === 0) {
      throw new Error('No device found to update.');
    }
    const device: IDevice = devices[0];

    // Call the function with the correct object structure { app, device }
    await updateFirmwareAndGetApp({ app, device });

    this.log(colors.green('Device firmware Update successful'));
    await app.destroy();
  }
}