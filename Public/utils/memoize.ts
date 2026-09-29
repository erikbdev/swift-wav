
export function memoize<T>(fn: () => T | Promise<T>) {
  let state: { id: number, value: T | Promise<T> } | null = null;
  return Object.assign(
    () => {
      if (state) return state.value;

      const id = Date.now()
      const value = fn();
      if (value instanceof Promise) {
        state = {
          id,
          value: value.catch((e) => {
            if (id == state?.id) {
              state = null;
            }
            throw e;
          })
        };
      } else {
        state = { id, value }
      }
      return state.value
    },
    {
      discard() {
        state = null;
        return;
      },
    },
  );
}
