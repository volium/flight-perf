export function initTabs(tabBarEl, panelContainerEl) {
  const tabs = Array.from(tabBarEl.querySelectorAll('[role="tab"]'));
  const panels = Array.from(
    panelContainerEl.querySelectorAll('[role="tabpanel"]'),
  );

  function activateTab(tabId) {
    tabs.forEach((tab) => {
      const selected = tab.dataset.tab === tabId;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      const visible = panel.id === `panel-${tabId}`;
      panel.setAttribute('aria-hidden', String(!visible));
    });

    window.location.hash = tabId;
  }

  tabBarEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab) return;
    activateTab(tab.dataset.tab);
  });

  tabBarEl.addEventListener('keydown', (e) => {
    const current = tabs.findIndex(
      (t) => t.getAttribute('aria-selected') === 'true',
    );
    let next = current;

    if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft')
      next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;

    e.preventDefault();
    tabs[next].focus();
    activateTab(tabs[next].dataset.tab);
  });

  // Activate tab from URL hash or default to first
  const hash = window.location.hash.slice(1);
  const initialTab =
    tabs.find((t) => t.dataset.tab === hash)?.dataset.tab ||
    tabs[0]?.dataset.tab;

  if (initialTab) activateTab(initialTab);

  return { activateTab };
}
