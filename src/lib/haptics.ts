// Light haptic tap. Safari has no navigator.vibrate, but since iOS 18 toggling an
// <input type="checkbox" switch> plays the system haptic, and clicking its label works too.
// Must be called from a user gesture. Fails silently everywhere else.

let label: HTMLLabelElement | null = null;

function hapticLabel(): HTMLLabelElement {
  if (label) return label;
  const id = 'haptic-switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.tabIndex = -1;
  input.setAttribute('switch', '');
  input.setAttribute('aria-hidden', 'true');
  const el = document.createElement('label');
  el.htmlFor = id;
  el.setAttribute('aria-hidden', 'true');
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
  wrap.append(input, el);
  document.body.append(wrap);
  label = el;
  return el;
}

export function haptic() {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
      return;
    }
    hapticLabel().click();
  } catch {
    // unsupported
  }
}
