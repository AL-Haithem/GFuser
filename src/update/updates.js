export const updateStatusLabels = {
  idle: 'Not checked',
  checking: 'Checking',
  available: 'Update available',
  downloading: 'Downloading',
  downloaded: 'Ready to install',
  'up-to-date': 'Up to date',
  error: 'Check failed',
};

export function getUpdateStatusLabel(status) {
  return updateStatusLabels[status] ?? 'Update status';
}
