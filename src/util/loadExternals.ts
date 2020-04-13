interface ExternalInfo {
  name: string;
  url: string;
  loaded?: boolean;
}

interface Externals {
  [key: string]: ExternalInfo;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function wrappedEval(content: string): any {
  return eval(content);
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function loadExternals(
  externalsObj: Externals,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  onComplete: (context: any) => void
): void {
  const context = {};
  const externalKeys = Object.keys(externalsObj);
  const contentLoaded = (key: string, content: string): void => {
    externalsObj[key].loaded = true;
    wrappedEval.call(context, content);

    const finished = externalKeys.every(key => externalsObj[key].loaded);

    if (finished) {
      onComplete(context);
    }
  };
  externalKeys.forEach(key => {
    const request = new XMLHttpRequest();
    request.addEventListener('load', function() {
      contentLoaded(key, this.responseText);
    });
    request.open('GET', externalsObj[key].url);
    request.send();
  });
}
