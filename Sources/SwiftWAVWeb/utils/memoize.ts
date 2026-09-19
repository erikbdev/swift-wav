function memoize<T>(create: () => T): { value: T; discard(): void } {
  let value: T | null = null;
  let set = false;
  return {
    get value() {
      if (!set) {
        value = create();
        set = true;
      }
      return value as T;
    },
    discard() {
      value = null;
      set = false;
      return;
    },
  };
}
