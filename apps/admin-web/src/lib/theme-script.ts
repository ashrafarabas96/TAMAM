import { THEME_STORAGE_KEY } from './env';

/**
 * Inline script executed before hydration so the first paint already uses the stored theme.
 * Lives outside the client `theme.tsx` module so the server layout can embed the string.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;
