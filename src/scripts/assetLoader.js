/**
 * Lets plain node import `render.js`.
 *
 * `render.js` imports the maize sprite as a URL, which Vite understands and
 * node does not — it refuses the file with ERR_UNKNOWN_FILE_EXTENSION before
 * any of the drawing code loads. This stubs the specifier out; `shots.js` then
 * pushes the real decoded image in through `setMaizeImage`.
 *
 * Used as `node --import ./src/scripts/assetLoader.js ...`.
 */
import { registerHooks } from 'node:module'

registerHooks({
  load(url, context, next) {
    if (url.endsWith('.png')) {
      return { format: 'module', shortCircuit: true, source: 'export default ""' }
    }
    return next(url, context)
  },
})
