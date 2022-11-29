export default function getValue<T = unknown>(
  strName: string,
  context: Record<string, T | unknown>
): T | unknown {
  const names = strName.split('.');
  let value: unknown = context;
  while (names.length) {
    const lookup = names.shift();
    if (!lookup) break;

    value = (value as Record<string, T | unknown>)[lookup];
  }
  return value;
}
