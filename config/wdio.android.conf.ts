import { androidCapability } from './capabilities/android';
import { sharedConfig } from './wdio.shared.conf';

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  capabilities: [androidCapability],
};
