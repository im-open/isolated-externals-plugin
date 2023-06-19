type Maybe<T> = T | undefined | null;

export default function getRequestParam(
  request: string,
  param: string
): Maybe<string> {
  const entryUrl = new URL('https://www.example.com/' + request);
  const value = entryUrl.searchParams.get(param);
  return value;
}
