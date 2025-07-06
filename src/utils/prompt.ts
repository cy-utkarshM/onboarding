import input from '@inquirer/input';

export const queryInput = async (message: string, defaultMessage?: string) =>
  input({ message, default: defaultMessage });