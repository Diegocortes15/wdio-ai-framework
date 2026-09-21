// Qase configuration. Absence is the normal "TCMS off" state, never an error:
// locally nothing is set, and the sync skips itself.
export interface QaseConfig {
  apiToken: string;
  projectCode: string;
  apiHost: string;
}

export function qaseConfig(): QaseConfig | null {
  const apiToken = process.env.QASE_API_TOKEN?.trim();
  const projectCode = process.env.QASE_PROJECT_CODE?.trim();
  if (!apiToken || !projectCode) return null;
  return {
    apiToken,
    projectCode,
    apiHost: process.env.QASE_API_HOST?.trim() || 'https://api.qase.io/v1',
  };
}
