// ============================================================
// lista-spesa.js – Tab Lista della Spesa
// ============================================================
import {
  state, scheduleSave, uid,
  showToast, stepForUnit, CATEGORIE, getCategoriaLabel,
  formatDate, suggerisciCategoria
} from './app.js';

// ---------- Render principale ----------
export function renderListaSpesa() {
  const panel = document.getElementById('panel-lista-spesa');
  const lista = state.listaSpesa;
  const spuntati = lista.filter(i => i.spuntato);

  panel.innerHTML = `
    <div class="section-header">
      <h2>Lista della spesa</h2>
      <span class="text-muted">${lista.length} articoli</span>
    </div>

    <div class="lista-top-actions">
      <button class="btn btn-primary" id="ls-add-btn">+ Aggiungi</button>
      ${spuntati.length > 0 ? `
        <button class="btn btn-ghost" id="ls-deselect-btn">
          ☐ Deseleziona tutti
        </button>` : ''}
    </div>

    ${lista.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">🛍️</div>
        <p>Lista vuota.<br>Aggiungi cosa ti serve!</p>
      </div>` :
      `<div id="ls-list">
        ${lista.map(item => renderSpesaItem(item)).join('')}
      </div>

      <div class="trasferisci-bar">
        <div class="trasferisci-count">
          ${spuntati.length === 0
            ? 'Spunta gli articoli acquistati'
            : `${spuntati.length} articolo${spuntati.length > 1 ? 'i' : ''} selezionato${spuntati.length > 1 ? 'i' : ''}`}
        </div>
        <button class="btn btn-primary btn-full" id="ls-trasferisci-btn"
          ${spuntati.length === 0 ? 'disabled style="opacity:0.4"' : ''}>
          📦 Trasferisci in dispensa
        </button>
      </div>`
    }
  `;

  // Aggiungi articolo
  document.getElementById('ls-add-btn')
    .addEventListener('click', () => openAddModal());

  // Deseleziona tutti
  document.getElementById('ls-deselect-btn')
    ?.addEventListener('click', () => {
      state.listaSpesa.forEach(i => i.spuntato = false);
      scheduleSave();
      renderListaSpesa();
    });

  // Azioni su lista (spunta, elimina)
  document.getElementById('ls-list')
    ?.addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const id = target.dataset.id;
      if (target.dataset.action === 'toggle') toggleSpunta(id);
      if (target.dataset.action === 'delete') deleteArticolo(id);
    });

  // Trasferisci in dispensa
  document.getElementById('ls-trasferisci-btn')
    ?.addEventListener('click', () => openTrasferisciFlow());
}

function renderSpesaItem(item) {
  return `
    <div class="spesa-item ${item.spuntato ? 'spuntato' : ''}" data-id="${item.id}">
      <button class="spesa-item-check" data-action="toggle" data-id="${item.id}">
        ${item.spuntato ? '✓' : ''}
      </button>
      <div class="spesa-item-info">
        <div class="spesa-item-name">${escHtml(item.nome)}</div>
        <div class="spesa-item-meta">
          ${item.quantita} ${escHtml(item.unita || '')}
          · <span style="opacity:0.7">${getCategoriaLabel(item.categoria)}</span>
          ${item.nota ? `· <em>${escHtml(item.nota)}</em>` : ''}
        </div>
      </div>
      <button class="spesa-item-delete" data-action="delete" data-id="${item.id}"
        title="Rimuovi dalla lista" aria-label="Elimina ${escHtml(item.nome)}">
        ✕
      </button>
    </div>`;
}

// ---------- Toggle spunta ----------
function toggleSpunta(id) {
  const item = state.listaSpesa.find(i => i.id === id);
  if (!item) return;
  item.spuntato = !item.spuntato;
  scheduleSave();
  renderListaSpesa();
}

// ---------- Elimina articolo dalla lista ----------
function deleteArticolo(id) {
  state.listaSpesa = state.listaSpesa.filter(i => i.id !== id);
  scheduleSave();
  renderListaSpesa();
  showToast('Articolo rimosso dalla lista');
}

// ---------- Modal aggiunta articolo ----------
function openAddModal(prefill = {}) {
  const modal = document.getElementById('modal-overlay');

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">Aggiungi alla lista</div>

      <label class="input-label">Nome prodotto</label>
      <input class="input" id="ls-nome" placeholder="es. Latte, Pasta…"
        value="${escHtml(prefill.nome || '')}" autocomplete="off">

      <div class="input-row mt-8">
        <div>
          <label class="input-label">Quantità</label>
          <input class="input" id="ls-qty" type="number" min="0.1" step="0.1"
            value="${prefill.quantita || 1}">
        </div>
        <div>
          <label class="input-label">Unità</label>
          <select class="input" id="ls-unita">
            ${['pz','kg','g','l','ml','confezioni'].map(u =>
              `<option value="${u}" ${(prefill.unita||'pz')===u?'selected':''}>${u}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <label class="input-label">Categoria</label>
      <select class="input" id="ls-cat">
        ${CATEGORIE.map(c =>
          `<option value="${c.id}" ${prefill.categoria===c.id?'selected':''}>${c.label}</option>`
        ).join('')}
      </select>

      <label class="input-label mt-8">Nota (opzionale)</label>
      <input class="input" id="ls-nota" placeholder="es. biologico, marca X…"
        value="${escHtml(prefill.nota || '')}">

      <div class="modal-actions">
        <button class="btn btn-ghost" style="flex:1" id="ls-cancel">Annulla</button>
        <button class="btn btn-primary" style="flex:2" id="ls-save">Aggiungi</button>
      </div>
    </div>`;
  modal.classList.add('open');

  document.getElementById('ls-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Suggerimento automatico categoria in base al nome digitato.
  // Attivo solo se non c'è già una categoria pre-impostata; si disattiva
  // appena l'utente sceglie la categoria a mano.
  let autoSuggest = !prefill.categoria;
  document.getElementById('ls-nome').addEventListener('input', e => {
    if (!autoSuggest) return;
    const suggerita = suggerisciCategoria(e.target.value);
    if (suggerita) document.getElementById('ls-cat').value = suggerita;
  });
  document.getElementById('ls-cat').addEventListener('change', () => {
    autoSuggest = false;
  });

  document.getElementById('ls-save').addEventListener('click', () => {
    const nome = document.getElementById('ls-nome').value.trim();
    if (!nome) { showToast('Inserisci il nome del prodotto'); return; }

    state.listaSpesa.push({
      id:         uid(),
      nome,
      quantita:   parseFloat(document.getElementById('ls-qty').value) || 1,
      unita:      document.getElementById('ls-unita').value,
      categoria:  document.getElementById('ls-cat').value,
      nota:       document.getElementById('ls-nota').value.trim(),
      spuntato:   false,
    });

    scheduleSave();
    closeModal();
    renderListaSpesa();
    showToast(`${nome} aggiunto alla lista ✓`);
  });
}

// ---------- Flusso trasferimento in dispensa ----------
// Apre un dialog per ogni articolo spuntato, uno alla volta,
// per confermare quantità acquistata e scadenza prima di entrare in dispensa.

function openTrasferisciFlow() {
  const spuntati = state.listaSpesa.filter(i => i.spuntato);
  if (spuntati.length === 0) return;

  let index = 0;

  const processNext = () => {
    if (index >= spuntati.length) {
      // Fine flusso: deseleziona tutti, salva, aggiorna UI
      state.listaSpesa.forEach(i => i.spuntato = false);
      scheduleSave();
      renderListaSpesa();
      showToast(`✓ ${spuntati.length} prodotti aggiunti alla dispensa`);
      return;
    }
    openTrasferisciDialog(spuntati[index], index, spuntati.length, () => {
      index++;
      processNext();
    });
  };

  processNext();
}

function openTrasferisciDialog(item, idx, total, onDone) {
  const modal = document.getElementById('modal-overlay');

  // Calcola scadenza default dalla categoria
  const cat = CATEGORIE.find(c => c.id === item.categoria);
  const defaultDate = cat
    ? (() => { const d = new Date(); d.setDate(d.getDate() + cat.defaultDays); return d.toISOString().slice(0,10); })()
    : '';

  const step = stepForUnit(item.unita);

  modal.innerHTML = `
    <div class="modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div class="modal-title" style="margin:0">In dispensa</div>
        <span class="text-muted">${idx + 1} / ${total}</span>
      </div>
      <p style="font-size:1rem;font-weight:700;color:var(--green);margin-bottom:14px">
        ${escHtml(item.nome)}
      </p>

      <div class="input-row">
        <div>
          <label class="input-label">Quantità acquistata</label>
          <input class="input" id="tr-qty" type="number"
            min="${step}" step="${step}" value="${item.quantita}">
        </div>
        <div>
          <label class="input-label">Unità</label>
          <select class="input" id="tr-unita">
            ${['pz','kg','g','l','ml','confezioni'].map(u =>
              `<option value="${u}" ${item.unita===u?'selected':''}>${u}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <label class="input-label">Scadenza (opzionale)</label>
      <input class="input" id="tr-scadenza" type="date" value="${defaultDate}">

      <div class="modal-actions">
        <button class="btn btn-ghost" style="flex:1" id="tr-skip">Salta</button>
        <button class="btn btn-primary" style="flex:2" id="tr-confirm">
          ${idx < total - 1 ? 'Aggiungi →' : 'Aggiungi ✓'}
        </button>
      </div>
    </div>`;
  modal.classList.add('open');

  const confirm = () => {
    const { uid: _uid, ...rest } = item; // non usato
    const newItem = {
      id:          uid(),
      nome:        item.nome,
      categoria:   item.categoria,
      quantita:    parseFloat(document.getElementById('tr-qty').value) || item.quantita,
      unita:       document.getElementById('tr-unita').value,
      scadenza:    document.getElementById('tr-scadenza').value || null,
      aggiunto_il: new Date().toISOString(),
    };

    // Controlla se esiste già in dispensa (stesso nome+unità) → somma quantità
    const existing = state.pantry.find(
      p => p.nome.toLowerCase() === newItem.nome.toLowerCase() && p.unita === newItem.unita
    );
    if (existing) {
      existing.quantita = parseFloat((existing.quantita + newItem.quantita).toFixed(2));
      // Aggiorna scadenza se quella nuova è più recente
      if (newItem.scadenza && (!existing.scadenza || newItem.scadenza > existing.scadenza)) {
        existing.scadenza = newItem.scadenza;
      }
    } else {
      state.pantry.push(newItem);
    }

    closeModal();
    onDone();
  };

  const skip = () => {
    closeModal();
    onDone();
  };

  document.getElementById('tr-confirm').addEventListener('click', confirm);
  document.getElementById('tr-skip').addEventListener('click', skip);
}

// ---------- Utility ----------
function closeModal() {
  const modal = document.getElementById('modal-overlay');
  modal.classList.remove('open');
  modal.innerHTML = '';
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}
