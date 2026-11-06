// A completion token only; the caller continues to own semantic selection.
export function createPickGeneration() {
  let revision = 0, disposed = false;
  return {
    invalidate() { revision++; },
    dispose() { disposed = true; revision++; },
    async run(request, commit) {
      const token = ++revision;
      let result;
      try { result = await request(); }
      catch (error) {
        // Disposed picker buffers may reject; only obsolete requests are cancelled.
        if (disposed || token !== revision) return false;
        throw error;
      }
      if (disposed || token !== revision) return false;
      commit(result);
      return true;
    },
  };
}
