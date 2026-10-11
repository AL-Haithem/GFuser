export const logger = {
  info(message) {
    console.log(message);
  },
  success(message) {
    console.log(`✓ ${message}`);
  },
  warn(message) {
    console.warn(`! ${message}`);
  },
  error(message) {
    console.error(`✗ ${message}`);
  },
  step(stepNumber, total, message) {
    console.log(`[${stepNumber}/${total}] ${message}`);
  },
};
