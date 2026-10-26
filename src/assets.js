import { h } from './app.js';
import logoIcon from './Logo/MOOPRESS Color Logo.png';
import logoWordmark from './Logo/MOOPRESS Color Logo with Text.png';

export { logoIcon, logoWordmark };

export function logoLockup(cls = '') {
  return h(`div.logo-lockup${cls ? `.${cls}` : ''}`, {}, h('img.logo-img', { src: logoIcon, alt: '' }), h('span', {}, 'MooPress'));
}
