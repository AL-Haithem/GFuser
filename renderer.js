const statusBox = document.getElementById('status');
const outputBox = document.getElementById('output');
const runButton = document.getElementById('run-merged');

function setStatus(message, type = 'info') {
  statusBox.textContent = message;
  statusBox.className = `status-box ${type}`;
}

async function runMergedProject() {
  setStatus('Running full pipeline...', 'pending');
  outputBox.textContent = 'Starting merged map pipeline...\n';

  try {
    const result = await window.appAPI.runMergedProject();
    outputBox.textContent = result;
    setStatus('Merged pipeline completed successfully.', 'success');
  } catch (error) {
    outputBox.textContent = error && error.message ? error.message : String(error);
    setStatus('Merged pipeline failed.', 'error');
  }
}

runButton.addEventListener('click', runMergedProject);
