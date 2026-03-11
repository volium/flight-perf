/**
 * Fleet management UI.
 *
 * Provides the fleet overlay panel (list, add, edit, delete aircraft)
 * and the header fleet selector dropdown.
 *
 * Design principle for instance data:
 *   - Store ONLY what the user explicitly entered
 *   - null = "not specified, use type's POH reference default"
 *   - Empty string = "user saw the field, left it blank" (text fields)
 *   - The display layer looks up type reference values when instance values are null
 *   - The merger falls back to type references for null weight/CG
 *
 * @module ui/fleet
 */

import { getAllTypes, getAllInstances, putInstance, deleteInstance, getType } from '../data/db.js';
import { storage } from '../data/storage.js';
import { setActiveAircraft, initCalculators } from '../app.js';

/**
 * Initialize the fleet selector in the header and the fleet management panel.
 */
export async function initFleet(selectorEl, overlayEl, panelEl) {
  if (!selectorEl || !overlayEl || !panelEl) return { open() {} };

  const closeBtn = panelEl.querySelector('.fleet-panel__close');
  let returnToSettings = null;

  function open(onClose) {
    returnToSettings = onClose || null;
    renderFleetList(panelEl);
    overlayEl.setAttribute('aria-hidden', 'false');
  }

  function close() {
    overlayEl.setAttribute('aria-hidden', 'true');
    if (returnToSettings) {
      returnToSettings();
      returnToSettings = null;
    }
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

  const addBtn = panelEl.querySelector('.fleet-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => showAddForm(panelEl));
  }

  selectorEl.addEventListener('change', async () => {
    const value = selectorEl.value;
    if (value === '_manage') {
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

  return { open, close };
}

/**
 * Refresh the header fleet selector with current fleet data.
 */
export async function refreshFleetSelector(selectorEl) {
  if (!selectorEl) selectorEl = document.getElementById('fleet-selector');
  if (!selectorEl) return;

  const allInstances = await getAllInstances();
  const types = await getAllTypes();
  const typeMap = Object.fromEntries(types.map((t) => [t.typeId, t]));
  const activeId = storage.get('activeAircraftId', null);

  const instances = allInstances.sort((a, b) => {
    if (a.instanceId === activeId) return -1;
    if (b.instanceId === activeId) return 1;
    return (a.registration || '').localeCompare(b.registration || '');
  });

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

  const manageOpt = document.createElement('option');
  manageOpt.value = '_manage';
  manageOpt.textContent = '✦ Manage Fleet…';
  selectorEl.appendChild(manageOpt);
}

// ─── Fleet panel rendering ──────────────────────────────────────────────────

async function renderFleetList(panelEl) {
  const listEl = panelEl.querySelector('.fleet-list');
  if (!listEl) return;

  const allInstances = await getAllInstances();
  const types = await getAllTypes();
  const typeMap = Object.fromEntries(types.map((t) => [t.typeId, t]));
  const activeId = storage.get('activeAircraftId', null);

  const instances = allInstances.sort((a, b) => {
    if (a.instanceId === activeId) return -1;
    if (b.instanceId === activeId) return 1;
    return (a.registration || '').localeCompare(b.registration || '');
  });

  listEl.innerHTML = '';

  if (instances.length === 0) {
    listEl.innerHTML = '<p class="fleet-empty">No aircraft in your fleet yet.</p>';
  } else {
    for (const inst of instances) {
      const type = typeMap[inst.typeId];
      const card = buildAircraftCard(inst, type, inst.instanceId === activeId, panelEl);
      listEl.appendChild(card);
    }
  }
}

/**
 * Format an instance field for display in the fleet card.
 * Shows the user-entered value, or the type's reference value with "(POH reference)" tag,
 * or "Not specified" if neither exists.
 *
 * @param {any} instanceValue — the instance's value (null if not user-specified)
 * @param {any} referenceValue — the type's POH reference value
 * @param {function} formatter — formats a value for display (receives the value object)
 * @returns {string} HTML string
 */
function displayField(instanceValue, referenceValue, formatter) {
  if (instanceValue != null) {
    return formatter(instanceValue);
  }
  if (referenceValue != null) {
    return `${formatter(referenceValue)} <span class="fleet-card__ref">(POH reference)</span>`;
  }
  return '<span class="fleet-card__ref">Not specified</span>';
}

function buildAircraftCard(instance, type, isActive, panelEl) {
  const card = document.createElement('div');
  card.className = 'fleet-card' + (isActive ? ' fleet-card--active' : '');

  const typeName = type?.aircraft?.name || instance.typeId;
  const reg = instance.registration || '(no registration)';

  const refEW = type?.limits?.referenceEmptyWeight || type?.limits?.emptyWeight;
  const ewDisplay = displayField(
    instance.emptyWeight,
    refEW,
    (v) => `${v.value} ${v.unit}`,
  );

  card.innerHTML = `
    <div class="fleet-card__info">
      <div class="fleet-card__reg">${esc(reg)}</div>
      <div class="fleet-card__type">${esc(typeName)}</div>
      <div class="fleet-card__detail">Empty weight: ${ewDisplay}</div>
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
//
// Both forms share the same structure. The only difference:
//   Add:  all fields start blank, placeholders from type reference
//   Edit: user-entered fields pre-populated, null fields blank with placeholders
//
// buildInstanceFromForm handles both: user entered value → store it, blank → null.
// No special tags, no source tracking. null means "use POH default."

async function showAddForm(panelEl) {
  const formArea = panelEl.querySelector('.fleet-form-area');
  if (!formArea) return;

  const listEl = panelEl.querySelector('.fleet-list');
  const addBtn = panelEl.querySelector('.fleet-add-btn');
  if (listEl) listEl.style.display = 'none';
  if (addBtn) addBtn.style.display = 'none';

  const types = await getAllTypes();

  renderForm(formArea, types, {
    title: 'Add Aircraft',
    saveLabel: 'Add to Fleet',
    instance: null,
  });

    formArea.querySelector('#fleet-save').addEventListener('click', async () => {
      const selectedType = getSelectedType(formArea, types);
      const instance = buildInstanceFromForm(formArea, null);
      if (!instance) return;
      await putInstance(instance);
      await setActiveAircraft(instance.instanceId);
      await refreshFleetSelector();
      formArea.innerHTML = '';
      if (listEl) listEl.style.display = '';
      if (addBtn) addBtn.style.display = '';
      renderFleetList(panelEl);
    });

    formArea.querySelector('#fleet-cancel').addEventListener('click', () => {
      formArea.innerHTML = '';
      if (listEl) listEl.style.display = '';
      if (addBtn) addBtn.style.display = '';
    });
  }

async function showEditForm(panelEl, existing) {
  const formArea = panelEl.querySelector('.fleet-form-area');
  if (!formArea) return;

  const listEl = panelEl.querySelector('.fleet-list');
  const addBtn = panelEl.querySelector('.fleet-add-btn');
  if (listEl) listEl.style.display = 'none';
  if (addBtn) addBtn.style.display = 'none';

  const types = await getAllTypes();

  renderForm(formArea, types, {
    title: 'Edit Aircraft',
    saveLabel: 'Save Changes',
    instance: existing,
  });

  formArea.querySelector('#fleet-save').addEventListener('click', async () => {
    const updated = buildInstanceFromForm(formArea, existing);
    if (!updated) return;
    await putInstance(updated);

    const activeId = storage.get('activeAircraftId', null);
    if (activeId === updated.instanceId) {
      await setActiveAircraft(updated.instanceId);
    }

    await refreshFleetSelector();
    formArea.innerHTML = '';
    if (listEl) listEl.style.display = '';
    if (addBtn) addBtn.style.display = '';
    renderFleetList(panelEl);
  });

  formArea.querySelector('#fleet-cancel').addEventListener('click', () => {
    formArea.innerHTML = '';
    if (listEl) listEl.style.display = '';
    if (addBtn) addBtn.style.display = '';
  });
}

/**
 * Render the add/edit form. Shared between both flows.
 * - If instance is null (add): all fields blank
 * - If instance is provided (edit): user-entered fields pre-populated, null fields blank
 * - In both cases, placeholders show POH reference values from the type
 */
function renderForm(formArea, types, { title, saveLabel, instance }) {
  const selectedTypeId = instance?.typeId || types[0]?.typeId || '';
  const selectedType = types.find((t) => t.typeId === selectedTypeId);

  // Determine units from the type profile
  const typeWeightUnit = selectedType?.weightBalance?.weightUnit || 'kg';
  const typeCGUnit = selectedType?.weightBalance?.cgUnit || 'in';
  const typeCGLabel = typeCGUnit === '%' ? '% MAC' : typeCGUnit;

  // For edit: only show user-entered values (not null = not user-specified)
  const regValue = instance?.registration || '';
  const ewValue = instance?.emptyWeight?.value ?? '';
  const cgValue = instance?.emptyCG != null ? (instance.emptyCG.value ?? instance.emptyCG.arm ?? '') : '';
  const ewUnitValue = instance?.emptyWeight?.unit || typeWeightUnit;
  const notesValue = instance?.notes || '';

  formArea.innerHTML = `
    <h3 class="fleet-form__title">${esc(title)}</h3>
    <div class="form-group">
      <label class="form-label" for="fleet-type">Aircraft Type</label>
      <select class="form-input" id="fleet-type">
        ${types.map((t) => `<option value="${esc(t.typeId)}" ${t.typeId === selectedTypeId ? 'selected' : ''}>${esc(t.aircraft?.name || t.typeId)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-reg">Registration (Tail Number)</label>
      <input class="form-input" id="fleet-reg" type="text" value="${esc(regValue)}" placeholder="e.g. N246LT" autocomplete="off">
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-ew">Empty Weight <span class="form-label--optional">(from weigh report)</span></label>
      <div class="form-row">
        <input class="form-input" id="fleet-ew" type="number" step="any" value="${ewValue}">
        <select class="form-input form-input--unit" id="fleet-ew-unit">
          <option value="lbs" ${ewUnitValue === 'lbs' ? 'selected' : ''}>lbs</option>
          <option value="kg" ${ewUnitValue === 'kg' ? 'selected' : ''}>kg</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-cg">Empty CG <span class="form-label--optional">(from weigh report)</span></label>
      <div class="form-row">
        <input class="form-input" id="fleet-cg" type="number" step="any" value="${cgValue}">
        <span class="form-input form-input--unit-label" id="fleet-cg-unit-label">${esc(typeCGLabel)}</span>
        <input type="hidden" id="fleet-cg-unit" value="${esc(typeCGUnit === '%' ? 'percent_mac' : typeCGUnit)}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="fleet-notes">Notes <span class="form-label--optional">(optional)</span></label>
      <input class="form-input" id="fleet-notes" type="text" value="${esc(notesValue)}" placeholder="e.g. Annual due March 2026">
    </div>
    <div class="fleet-form__buttons">
      <button class="btn" id="fleet-save">${esc(saveLabel)}</button>
      <button class="btn btn-secondary" id="fleet-cancel">Cancel</button>
    </div>
  `;

  // Set POH reference placeholders on empty numeric fields
  const typeSelect = formArea.querySelector('#fleet-type');
  setReferencePlaceholders(formArea, types, typeSelect.value);
  typeSelect.addEventListener('change', () => {
    setReferencePlaceholders(formArea, types, typeSelect.value);
    updateCGUnit(formArea, types, typeSelect.value);
    updateWeightUnit(formArea, types, typeSelect.value);
  });
}

/**
 * Set placeholder text on empty weight/CG inputs showing the type's POH reference values.
 */
function setReferencePlaceholders(formArea, types, typeId) {
  const type = types.find((t) => t.typeId === typeId);
  if (!type) return;

  const ewInput = formArea.querySelector('#fleet-ew');
  const ewUnit = formArea.querySelector('#fleet-ew-unit');
  const cgInput = formArea.querySelector('#fleet-cg');
  const cgUnit = formArea.querySelector('#fleet-cg-unit');

  const refEW = type.limits?.referenceEmptyWeight || type.limits?.emptyWeight;
  if (refEW && ewInput) {
    ewInput.placeholder = `${refEW.value} (POH)`;
  }

  const refCG = type.limits?.referenceEmptyCG || type.weightBalance?.emptyCG;
  if (refCG && cgInput) {
    const val = refCG.value ?? refCG.arm;
    cgInput.placeholder = `${val} (POH)`;
  }
}

/**
 * Update the CG unit label when the type selection changes.
 */
function updateCGUnit(formArea, types, typeId) {
  const type = types.find((t) => t.typeId === typeId);
  if (!type) return;

  const cgUnitLabel = formArea.querySelector('#fleet-cg-unit-label');
  const cgUnitInput = formArea.querySelector('#fleet-cg-unit');
  const typeCGUnit = type.weightBalance?.cgUnit || 'in';
  const typeCGLabel = typeCGUnit === '%' ? '% MAC' : typeCGUnit;

  if (cgUnitLabel) cgUnitLabel.textContent = typeCGLabel;
  if (cgUnitInput) cgUnitInput.value = typeCGUnit === '%' ? 'percent_mac' : typeCGUnit;
}

/**
 * Update the weight unit dropdown default when the type selection changes.
 */
function updateWeightUnit(formArea, types, typeId) {
  const type = types.find((t) => t.typeId === typeId);
  if (!type) return;

  const ewUnit = formArea.querySelector('#fleet-ew-unit');
  const ewInput = formArea.querySelector('#fleet-ew');
  const typeWeightUnit = type.weightBalance?.weightUnit || 'kg';

  if (ewUnit && !ewInput?.value) {
    ewUnit.value = typeWeightUnit;
  }
}

// ─── Instance builder ───────────────────────────────────────────────────────

/**
 * Build an instance object from form inputs.
 *
 * Simple rule: if the user entered a value, store it. If blank, store null.
 * No special tags, no fallback to type references here.
 * The merger handles null → type reference fallback at runtime.
 */
function buildInstanceFromForm(formArea, existing) {
  const typeId = formArea.querySelector('#fleet-type')?.value;
  if (!typeId) return null;

  const reg = formArea.querySelector('#fleet-reg')?.value?.trim() || '';
  const notes = formArea.querySelector('#fleet-notes')?.value?.trim() || '';

  const ewRaw = formArea.querySelector('#fleet-ew')?.value;
  const ewVal = parseFloat(ewRaw);
  const ewUnit = formArea.querySelector('#fleet-ew-unit')?.value || 'lbs';

  const cgRaw = formArea.querySelector('#fleet-cg')?.value;
  const cgVal = parseFloat(cgRaw);
  const cgUnit = formArea.querySelector('#fleet-cg-unit')?.value || 'in';

  const now = new Date().toISOString();

  return {
    instanceId: existing?.instanceId || generateId(),
    typeId,
    registration: reg,
    displayName: reg || existing?.displayName || '',
    emptyWeight: !isNaN(ewVal) ? { value: ewVal, unit: ewUnit } : null,
    emptyCG: !isNaN(cgVal) ? buildCGObject(cgVal, cgUnit) : null,
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

function getSelectedType(formArea, types) {
  const typeId = formArea.querySelector('#fleet-type')?.value;
  return types.find((t) => t.typeId === typeId) || null;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

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
