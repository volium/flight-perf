/**
 * Fleet management UI.
 *
 * Provides the fleet overlay panel (list, add, edit, delete aircraft)
 * and the header fleet selector dropdown.
 *
 * @module ui/fleet
 */

import { getAllTypes, getAllInstances, putInstance, deleteInstance, getInstance } from '../data/db.js';
import { mergeProfile } from '../data/profile-merger.js';
import { storage } from '../data/storage.js';
import { setActiveAircraft, getProfile, initCalculators } from '../app.js';

/**
 * Initialize the fleet selector in the header and the fleet management panel.
 *
 * @param {HTMLSelectElement} selectorEl — the header <select> element
 * @param {HTMLElement} overlayEl — the fleet overlay container
 * @param {HTMLElement} panelEl — the fleet panel inside the overlay
 */
export async function initFleet(selectorEl, overlayEl, panelEl) {
  if (!selectorEl || !overlayEl || !panelEl) return;

  const closeBtn = panelEl.querySelector('.fleet-panel__close');

  function open() {
    renderFleetList(panelEl);
    overlayEl.setAttribute('aria-hidden', 'false');
  }

  function close() {
    overlayEl.setAttribute('aria-hidden', 'true');
  }

  closeBtn?.addEventListener('click', close);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlayEl.getAttribute('aria-hidden') === 'false') {
      close();
    }
  });

  // Header selector change handler
  selectorEl.addEventListener('change', async () => {
    const value = selectorEl.value;
    if (value === '_manage') {
      // Revert to current active aircraft
      const activeId = storage.get('activeAircraftId', null);
      selectorEl.value = activeId || '';
      open();
      return;
    }
    if (value) {
      await setActiveAircraft(value);
    }
  });

  await refreshFleetSelector(selectorEl);
}

/**
 * Refresh the header fleet selector <select> with current fleet data.
 */
export async function refreshFleetSelector(selectorEl) {
  if (!selectorEl) {
    selectorEl = document.getElementById('fleet-selector');
  }
  if (!selectorEl) return;

  const instances = await getAllInstances();
  const types = await getAllTypes();
  const typeMap = Object.fromEntries(types.map((t) => [t.typeId, t]));
  const activeId = storage.get('activeAircraftId', null);

  selectorEl.innerHTML = '';

  if (instances.length === 0) {
    const opt = document.createElement('option');
    opt.value = '_manage';
    opt.textContent = '✦ Add your aircraft…';
    selectorEl.appendChild(opt);
    return;
  }

  for (const inst of instances) {
    const typeName = typeMap[inst.typeId]?.aircraft?.name || inst.typeId;
    const label = inst.registration
      ? `${inst.registration} — ${typeName}`
      : `${inst.displayName || typeName}`;

    const opt = document.createElement('option');
    opt.value = inst.instanceId;
    opt.textContent = label;
    if (inst.instanceId === activeId) opt.selected = true;
    selectorEl.appendChild(opt);
  }

  // "Manage Fleet…" option
  const manageOpt = document.createElement('option');
  manageOpt.value = '_manage';
  manageOpt.textContent = '✦ Manage Fleet…';
  selectorEl.appendChild(manageOpt);
}

// ─── Fleet panel rendering ──────────────────────────────────────────────────

async function renderFleetList(panelEl) {
  const listEl = panelEl.querySelector('.fleet-list');
  if (!listEl) return;

  const instances = await getAllInstances();
  const types = await getAllTypes();
  const typeMap = Object.fromEntries(types.map((t) => [t.typeId, t]));
  const activeId = storage.get('activeAircraftId', null);

  listEl.innerHTML = '';

  if (instances.length === 0) {
    listEl.innerHTML = '<p class="fleet-empty">No aircraft in your fleet yet. Add one below.</p>';
  } else {
    for (const inst of instances) {
      const type = typeMap[inst.typeId];
      const card = buildAircraftCard(inst, type, inst.instanceId === activeId, panelEl);
      listEl.appendChild(card);
    }
  }

  // "Add Aircraft" button
  const addBtn = panelEl.querySelector('.fleet-add-btn');
  if (addBtn) {
    addBtn.onclick = () => showAddForm(panelEl);
  }
}

function buildAircraftCard(instance, type, isActive, panelEl) {
  const card = document.createElement('div');
  card.className = 'fleet-card' + (isActive ? ' fleet-card--active' : '');

  const typeName = type?.aircraft?.name || instance.typeId;
  const reg = instance.registration || '(no registration)';
  const ew = instance.emptyWeight
    ? `${instance.emptyWeight.value} ${instance.emptyWeight.unit}`
    : 'POH reference';

  card.innerHTML = `
    <div class="fleet-card__info">
      <div class="fleet-card__reg">${esc(reg)}</div>
      <div class="fleet-card__type">${esc(typeName)}</div>
      <div class="fleet-card__detail">Empty weight: ${esc(ew)}</div>
      ${instance.notes ? `<div class="fleet-card__notes">${esc(instance.notes)}</div>` : ''}
    </div>
    <div class="fleet-card__actions">
      ${isActive ? '<span class="fleet-card__badge">Active</span>' : `<button class="btn btn-sm" data-action="select">Select</button>`}
      <button class="btn btn-sm" data-action="edit">Edit</button>
      <button class="btn btn-sm btn-danger" data-action="delete">Delete</button>
    </div>
  `;

  card.querySelector('[data-action="select"]')?.addEventListener('click', async () => {
    await setActiveAircraft(instance.instanceId);
    await refreshFleetSelector();
    renderFleetList(panelEl);
  });

  card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
    showEditForm(panelEl, instance);
  });

  card.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
    if (!confirm(`Remove ${reg} from your fleet?`)) return;
    await deleteInstance(instance.instanceId);

    // If we deleted the active aircraft, switch to another
    const activeId = storage.get('activeAircraftId', null);
    if (activeId === instance.instanceId) {
      const remaining = await getAllInstances();
      if (remaining.length > 0) {
        await setActiveAircraft(remaining[0].instanceId);
      } else {
        storage.remove('activeAircraftId');
        initCalculators();
      }
    }

    await refreshFleetSelector();
    renderFleetList(panelEl);
  });

  return card;
}

// ─── Add / Edit forms ───────────────────────────────────────────────────────

async function showAddForm(panelEl) {
  const formArea = panelEl.querySelector('.fleet-form-area');
  if (!formArea) return;

  const types = await getAllTypes();

  formArea.innerHTML = `
    <h3 class="fleet-form__title">Add Aircraft</h3>
    <div class="form-group">
      <label class="form-label" for="fleet-type">Aircraft Type</label>
      <select class="form-input" id="fleet-type">
        ${types.map((t) => `<option value="${esc(t.typeId)}">${esc(t.aircraft?.name || t.typeId)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-reg">Registration (Tail Number)</label>
      <input class="form-input" id="fleet-reg" type="text" placeholder="e.g. N246LT" autocomplete="off">
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-ew">Empty Weight <span class="form-label--optional">(from weigh report)</span></label>
      <div class="form-row">
        <input class="form-input" id="fleet-ew" type="number" step="any" placeholder="POH default">
        <select class="form-input form-input--unit" id="fleet-ew-unit">
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-cg">Empty CG <span class="form-label--optional">(from weigh report)</span></label>
      <div class="form-row">
        <input class="form-input" id="fleet-cg" type="number" step="any" placeholder="POH default">
        <select class="form-input form-input--unit" id="fleet-cg-unit">
          <option value="in">in</option>
          <option value="mm">mm</option>
          <option value="percent_mac">% MAC</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-notes">Notes <span class="form-label--optional">(optional)</span></label>
      <input class="form-input" id="fleet-notes" type="text" placeholder="e.g. Annual due March 2026">
    </div>
    <div class="fleet-form__buttons">
      <button class="btn" id="fleet-save">Add to Fleet</button>
      <button class="btn btn-secondary" id="fleet-cancel">Cancel</button>
    </div>
  `;

  // Pre-fill empty weight from selected type
  const typeSelect = formArea.querySelector('#fleet-type');
  prefillFromType(formArea, types, typeSelect.value);
  typeSelect.addEventListener('change', () => prefillFromType(formArea, types, typeSelect.value));

  formArea.querySelector('#fleet-save').addEventListener('click', async () => {
    const instance = buildInstanceFromForm(formArea);
    if (!instance) return;
    await putInstance(instance);
    await setActiveAircraft(instance.instanceId);
    await refreshFleetSelector();
    formArea.innerHTML = '';
    renderFleetList(panelEl);
  });

  formArea.querySelector('#fleet-cancel').addEventListener('click', () => {
    formArea.innerHTML = '';
  });
}

async function showEditForm(panelEl, existing) {
  const formArea = panelEl.querySelector('.fleet-form-area');
  if (!formArea) return;

  const types = await getAllTypes();

  formArea.innerHTML = `
    <h3 class="fleet-form__title">Edit Aircraft</h3>
    <div class="form-group">
      <label class="form-label" for="fleet-type">Aircraft Type</label>
      <select class="form-input" id="fleet-type">
        ${types.map((t) => `<option value="${esc(t.typeId)}" ${t.typeId === existing.typeId ? 'selected' : ''}>${esc(t.aircraft?.name || t.typeId)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-reg">Registration (Tail Number)</label>
      <input class="form-input" id="fleet-reg" type="text" value="${esc(existing.registration || '')}" autocomplete="off">
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-ew">Empty Weight</label>
      <div class="form-row">
        <input class="form-input" id="fleet-ew" type="number" step="any" value="${existing.emptyWeight?.value ?? ''}">
        <select class="form-input form-input--unit" id="fleet-ew-unit">
          <option value="lbs" ${existing.emptyWeight?.unit === 'lbs' ? 'selected' : ''}>lbs</option>
          <option value="kg" ${existing.emptyWeight?.unit === 'kg' ? 'selected' : ''}>kg</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-cg">Empty CG</label>
      <div class="form-row">
        <input class="form-input" id="fleet-cg" type="number" step="any" value="${getCGValue(existing.emptyCG)}">
        <select class="form-input form-input--unit" id="fleet-cg-unit">
          <option value="in" ${existing.emptyCG?.unit === 'in' ? 'selected' : ''}>in</option>
          <option value="mm" ${existing.emptyCG?.unit === 'mm' ? 'selected' : ''}>mm</option>
          <option value="percent_mac" ${existing.emptyCG?.unit === 'percent_mac' ? 'selected' : ''}>% MAC</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-notes">Notes</label>
      <input class="form-input" id="fleet-notes" type="text" value="${esc(existing.notes || '')}">
    </div>
    <div class="fleet-form__buttons">
      <button class="btn" id="fleet-save">Save Changes</button>
      <button class="btn btn-secondary" id="fleet-cancel">Cancel</button>
    </div>
  `;

  formArea.querySelector('#fleet-save').addEventListener('click', async () => {
    const updated = buildInstanceFromForm(formArea, existing);
    if (!updated) return;
    await putInstance(updated);

    // Re-merge if this is the active aircraft
    const activeId = storage.get('activeAircraftId', null);
    if (activeId === updated.instanceId) {
      await setActiveAircraft(updated.instanceId);
    }

    await refreshFleetSelector();
    formArea.innerHTML = '';
    renderFleetList(panelEl);
  });

  formArea.querySelector('#fleet-cancel').addEventListener('click', () => {
    formArea.innerHTML = '';
  });
}

// ─── Form helpers ───────────────────────────────────────────────────────────

function prefillFromType(formArea, types, typeId) {
  const type = types.find((t) => t.typeId === typeId);
  if (!type) return;

  const ewInput = formArea.querySelector('#fleet-ew');
  const ewUnit = formArea.querySelector('#fleet-ew-unit');
  const cgInput = formArea.querySelector('#fleet-cg');
  const cgUnit = formArea.querySelector('#fleet-cg-unit');

  const refEW = type.limits?.referenceEmptyWeight || type.limits?.emptyWeight;
  if (refEW && ewInput && !ewInput.value) {
    ewInput.placeholder = `${refEW.value} (POH)`;
    if (ewUnit) ewUnit.value = refEW.unit;
  }

  const refCG = type.limits?.referenceEmptyCG || type.weightBalance?.emptyCG;
  if (refCG && cgInput && !cgInput.value) {
    const val = refCG.value ?? refCG.arm;
    cgInput.placeholder = `${val} (POH)`;
    if (cgUnit) cgUnit.value = refCG.unit;
  }
}

function buildInstanceFromForm(formArea, existing) {
  const typeId = formArea.querySelector('#fleet-type')?.value;
  const reg = formArea.querySelector('#fleet-reg')?.value?.trim() || '';
  const ewVal = parseFloat(formArea.querySelector('#fleet-ew')?.value);
  const ewUnit = formArea.querySelector('#fleet-ew-unit')?.value || 'lbs';
  const cgVal = parseFloat(formArea.querySelector('#fleet-cg')?.value);
  const cgUnit = formArea.querySelector('#fleet-cg-unit')?.value || 'in';
  const notes = formArea.querySelector('#fleet-notes')?.value?.trim() || '';

  if (!typeId) return null;

  const now = new Date().toISOString();

  return {
    instanceId: existing?.instanceId || generateId(),
    typeId,
    registration: reg,
    displayName: reg || existing?.displayName || '',
    emptyWeight: !isNaN(ewVal) ? { value: ewVal, unit: ewUnit } : (existing?.emptyWeight || null),
    emptyCG: !isNaN(cgVal) ? buildCGObject(cgVal, cgUnit) : (existing?.emptyCG || null),
    notes,
    lastWeighed: existing?.lastWeighed || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function buildCGObject(value, unit) {
  if (unit === 'percent_mac') return { value, unit };
  return { arm: value, unit };
}

function getCGValue(cg) {
  if (!cg) return '';
  return cg.value ?? cg.arm ?? '';
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
