import { DeviceConnection as DeviceConnectionHID } from '@cypherock/sdk-hw-hid';
import { DeviceConnection as DeviceConnectionSerial } from '@cypherock/sdk-hw-serialport';
import { IDevice } from '@cypherock/sdk-interfaces';

/**
 * Discovers all connected Cypherock devices from all supported transports.
 * @returns {Promise<IDevice[]>} A promise that resolves to an array of device descriptors.
 */
export const discoverAllDevices = async (): Promise<IDevice[]> => {
  try {
    const hidDevices = await DeviceConnectionHID.list();
    const serialDevices = await DeviceConnectionSerial.list();
    return [...hidDevices, ...serialDevices];
  } catch (error) {
    console.error('Error while listing devices:', error);
    return []; // Return an empty array on failure
  }
};