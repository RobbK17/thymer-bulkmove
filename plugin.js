/**
 * Bulk Move Notes - Thymer App Plugin v 1.01 
 * ---------------------------------------------------------------------------
 * Select a source collection, pick records, and move them into a target collection
 * using the SDK's native move API:
 *    await record.moveToCollection(targetCollection)
 *
 * Notes:
 * - Journals are excluded (moveToCollection does not support moving to/from Journals).
 * - Move is best-effort: continues on failures and summarizes results.
 */

class Plugin extends AppPlugin {
  onLoad() {
    this.ui.addCommandPaletteCommand({
      label: "Bulk move notes",
      icon: "files",
      onSelected: () => this.openBulkMoveDialog(),
    });
  }

  onUnload() {
    // Nothing persistent to cleanup (dialog removes itself on close).
  }

  async openBulkMoveDialog() {
    const collections = (await this.data.getAllCollections?.()) || [];
    const nonJournal = collections.filter((c) => !c.isJournalPlugin?.());

    if (nonJournal.length < 2) {
      this._toast(
        "Bulk Move",
        "You need at least two (non-journal) collections to move notes between.",
        4500
      );
      return;
    }

    // ---- Inject CSS (once per open) ----
    const css = `
      .bulkmove-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.45);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000;
        font-family: var(--font-family), sans-serif;
      }
      .bulkmove-modal {
        background: var(--bg-default, #1f1f1f);
        color: var(--text-default, #f0f0f0);
        border: 1px solid var(--border-default, #333);
        border-radius: 12px;
        box-shadow: 0 12px 44px rgba(0,0,0,0.35);
        width: 92%; max-width: 760px;
        max-height: 88vh;
        display: flex; flex-direction: column;
        overflow: hidden;
      }
      .bulkmove-header {
        padding: 14px 18px;
        border-bottom: 1px solid var(--border-default, #333);
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px;
      }
      .bulkmove-title {
        font-weight: 650;
        font-size: 1rem;
        display: flex; align-items: center; gap: 10px;
      }
      .bulkmove-close {
        cursor: pointer;
        border: 1px solid var(--border-default, #444);
        background: transparent;
        color: inherit;
        border-radius: 10px;
        padding: 6px 10px;
        font-size: 0.9rem;
      }
      .bulkmove-body {
        padding: 16px 18px;
        overflow: auto;
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 18px;
      }
      .bulkmove-row {
        display: flex; flex-direction: column; gap: 6px;
      }
      .bulkmove-row label {
        font-size: 0.85rem;
        color: var(--text-muted, #b7b7b7);
      }
      .bulkmove-row select, .bulkmove-row input[type="text"] {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--border-default, #444);
        background: var(--bg-default, #2a2a2a);
        color: var(--text-default, #f0f0f0);
        font-size: 0.95rem;
        outline: none;
      }
      .bulkmove-row input[type="checkbox"] {
        transform: scale(1.05);
      }
      .bulkmove-listwrap {
        grid-column: 1 / -1;
        border: 1px solid var(--border-default, #333);
        border-radius: 12px;
        overflow: hidden;
        background: rgba(255,255,255,0.02);
      }
      .bulkmove-listheader {
        padding: 10px 12px;
        border-bottom: 1px solid var(--border-default, #333);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .bulkmove-listheader .left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .bulkmove-pill {
        font-size: 0.8rem;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid var(--border-default, #444);
        color: var(--text-muted, #b7b7b7);
      }
      .bulkmove-list {
        max-height: 46vh;
        overflow: auto;
      }
      .bulkmove-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .bulkmove-item:last-child { border-bottom: none; }
      .bulkmove-item .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bulkmove-item .meta {
        font-size: 0.78rem;
        color: var(--text-muted, #b7b7b7);
      }
      .bulkmove-footer {
        padding: 12px 18px;
        border-top: 1px solid var(--border-default, #333);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .bulkmove-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .bulkmove-btn {
        border: 1px solid var(--border-default, #444);
        background: var(--bg-default, #2a2a2a);
        color: var(--text-default, #f0f0f0);
        padding: 9px 12px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.92rem;
      }
      .bulkmove-btn.primary {
        border-color: rgba(255,255,255,0.25);
      }
      .bulkmove-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .bulkmove-status {
        font-size: 0.85rem;
        color: var(--text-muted, #b7b7b7);
        white-space: pre-line;
      }
      .bulkmove-spinner {
        display: inline-block;
        margin-right: 8px;
        vertical-align: middle;
      }
      .bulkmove-help {
        font-size: 0.82rem;
        color: var(--text-muted, #b7b7b7);
      }
      .bulkmove-gridhint {
        grid-column: 1 / -1;
        font-size: 0.85rem;
        color: var(--text-muted, #b7b7b7);
      }
      @media (max-width: 740px) {
        .bulkmove-body { grid-template-columns: 1fr; }
      }
    `;
    this.ui.injectCSS?.(css);

    // ---- UI scaffold ----
    const overlay = this.ui.$html?.(`
      <div class="bulkmove-overlay" role="dialog" aria-modal="true">
        <div class="bulkmove-modal">
          <div class="bulkmove-header">
            <div class="bulkmove-title">
              <span>📦 Bulk Move</span>
              <span class="bulkmove-pill" id="bm-summary">Select notes to move</span>
            </div>
            <button class="bulkmove-close" id="bm-close">Close</button>
          </div>

          <div class="bulkmove-body">
            <div class="bulkmove-row">
              <label for="bm-source">Source collection</label>
              <select id="bm-source"></select>
            </div>

            <div class="bulkmove-row">
              <label for="bm-target">Target collection</label>
              <select id="bm-target"></select>
            </div>

            <div class="bulkmove-row">
              <label for="bm-filter">Filter (title contains)</label>
              <input id="bm-filter" type="text" placeholder="e.g. incident, draft, Q1..." />
            </div>

            <div class="bulkmove-row">
              <label>&nbsp;</label>
              <div style="display:flex; align-items:center; gap:10px;">
                <input id="bm-only-selected" type="checkbox" />
                <span class="bulkmove-help">Show only selected</span>
              </div>
            </div>

            <div class="bulkmove-gridhint" id="bm-hint"></div>

            <div class="bulkmove-listwrap">
              <div class="bulkmove-listheader">
                <div class="left">
                  <button class="bulkmove-btn" id="bm-select-all">Select all</button>
                  <button class="bulkmove-btn" id="bm-select-none">Select none</button>
                  <span class="bulkmove-pill" id="bm-count">0 records</span>
                  <span class="bulkmove-pill" id="bm-selected">0 selected</span>
                </div>
                <div class="bulkmove-help" id="bm-loadstate"></div>
              </div>
              <div class="bulkmove-list" id="bm-list"></div>
            </div>
          </div>

          <div class="bulkmove-footer">
            <div class="bulkmove-status" id="bm-status"></div>
            <div class="bulkmove-actions">
              <button class="bulkmove-btn" id="bm-refresh">Refresh</button>
              <button class="bulkmove-btn primary" id="bm-move" disabled>Move selected</button>
            </div>
          </div>
        </div>
      </div>
    `);

    if (!overlay) {
      this._toast("Bulk Move", "Failed to render UI overlay.", 3500);
      return;
    }

    document.body.appendChild(overlay);

    const $ = (sel) => overlay.querySelector(sel);

    const sourceSel = $("#bm-source");
    const targetSel = $("#bm-target");
    const filterInp = $("#bm-filter");
    const onlySelCb = $("#bm-only-selected");
    const listEl = $("#bm-list");

    const closeBtn = $("#bm-close");
    const refreshBtn = $("#bm-refresh");
    const moveBtn = $("#bm-move");
    const selectAllBtn = $("#bm-select-all");
    const selectNoneBtn = $("#bm-select-none");

    const summaryEl = $("#bm-summary");
    const hintEl = $("#bm-hint");
    const countEl = $("#bm-count");
    const selectedEl = $("#bm-selected");
    const statusEl = $("#bm-status");
    const loadstateEl = $("#bm-loadstate");

    // ---- State ----
    const state = {
      collections: nonJournal,
      sourceGuid: null,
      targetGuid: null,
      records: /** @type {PluginRecord[]} */ ([]),
      filtered: /** @type {PluginRecord[]} */ ([]),
      selectedGuids: new Set(),
      loading: false,
      running: false,
    };

    const getCollectionByGuid = (guid) =>
      state.collections.find((c) => c.getGuid?.() === guid) || null;

    const setStatus = (txt) => {
      if (statusEl) statusEl.textContent = txt || "";
    };
    const setLoading = (on, msg) => {
      state.loading = !!on;
      if (loadstateEl) {
        loadstateEl.textContent = on ? (msg || "Loading…") : "";
      }
    };

    const updateMoveEnabled = () => {
      const ok =
        !state.running &&
        state.selectedGuids.size > 0 &&
        state.sourceGuid &&
        state.targetGuid &&
        state.sourceGuid !== state.targetGuid;
      if (moveBtn) moveBtn.disabled = !ok;
    };

    const updateCounts = () => {
      countEl.textContent = `${state.filtered.length} records`;
      selectedEl.textContent = `${state.selectedGuids.size} selected`;
      summaryEl.textContent =
        state.sourceGuid && state.targetGuid
          ? `From "${getCollectionByGuid(state.sourceGuid)?.getName?.() || "?"}" → "${getCollectionByGuid(state.targetGuid)?.getName?.() || "?"}"`
          : "Select notes to move";
      updateMoveEnabled();
    };

    const safeName = (rec) => rec?.getName?.() || "Untitled";

    const renderList = () => {
      if (!listEl) return;

      const q = (filterInp?.value || "").trim().toLowerCase();
      const onlySelected = !!onlySelCb?.checked;

      const base = state.records || [];
      const filtered = base.filter((r) => {
        const name = safeName(r).toLowerCase();
        if (q && !name.includes(q)) return false;
        if (onlySelected && !state.selectedGuids.has(r.guid)) return false;
        return true;
      });

      state.filtered = filtered;

      listEl.innerHTML = "";
      const frag = document.createDocumentFragment();

      for (const rec of filtered) {
        const checked = state.selectedGuids.has(rec.guid);
        const row = this.ui.$html?.(`
          <div class="bulkmove-item">
            <input type="checkbox" ${checked ? "checked" : ""} data-guid="${this._esc(rec.guid)}" />
            <div class="name" title="${this._esc(safeName(rec))}">${this._esc(safeName(rec))}</div>
            <div class="meta">${this._esc(rec.guid)}</div>
          </div>
        `);
        if (row) frag.appendChild(row);
      }

      listEl.appendChild(frag);

      updateCounts();
      hintEl.textContent =
        state.records.length === 0
          ? "No records found in the selected source collection."
          : "Tip: Use the filter to narrow, then Select all to move in bulk. (Like a tidy-up, but for your brain.)";
    };

    // ---- Load records for source collection ----
    const loadRecordsForSource = async () => {
      const source = getCollectionByGuid(state.sourceGuid);
      if (!source) {
        state.records = [];
        state.filtered = [];
        state.selectedGuids.clear();
        renderList();
        return;
      }

      setLoading(true, "Loading records…");
      setStatus("");
      state.selectedGuids.clear();
      updateCounts();

      try {
        const recs = (await source.getAllRecords?.()) || [];
        // Sort by name for stable UX
        recs.sort((a, b) => safeName(a).localeCompare(safeName(b)));
        state.records = recs;
      } catch (e) {
        state.records = [];
        this._toast("Bulk Move", `Error loading records: ${String(e?.message || e)}`, 6500);
      } finally {
        setLoading(false, "");
        renderList();
      }
    };

    // ---- Populate selects ----
    const populateSelects = () => {
      const mkOpt = (c) => {
        const guid = c.getGuid?.();
        const name = c.getName?.() || "Untitled Collection";
        return `<option value="${this._esc(guid)}">${this._esc(name)}</option>`;
      };

      // source
      sourceSel.innerHTML = state.collections.map(mkOpt).join("");

      // target
      targetSel.innerHTML = state.collections.map(mkOpt).join("");

      // default choices: first as source, second as target
      state.sourceGuid = state.collections[0].getGuid?.();
      state.targetGuid = state.collections[1].getGuid?.();

      sourceSel.value = state.sourceGuid;
      targetSel.value = state.targetGuid;

      updateCounts();
    };

    // ---- Move selected ----
    const moveSelected = async () => {
      if (state.running) return;

      const source = getCollectionByGuid(state.sourceGuid);
      const target = getCollectionByGuid(state.targetGuid);

      if (!source || !target) {
        this._toast("Bulk Move", "Select both a source and a target collection.", 4000);
        return;
      }
      if (source.getGuid?.() === target.getGuid?.()) {
        this._toast("Bulk Move", "Source and target must be different collections.", 4500);
        return;
      }
      if (source.isJournalPlugin?.() || target.isJournalPlugin?.()) {
        this._toast("Bulk Move", "Cannot move to/from Journal collections.", 4500);
        return;
      }

      const selected = state.records.filter((r) => state.selectedGuids.has(r.guid));
      if (!selected.length) {
        this._toast("Bulk Move", "No records selected.", 3000);
        return;
      }

      state.running = true;
      updateMoveEnabled();

      const targetName = target.getName?.() || "Target";
      this._toast("Bulk Move", `Moving ${selected.length} record(s) to "${targetName}"…`, 3000);

      let moved = 0;
      let failed = 0;
      const failures = [];

      // Light progress text (no heavy DOM updates)
      setStatus(`Moving ${selected.length}…`);

      for (let i = 0; i < selected.length; i++) {
        const rec = selected[i];
        try {
          // ✅ Native move (no copy/delete)
          const ok = await rec.moveToCollection(target);
          if (ok) moved++;
          else {
            failed++;
            failures.push({
              guid: rec.guid,
              name: safeName(rec),
              error: "moveToCollection returned false",
            });
          }
        } catch (e) {
          failed++;
          failures.push({
            guid: rec.guid,
            name: safeName(rec),
            error: String(e?.message || e),
          });
        }

        if ((i + 1) % 10 === 0 || i === selected.length - 1) {
          setStatus(`Moving… ${i + 1}/${selected.length}\nMoved: ${moved}   Failed: ${failed}`);
        }
      }

      state.running = false;

      // Refresh source list (records moved out)
      await loadRecordsForSource();

      const summary =
        `Moved: ${moved}\nFailed: ${failed}` +
        (failed
          ? `\n\nFirst few failures:\n${failures
              .slice(0, 6)
              .map((f) => `• ${f.name} (${f.guid}): ${f.error}`)
              .join("\n")}`
          : "");

      this._toast("Bulk Move complete", summary, failed ? 10000 : 5500);
      setStatus("");
    };

    // ---- Events ----
    const cleanup = () => {
      try {
        overlay.remove();
      } catch (_) {}
    };

    closeBtn?.addEventListener("click", cleanup);
    overlay.addEventListener("click", (ev) => {
      // close if clicking outside modal
      if (ev.target === overlay.firstElementChild?.parentElement) return;
    });

    sourceSel?.addEventListener("change", async () => {
      state.sourceGuid = sourceSel.value;
      // auto-avoid choosing same target
      if (state.targetGuid === state.sourceGuid) {
        const fallback = state.collections.find((c) => c.getGuid?.() !== state.sourceGuid);
        if (fallback) {
          state.targetGuid = fallback.getGuid?.();
          targetSel.value = state.targetGuid;
        }
      }
      updateCounts();
      await loadRecordsForSource();
    });

    targetSel?.addEventListener("change", () => {
      state.targetGuid = targetSel.value;
      updateCounts();
    });

    filterInp?.addEventListener("input", () => renderList());
    onlySelCb?.addEventListener("change", () => renderList());

    listEl?.addEventListener("change", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.type !== "checkbox") return;
      const guid = t.getAttribute("data-guid");
      if (!guid) return;

      if (t.checked) state.selectedGuids.add(guid);
      else state.selectedGuids.delete(guid);

      updateCounts();
    });

    selectAllBtn?.addEventListener("click", () => {
      // Select all currently visible (filtered) records
      for (const rec of state.filtered) state.selectedGuids.add(rec.guid);
      renderList();
    });

    selectNoneBtn?.addEventListener("click", () => {
      state.selectedGuids.clear();
      renderList();
    });

    refreshBtn?.addEventListener("click", () => loadRecordsForSource());
    moveBtn?.addEventListener("click", () => moveSelected());

    // ESC closes
    const keyHandler = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", keyHandler);
        cleanup();
      }
    };
    document.addEventListener("keydown", keyHandler);

    // ---- Init ----
    populateSelects();
    await loadRecordsForSource();
  }

  // -----------------------------
  // Small helpers
  // -----------------------------
  _toast(title, message, autoDestroyTime = 4000) {
    try {
      this.ui.addToaster?.({
        title,
        message,
        dismissible: true,
        autoDestroyTime,
      });
    } catch (_) {}
  }

  _esc(s) {
    // keep it simple; UIAPI.htmlEscape exists too, but we can avoid relying on it
    const str = String(s ?? "");
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}