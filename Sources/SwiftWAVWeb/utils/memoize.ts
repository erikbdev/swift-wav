export function memoize<T>(fn: () => T) {
  let value: T | null = null;
  let set = false;
  return Object.assign(
    () => {
      if (!set) {
        const result = fn();
        if (result instanceof Promise) {
          value = result.catch((e) => {
            set = false;
            value = null;
            throw e;
          }) as T;
        } else {
          value = result;
        }
        set = true;
      }
      return value as T;
    },
    {
      discard() {
        value = null;
        set = false;
        return;
      },
    },
  );
}
