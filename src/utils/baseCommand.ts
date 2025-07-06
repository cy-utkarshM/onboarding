// eslint-disable-next-line max-classes-per-file
import { IDeviceConnection } from '@cypherock/sdk-interfaces';
import { Command, Interfaces } from '@oclif/core';

import { cleanUpDeviceConnection, createConnection } from './device';

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCommand)['baseFlags'] & T['flags']
>;
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;

export abstract class BaseCommand<T extends typeof Command> extends Command {
  static baseFlags = {};

  protected connectToDevice = false;

  protected flags!: Flags<T>;

  protected args!: Args<T>;

  private connectionInstance: IDeviceConnection | undefined;

  protected get connection(): IDeviceConnection {
    if (!this.connectionInstance) {
      throw new Error('No device connection found');
    }
    return this.connectionInstance;
  }

  protected set connection(instance: IDeviceConnection) {
    this.connectionInstance = instance;
  }

  public async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;

    if (this.connectToDevice) {
      this.connection = await createConnection();
    }
  }

  protected async catch(err: Error & { exitCode?: number }): Promise<any> {
    if ((err as any)?.toJSON) {
      console.log((err as any).toJSON());
    } else {
      console.log(err);
    }
    return super.catch(err);
  }

  protected async finally(_: Error | undefined): Promise<any> {
    await cleanUpDeviceConnection();
    return super.finally(_);
  }
}