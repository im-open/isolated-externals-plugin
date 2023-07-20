export default function getValue<T>(
  strName: string,
  context: Record<string, T>
): T {
  const names = strName.split('.');
  let value: unknown = context;
  while (names.length) {
    const lookup = names.shift();
    if (!lookup) break;

    value = (value as Record<string, T>)[lookup];
  }
  return value as T;
}
