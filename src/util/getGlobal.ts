export default function getGlobal(): typeof global {
  try {
    return globalThis?.window || globalThis;
  } catch {
    try {
      return window;
    } catch {
      try {
        return global;
      } catch {
        return self;
      }
    }
  }
}
