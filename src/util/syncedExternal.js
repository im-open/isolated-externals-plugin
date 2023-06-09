// eslint-globals THE_PROMISE

let theResult;
const loadPromise = async (promiseFunc) => {
  theResult = await promiseFunc();
};

const tenSeconds = 1000 * 10;

const syncedResult = () => {
  const startTime = Date.now();
  while (!theResult && Date.now() - startTime < tenSeconds) {
    // wait for the result for up to 10 seconds
  }
  return theResult;
};

loadPromise(() => THE_PROMISE);
const result = syncedResult();
exports = result;
