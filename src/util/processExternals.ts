import { CachedExternal } from './externalsClasses';

/* eslint-disable @typescript-eslint/no-implied-eval */
function applyExternal(
  content: string,
  context: Record<string, unknown>
): unknown {
  // in case of a self-invoking wrapper, make sure self is defined
  // as our context object.
  return Function(`
var self=this;
var globalThis = this;
${content}`).call(context);
}
/* eslint-enable @typescript-eslint/no-implied-eval */

export async function processExternal(
  context: Record<string, unknown>,
  cachedExternal: CachedExternal
): Promise<Record<string, unknown>> {
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
  const { failed, url, error } = cachedExternal;

  if (failed) {
    console.error(
      `EXTERNAL LOAD FAILED: failed to load external from '${url}'`,
      error
    );
    return context;
  }

  try {
    const content = await cachedExternal.getContent();
    applyExternal(content || '', context);
  } catch (e) {
    console.error(
      `EXTERNAL PROCESS FAILED: failed to process external from ${url}`,
      e
    );
  }
  return context;
}
