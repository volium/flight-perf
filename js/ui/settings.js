import { storage } from '../data/storage.js';

export function initSettings(triggerBtn, overlayEl, panelEl) {
  const closeBtn = panelEl.querySelector('.settings-panel__close');

  function open() {
    overlayEl.setAttribute('aria-hidden', 'false');
    panelEl.querySelector('select, input, button')?.focus();
  }

  function close() {
    overlayEl.setAttribute('aria-hidden', 'true');
    triggerBtn.focus();
  }

  triggerBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) close();
  });

  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'Escape' &&
      overlayEl.getAttribute('aria-hidden') === 'false'
    ) {
      close();
    }
  });

  initThemeToggle(panelEl);

  return { open, close };
}

function initThemeToggle(panelEl) {
  const select = panelEl.querySelector('#setting-theme');
  if (!select) return;

  const saved = storage.get('theme', 'auto');
  select.value = saved;
  applyTheme(saved);

  select.addEventListener('change', () => {
    const value = select.value;
    storage.set('theme', value);
    applyTheme(value);
  });
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
