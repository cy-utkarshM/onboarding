import { ManagerApp } from '@cypherock/sdk-app-manager';
import { IDevice, IDeviceConnection } from '@cypherock/sdk-interfaces';

import config from '~/config';
// REMOVED: No longer using the singleton utils here for connections
import { Spinner } from '~/utils';

// Helper to create a dedicated connection for the update process
const createUpdateConnection = async (
  device: IDevice,
): Promise<IDeviceConnection> => {
  // This uses the raw SDK connect methods to avoid the singleton
  const { DeviceConnection: DeviceConnectionHID } = await import(
    '@cypherock/sdk-hw-hid'
  );
  const { DeviceConnection: DeviceConnectionSerial } = await import(
    '@cypherock/sdk-hw-serialport'
  );

  if (device.type === 'hid') {
    return DeviceConnectionHID.connect(device);
  }
  return DeviceConnectionSerial.connect(device);
};

// Helper to list all available devices for the updater
const listAllDevices = async () => {
  const { DeviceConnection: DeviceConnectionHID } = await import(
    '@cypherock/sdk-hw-hid'
  );
  const { DeviceConnection: DeviceConnectionSerial } = await import(
    '@cypherock/sdk-hw-serialport'
  );

  const devices = [
    ...(await DeviceConnectionHID.list()),
    ...(await DeviceConnectionSerial.list()),
  ];

  return devices;
};

const name = 'Updating Device Firmware';

// MODIFIED: The function now accepts the specific device and returns the new app and connection
export const updateFirmwareAndGetApp = async (params: {
  app: ManagerApp;
  device: IDevice;
}) => {
  const { app, device } = params;
  const spinner = await Spinner.create(name);

  try {
    // We pass our isolated connection helpers to the updater
    await app.updateFirmware({
      getDevices: listAllDevices,
      createConnection: createUpdateConnection,
      onProgress: p => spinner.updateText(`${name} (${p.toFixed(0)}%)`),
      allowPrerelease: config.ALLOW_PRERELEASE,
    });

    spinner.succeed(name);

    // After update, we need a fresh connection and app instance
    const newConnection = await createUpdateConnection(device);
    const newApp = await ManagerApp.create(newConnection);

    return { newApp, newConnection };
  } catch (error) {
    spinner.fail();
    throw error;
  }
};