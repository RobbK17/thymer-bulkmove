/**
 * Bulk Move Notes - Thymer App Plugin
 * Select a collection, choose notes from it, and move them into another collection.
 * Uses copy-then-delete: copies record content to the target collection.
 * If the SDK provides moveToCollection in the future, this can be switched to a true move.
 */

export class Plugin extends AppPlugin {

  onLoad() {
    this.ui.addCommandPaletteCommand({
      label: "Bulk move notes to another collection",
      icon: "files",
      onSelected: () => this.openBulkMoveDialog()
    });
  }

  async openBulkMoveDialog() {
    const collections = await this.data.getAllCollections();
    const nonJournal = collections.filter(c => !c.isJournalPlugin());
    if (nonJournal.length < 2) {
      this.ui.addToaster({
        title: "Bulk Move",
        message: "You need at least two (non-journal) collections to move notes between.",
        dismissible: true,
        autoDestroyTime: 4000
      });
      return;
    }

    const css = `
      .bulkmove-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000;
        font-family: var(--font-family), sans-serif;
      }
      .bulkmove-modal {
        background: var(--bg-default, #fff);
        border: 1px solid var(--border-default, #ddd);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        width: 90%; max-width: 520px;
        max-height: 85vh;
        display: flex; flex-direction: column;
      }
      .bulkmove-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-default, #eee);
        font-weight: 600;
        font-size: 1rem;
      }
      .bulkmove-body {
        padding: 16px 20px;
        overflow: auto;
        flex: 1;
        display: flex; flex-direction: column; gap: 16px;
      }
      .bulkmove-row { display: flex; flex-direction: column; gap: 6px; }
      .bulkmove-row label { font-size: 0.85rem; color: var(--text-muted, #666); }
      .bulkmove-row select {
        padding: 8px 12px;
        border-radius: 8px;
        border: 2px solid var(--border-default, #444);
        background: var(--bg-default, #2d2d2d);
        color: var(--text-default, #f0f0f0);
        font-size: 0.95rem;
        font-weight: 500;
      }
      .bulkmove-row select option {
        background: var(--bg-default, #2d2d2d);
        color: var(--text-default, #f0f0f0);
      }
      .bulkmove-notes {
        border: 1px solid var(--border-default);
        border-radius: 8px;
        max-height: 220px;
        overflow: auto;
        padding: 8px;
      }
      .bulkmove-note {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
      }
      .bulkmove-note:hover { background: var(--bg-hover, #f5f5f5); }
      .bulkmove-note input[type=checkbox] { flex-shrink: 0; cursor: pointer; }
      .bulkmove-note span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bulkmove-footer {
        padding: 12px 20px;
        border-top: 1px solid var(--border-default);
        display: flex; justify-content: flex-end; gap: 10px;
      }
      .bulkmove-btn {
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid var(--border-default);
        background: var(--bg-default);
        cursor: pointer;
        font-size: 0.9rem;
      }
      .bulkmove-btn.primary {
        background: var(--enum-blue-bg, #2563eb);
        color: #fff;
        border-color: var(--enum-blue-border, #2563eb);
      }
      .bulkmove-btn.primary:hover { opacity: 0.9; }
      .bulkmove-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .bulkmove-empty { color: var(--text-muted); font-size: 0.9rem; padding: 12px; }
    `;
    this.ui.injectCSS(css);

    const overlay = document.createElement("div");
    overlay.className = "bulkmove-overlay";

    const modal = document.createElement("div");
    modal.className = "bulkmove-modal";

    const header = document.createElement("div");
    header.className = "bulkmove-header";
    header.textContent = "Bulk move notes";

    const body = document.createElement("div");
    body.className = "bulkmove-body";

    const sourceRow = document.createElement("div");
    sourceRow.className = "bulkmove-row";
    sourceRow.innerHTML = "<label>From collection</label>";
    const sourceSelect = document.createElement("select");
    sourceSelect.innerHTML = "<option value=''>— Select collection —</option>";
    nonJournal.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.getGuid();
      opt.textContent = c.getName();
      sourceSelect.appendChild(opt);
    });
    sourceRow.appendChild(sourceSelect);
    body.appendChild(sourceRow);

    const notesRow = document.createElement("div");
    notesRow.className = "bulkmove-row";
    notesRow.innerHTML = "<label>Notes to move</label>";
    const notesBox = document.createElement("div");
    notesBox.className = "bulkmove-notes";
    notesBox.innerHTML = "<div class='bulkmove-empty'>Select a collection to list notes.</div>";
    notesRow.appendChild(notesBox);
    body.appendChild(notesRow);

    const targetRow = document.createElement("div");
    targetRow.className = "bulkmove-row";
    targetRow.innerHTML = "<label>To collection</label>";
    const targetSelect = document.createElement("select");
    targetSelect.innerHTML = "<option value=''>— Select collection —</option>";
    nonJournal.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.getGuid();
      opt.textContent = c.getName();
      targetSelect.appendChild(opt);
    });
    targetRow.appendChild(targetSelect);
    body.appendChild(targetRow);

    const footer = document.createElement("div");
    footer.className = "bulkmove-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "bulkmove-btn";
    cancelBtn.textContent = "Cancel";
    const moveBtn = document.createElement("button");
    moveBtn.className = "bulkmove-btn primary";
    moveBtn.textContent = "Move selected";

    let records = [];
    let sourceCollection = null;
    let targetCollection = null;

    const refreshTargetOptions = () => {
      const srcGuid = sourceSelect.value;
      targetSelect.innerHTML = "<option value=''>— Select collection —</option>";
      nonJournal.forEach(c => {
        if (c.getGuid() === srcGuid) return;
        const opt = document.createElement("option");
        opt.value = c.getGuid();
        opt.textContent = c.getName();
        targetSelect.appendChild(opt);
      });
    };

    sourceSelect.addEventListener("change", async () => {
      const guid = sourceSelect.value;
      refreshTargetOptions();
      records = [];
      notesBox.innerHTML = "<div class='bulkmove-empty'>Loading…</div>";
      if (!guid) {
        notesBox.innerHTML = "<div class='bulkmove-empty'>Select a collection to list notes.</div>";
        return;
      }
      sourceCollection = this.data.getPluginByGuid(guid);
      if (!sourceCollection || typeof sourceCollection.getAllRecords !== "function") {
        notesBox.innerHTML = "<div class='bulkmove-empty'>Could not load collection.</div>";
        return;
      }
      try {
        records = await sourceCollection.getAllRecords();
        notesBox.innerHTML = "";
        if (records.length === 0) {
          notesBox.innerHTML = "<div class='bulkmove-empty'>No notes in this collection.</div>";
          return;
        }
        records.forEach((rec, i) => {
          const label = document.createElement("label");
          label.className = "bulkmove-note";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.dataset.index = String(i);
          const span = document.createElement("span");
          span.textContent = rec.getName() || "(Untitled)";
          span.title = rec.getName() || "";
          label.appendChild(cb);
          label.appendChild(span);
          label.addEventListener("click", (e) => { if (e.target !== cb) cb.checked = !cb.checked; });
          notesBox.appendChild(label);
        });
      } catch (err) {
        notesBox.innerHTML = "<div class='bulkmove-empty'>Error loading notes.</div>";
        console.error(err);
      }
    });

    const close = () => {
      overlay.remove();
    };

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

    cancelBtn.addEventListener("click", close);

    moveBtn.addEventListener("click", async () => {
      const targetGuid = targetSelect.value;
      if (!sourceCollection || !targetGuid) {
        this.ui.addToaster({ title: "Bulk Move", message: "Select source and target collections.", dismissible: true, autoDestroyTime: 3000 });
        return;
      }
      targetCollection = this.data.getPluginByGuid(targetGuid);
      if (!targetCollection || typeof targetCollection.createRecord !== "function") {
        this.ui.addToaster({ title: "Bulk Move", message: "Invalid target collection.", dismissible: true, autoDestroyTime: 3000 });
        return;
      }
      const checkboxes = notesBox.querySelectorAll("input[type=checkbox]:checked");
      const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index, 10));
      if (indices.length === 0) {
        this.ui.addToaster({ title: "Bulk Move", message: "Select at least one note to move.", dismissible: true, autoDestroyTime: 3000 });
        return;
      }
      moveBtn.disabled = true;
      moveBtn.textContent = "Moving…";
      let moved = 0;
      let failed = 0;
      for (const i of indices) {
        const rec = records[i];
        if (!rec) continue;
        try {
          const newGuid = targetCollection.createRecord(rec.getName() || "Untitled");
          if (newGuid) {
            const newRecord = await this._getRecordWithRetry(newGuid, 20, 150);
            if (newRecord) {
              this._copyRecordProperties(rec, newRecord);
              await this._copyBodyLineByLine(rec, newRecord, null);
            }
            moved++;
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
          console.error("Bulk move error for " + rec.getName(), e);
        }
      }
      close();
      this.ui.addToaster({
        title: "Bulk Move",
        message: moved ? `Moved ${moved} note${moved === 1 ? "" : "s"}${failed ? `; ${failed} failed.` : "."}` : `Failed to move (${failed} error${failed === 1 ? "" : "s"}).`,
        dismissible: true,
        autoDestroyTime: 4000
      });
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(moveBtn);
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  /**
   * Copy body by walking the source record's line item tree and creating each line on the
   * duplicate with createLineItem(parent, afterItem, type, segments, props).
   * insertAfter: PluginLineItem to insert body content after (e.g. provenance line), or null.
   */
  async _copyBodyLineByLine(src, dst, insertAfter) {
    const items = await src.getLineItems?.();
    if (!items || !Array.isArray(items) || items.length === 0) return;

    const itemGuids = new Set(items.map((i) => i.guid));
    const srcByGuid = new Map(items.map((i) => [i.guid, i]));
    const rootKey = "__root__";
    const byParent = new Map();

    const isRoot = (item) =>
      item.parent_guid == null ||
      item.parent_guid === "" ||
      !itemGuids.has(item.parent_guid);

    const roots = items.filter(isRoot);
    byParent.set(rootKey, roots);

    for (const item of items) {
      if (!item.parent_guid || !itemGuids.has(item.parent_guid)) continue;
      const key = item.parent_guid;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(item);
    }

    const getChildren = (parentKey) => {
      const list = byParent.get(parentKey);
      if (list && list.length > 0) return list;
      if (parentKey !== rootKey) {
        const srcItem = srcByGuid.get(parentKey);
        if (srcItem?.children && Array.isArray(srcItem.children)) return srcItem.children;
      }
      return null;
    };

    const processChildren = async (parentDst, parentKey, firstAfter) => {
      const list = getChildren(parentKey);
      if (!list || list.length === 0) return null;
      let afterDst = firstAfter ?? null;
      for (const item of list) {
        const segments = this._cloneSegments(item.segments);
        const props =
          item.props && typeof item.props === "object" ? { ...item.props } : null;
        const newItem = await dst.createLineItem(
          parentDst,
          afterDst,
          item.type,
          segments,
          props
        );
        if (!newItem) continue;
        await this._copyLineItemMeta(item, newItem);
        await processChildren(newItem, item.guid, null);
        afterDst = newItem;
      }
      return afterDst;
    };

    await processChildren(null, rootKey, insertAfter ?? null);
  }

  /** Copy task status, block style, heading size, etc. from source line to created line. */
  async _copyLineItemMeta(srcLine, dstLine) {
    try {
      const status = srcLine.getTaskStatus?.();
      if (status != null && typeof dstLine.setTaskStatus === "function") {
        await dstLine.setTaskStatus(status);
      }
      const blockStyle = srcLine.getBlockStyle?.();
      if (blockStyle != null && typeof dstLine.setBlockStyle === "function") {
        await dstLine.setBlockStyle(blockStyle);
      }
      const headingSize = srcLine.getHeadingSize?.();
      if (headingSize != null && typeof dstLine.setHeadingSize === "function") {
        await dstLine.setHeadingSize(headingSize);
      }
      const lang = srcLine.getHighlightLanguage?.();
      if (lang != null && typeof dstLine.setHighlightLanguage === "function") {
        await dstLine.setHighlightLanguage(lang);
      }
      const icon = srcLine.getIcon?.();
      if (icon != null && typeof dstLine.setIcon === "function") {
        await dstLine.setIcon(icon);
      }
      const linkStyle = srcLine.getLinkStyle?.();
      if (linkStyle != null && typeof dstLine.setLinkStyle === "function") {
        await dstLine.setLinkStyle(linkStyle);
      }
    } catch (_) {}
  }

  /** Clone segment objects so we don't mutate source; preserves type, text, url, guid, etc. */
  _cloneSegments(segments) {
    if (!segments || !Array.isArray(segments)) return [{ type: "text", text: "" }];
    return segments.map((seg) => {
      if (seg && typeof seg === "object") {
        const out = { type: seg.type || "text" };
        if (seg.text != null) out.text = seg.text;
        if (seg.url != null) out.url = seg.url;
        if (seg.guid != null) out.guid = seg.guid;
        if (seg.choiceId != null) out.choiceId = seg.choiceId;
        return out;
      }
      return { type: "text", text: String(seg) };
    });
  }

  /** Copy record properties (custom collection fields) from source to target. */
  _copyRecordProperties(src, dst) {
    try {
      const srcProps = src.getAllProperties?.();
      if (!srcProps || !Array.isArray(srcProps)) return;
      for (const p of srcProps) {
        const pname = String(p.name || "").toLowerCase();
        if (pname === "name" || pname === "title") continue;

        const dstProp = dst.prop?.(p.name);
        if (!dstProp) continue;

        const dt = p.datetime?.();
        if (dt) {
          dstProp.set(dt.value());
          continue;
        }

        const d = p.date?.();
        if (d !== undefined && d !== null) {
          dstProp.set(d);
          continue;
        }

        const n = p.number?.();
        if (n !== null && n !== undefined) {
          dstProp.set(n);
          continue;
        }

        const c = p.choice?.();
        if (c !== null && c !== undefined) {
          dstProp.set(c);
          continue;
        }

        const t = p.text?.();
        if (t !== null && t !== undefined) {
          dstProp.set(t);
          continue;
        }
      }
    } catch (_) {}
  }

  async _getRecordWithRetry(guid, attempts, delayMs) {
    for (let i = 0; i < attempts; i++) {
      const rec = this.data.getRecord(guid);
      if (rec) return rec;
      await this._sleep(delayMs);
    }
    return null;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
