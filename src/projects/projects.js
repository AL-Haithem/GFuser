export function makeProject(name) {
  return {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: name.trim(),
    createdAt: 'Just now',
    status: 'Ready',
    files: [],
  };
}

export function saveProjects(projects) {
  if (!window.appAPI?.saveProjects) return Promise.resolve();
  return window.appAPI.saveProjects(projects);
}
