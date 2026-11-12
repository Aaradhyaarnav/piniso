/* Runs before the Piniso app on the Study Anything page: give this study session its own key. */
const d = new Date();
globalThis.PINISO_KEY_OVERRIDE = 'screen:' + d.toISOString().slice(0, 16).replace(/[-:T]/g, '');
