import { iosCapability } from './capabilities/ios';
import { sharedConfig } from './wdio.shared.conf';

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  capabilities: [iosCapability],
};
