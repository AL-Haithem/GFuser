export function createStartupSteps() {
  return [
    { id: 'data', label: 'Checking local data', status: 'loading' },
    { id: 'version', label: 'Checking installed version', status: 'loading' },
    { id: 'updates', label: 'Initializing update service', status: 'loading' },
  ];
}

export function getStartupProgress(steps) {
  const finishedSteps = steps.filter((step) => step.status === 'complete' || step.status === 'error').length;
  return Math.round((finishedSteps / steps.length) * 100);
}
