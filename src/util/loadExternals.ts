interface ExternalInfo {
  name: string;
  url: string;
}

interface Externals {
  [key: string]: ExternalInfo;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function wrappedEval(content: string): any {
  return eval(content);
}

function loadExternal(
  external: ExternalInfo,
  onLoaded: (responseText: string) => void
): void {
  const request = new XMLHttpRequest();
  const loadedFunction = function(this: XMLHttpRequest): void {
    onLoaded(this.responseText);
    request.removeEventListener('load', loadedFunction);
  };
  request.addEventListener('load', loadedFunction);
  request.open('GET', external.url);
  request.send();
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function loadExternals(
  externalsObj: Externals,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  onComplete: (context: any) => void
): void {
  const context = {};
  const externalKeys = Object.keys(externalsObj);

  const load = (index: number): void => {
    const key = externalKeys[index];
    loadExternal(externalsObj[key], (content: string) => {
      wrappedEval.call(context, content);

      const nextIndex = index + 1;
      if (nextIndex === externalKeys.length) {
        onComplete(context);
      } else {
        load(nextIndex);
      }
    });
  };
  load(0);
}
