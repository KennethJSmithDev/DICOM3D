export function createSingleFlightRendererFactory(initialize) {
  const pending = new WeakMap();
  return props => {
    const canvas = props.canvas;
    if (pending.has(canvas)) return pending.get(canvas);
    const promise = Promise.resolve().then(() => initialize(props)).then(renderer => {
      const dispose = renderer.dispose.bind(renderer);
      renderer.dispose = () => {
        if (pending.get(canvas) === promise) pending.delete(canvas);
        return dispose();
      };
      return renderer;
    }).catch(error => {
      if (pending.get(canvas) === promise) pending.delete(canvas);
      throw error;
    });
    pending.set(canvas, promise);
    return promise;
  };
}
