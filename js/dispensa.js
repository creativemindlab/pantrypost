// ============================================================
// dispensa.js – Tab Dispensa
// ============================================================
import {
  state, scheduleSave, uid,
  formatDate, daysToExpiry, expiryClass, expiryLabel,
  showToast, stepForUnit, CATEGORIE, getCategoriaLabel, scadenzaSuggerita, suggerisciCategoria
} from './app.js';

// ---------- Render principale ----------
export function renderDispensa() {
  const panel = document.getElementById('panel-dispensa');
  const q = (panel._searchQuery || '').toLowerCase();
  const catFilter = panel._catFilter || 'tutti';

  // Filtra
  let items = state.pantry.filter(item => {
    const matchQ = !q || item.nome.toLowerCase().includes(q);
    const matchC = catFilter === 'tutti' || item.categoria === catFilter;
    return matchQ && matchC;
  });

  // Ordina per scadenza (null in fondo)
  items.sort((a, b) => {
    if (!a.scadenza && !b.scadenza) return 0;
    if (!a.scadenza) return 1;
    if (!b.scadenza) return -1;
    return new Date(a.scadenza) - new Date(b.scadenza);
  });

  panel.innerHTML = `
    <div class="section-header">
      <h2>Dispensa</h2>
      <span class="text-muted">${state.pantry.length} prodotti</span>
    </div>

    <div class="search-bar">
      <input class="input" id="dispensa-search" type="search"
        placeholder="Cerca prodotto…" value="${panel._searchQuery || ''}">
      <button class="btn btn-ghost btn-icon" id="dispensa-scan-btn" title="Scansiona barcode">
        📷
      </button>
    </div>

    <div class="chips" id="dispensa-cats">
      <button class="chip ${catFilter === 'tutti' ? 'active' : ''}" data-cat="tutti">Tutti</button>
      ${CATEGORIE.map(c => `
        <button class="chip ${catFilter === c.id ? 'active' : ''}" data-cat="${c.id}">
          ${c.label}
        </button>`).join('')}
    </div>

    <div id="dispensa-list">
      ${items.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <p>Nessun prodotto in dispensa.<br>Aggiungi qualcosa!</p>
        </div>` :
        items.map(item => renderPantryItem(item)).join('')
      }
    </div>

    <button class="fab" id="dispensa-add-btn">+</button>
  `;

  // Barcode scanner (fab secondario)
  document.getElementById('dispensa-scan-btn').addEventListener('click', openScanner);
  document.getElementById('dispensa-add-btn').addEventListener('click', () => openAddModal());

  // Ricerca
  document.getElementById('dispensa-search').addEventListener('input', e => {
    panel._searchQuery = e.target.value;
    renderDispensa();
  });

  // Filtro categoria
  document.getElementById('dispensa-cats').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    panel._catFilter = btn.dataset.cat;
    renderDispensa();
  });

  // Azioni item
  document.getElementById('dispensa-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'consume') openConsumeModal(id);
    if (btn.dataset.action === 'delete')  deleteItem(id);
  });
}

function renderPantryItem(item) {
  const days = daysToExpiry(item.scadenza);
  const cls  = expiryClass(days);
  const lbl  = expiryLabel(item.scadenza);
  return `
    <div class="card pantry-item">
      <div class="pantry-item-info">
        <div class="pantry-item-name">${item.congelato ? '🧊 ' : ''}${escHtml(item.nome)}</div>
        <div class="pantry-item-meta">
          <span class="badge badge-green">${getCategoriaLabel(item.categoria)}</span>
          <span class="${cls}" style="margin-left:6px;font-size:0.75rem">${lbl}</span>
        </div>
      </div>
      <div class="pantry-item-actions">
        <div class="pantry-qty">${item.quantita} ${escHtml(item.unita || '')}</div>
        <button class="btn btn-icon" style="background:var(--green-light);color:var(--green)"
          data-action="consume" data-id="${item.id}" title="Consuma">✓</button>
        <button class="btn btn-icon" style="background:var(--red-light);color:var(--red)"
          data-action="delete" data-id="${item.id}" title="Elimina">🗑</button>
      </div>
    </div>`;
}

// ---------- Modal aggiunta manuale ----------
function openAddModal(prefill = {}) {
  const modal = document.getElementById('modal-overlay');
  const defaultScadenza = prefill.categoria
    ? scadenzaSuggerita(prefill.categoria, !!prefill.congelato)
    : '';

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">${prefill.id ? 'Modifica' : 'Aggiungi'} prodotto</div>

      <label class="input-label">Nome prodotto</label>
      <input class="input" id="m-nome" placeholder="es. Pasta" value="${escHtml(prefill.nome || '')}">

      <div class="input-row mt-8">
        <div>
          <label class="input-label">Quantità</label>
          <input class="input" id="m-qty" type="number" min="0" step="0.1"
            value="${prefill.quantita || 1}">
        </div>
        <div>
          <label class="input-label">Unità</label>
          <select class="input" id="m-unita">
            ${['pz','kg','g','l','ml','confezioni'].map(u =>
              `<option value="${u}" ${(prefill.unita||'pz')===u?'selected':''}>${u}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <label class="input-label">Categoria</label>
      <select class="input" id="m-cat">
        ${CATEGORIE.map(c =>
          `<option value="${c.id}" ${prefill.categoria===c.id?'selected':''}>${c.label}</option>`
        ).join('')}
      </select>

      <label class="checkbox-row mt-8">
        <input type="checkbox" id="m-congelato" ${prefill.congelato ? 'checked' : ''}>
        🧊 Congelato
      </label>

      <label class="input-label mt-8">Scadenza (opzionale)</label>
      <input class="input" id="m-scadenza" type="date"
        value="${prefill.scadenza ? prefill.scadenza.slice(0,10) : defaultScadenza}">

      <div class="modal-actions">
        <button class="btn btn-ghost" style="flex:1" id="m-cancel">Annulla</button>
        <button class="btn btn-primary" style="flex:2" id="m-save">
          ${prefill.id ? 'Aggiorna' : 'Aggiungi'}
        </button>
      </div>
    </div>`;
  modal.classList.add('open');

  // Aggiorna scadenza suggerita quando cambia categoria o flag congelato
  const aggiornaScadenza = () => {
    const cat = document.getElementById('m-cat').value;
    const congelato = document.getElementById('m-congelato').checked;
    document.getElementById('m-scadenza').value = scadenzaSuggerita(cat, congelato);
  };

  // Suggerimento automatico categoria in base al nome digitato.
  // Attivo solo se non c'è già una categoria pre-impostata (nuovo item manuale,
  // non da barcode né in modifica). Si disattiva appena l'utente sceglie a mano.
  let autoSuggest = !prefill.categoria;
  document.getElementById('m-nome').addEventListener('input', e => {
    if (!autoSuggest) return;
    const suggerita = suggerisciCategoria(e.target.value);
    if (suggerita) {
      document.getElementById('m-cat').value = suggerita;
      aggiornaScadenza();
    }
  });

  document.getElementById('m-cat').addEventListener('change', () => {
    autoSuggest = false;
    aggiornaScadenza();
  });
  document.getElementById('m-congelato').addEventListener('change', aggiornaScadenza);

  document.getElementById('m-cancel').addEventListener('click', closeModal);
  document.getElementById('m-save').addEventListener('click', () => {
    const nome = document.getElementById('m-nome').value.trim();
    if (!nome) { showToast('Inserisci il nome del prodotto'); return; }
    const item = {
      id:          prefill.id || uid(),
      nome,
      quantita:    parseFloat(document.getElementById('m-qty').value) || 1,
      unita:       document.getElementById('m-unita').value,
      categoria:   document.getElementById('m-cat').value,
      scadenza:    document.getElementById('m-scadenza').value || null,
      congelato:   document.getElementById('m-congelato').checked,
      aggiunto_il: prefill.aggiunto_il || new Date().toISOString(),
    };
    if (prefill.id) {
      const idx = state.pantry.findIndex(p => p.id === prefill.id);
      if (idx >= 0) state.pantry[idx] = item;
    } else {
      state.pantry.push(item);
    }
    scheduleSave();
    closeModal();
    renderDispensa();
    showToast(prefill.id ? 'Prodotto aggiornato' : 'Prodotto aggiunto ✓');
  });

  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

// ---------- Modal consumo parziale ----------
function openConsumeModal(id) {
  const item = state.pantry.find(p => p.id === id);
  if (!item) return;
  const step = stepForUnit(item.unita);
  let qty = step;

  const modal = document.getElementById('modal-overlay');
  const render = () => {
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">Consuma — ${escHtml(item.nome)}</div>
        <p class="text-muted text-center">Disponibile: <strong>${item.quantita} ${escHtml(item.unita||'')}</strong></p>
        <div class="stepper-row">
          <button class="stepper-btn" id="s-minus">−</button>
          <div class="stepper-val">${qty} <span style="font-size:0.9rem;font-weight:400">${escHtml(item.unita||'')}</span></div>
          <button class="stepper-btn" id="s-plus">+</button>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" style="flex:1" id="s-cancel">Annulla</button>
          <button class="btn btn-primary" style="flex:2" id="s-confirm">Registra</button>
        </div>
      </div>`;
    modal.classList.add('open');

    document.getElementById('s-minus').addEventListener('click', () => {
      qty = Math.max(step, parseFloat((qty - step).toFixed(2)));
      render();
    });
    document.getElementById('s-plus').addEventListener('click', () => {
      qty = Math.min(item.quantita, parseFloat((qty + step).toFixed(2)));
      render();
    });
    document.getElementById('s-cancel').addEventListener('click', closeModal);
    document.getElementById('s-confirm').addEventListener('click', () => {
      consumeItem(item, qty);
      closeModal();
    });
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  };
  render();
}

function consumeItem(item, qty) {
  // Aggiungi a consumed
  state.consumed.unshift({
    id:           uid(),
    nome:         item.nome,
    categoria:    item.categoria,
    quantita:     qty,
    unita:        item.unita,
    consumato_il: new Date().toISOString(),
  });

  // Aggiorna o rimuovi dalla dispensa
  const newQty = parseFloat((item.quantita - qty).toFixed(2));
  if (newQty <= 0) {
    state.pantry = state.pantry.filter(p => p.id !== item.id);
    showToast(`${item.nome} esaurito — spostato in Consumati`);
  } else {
    const idx = state.pantry.findIndex(p => p.id === item.id);
    state.pantry[idx] = { ...item, quantita: newQty };
    showToast(`Consumato ${qty} ${item.unita} di ${item.nome}`);
  }

  scheduleSave();
  renderDispensa();
}

function deleteItem(id) {
  state.pantry = state.pantry.filter(p => p.id !== id);
  scheduleSave();
  renderDispensa();
  showToast('Prodotto eliminato');
}

// ---------- Barcode scanner ----------
function openScanner() {
  const modal = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">📷 Scansiona barcode</div>
      <div id="scanner-status" class="text-muted text-center mt-8">Avvio fotocamera…</div>
      <video id="scanner-video" style="width:100%;border-radius:8px;margin-top:12px;background:#000" autoplay playsinline></video>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-full" id="scanner-cancel">Chiudi</button>
      </div>
    </div>`;
  modal.classList.add('open');

  let stream = null;
  let detector = null;
  let rafId = null;

  const video  = document.getElementById('scanner-video');
  const status = document.getElementById('scanner-status');

  const stop = () => {
    cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    closeModal();
  };
  document.getElementById('scanner-cancel').addEventListener('click', stop);
  modal.addEventListener('click', e => { if (e.target === modal) stop(); });

  if (!('BarcodeDetector' in window)) {
    status.textContent = 'BarcodeDetector non supportato su questo browser.';
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(s => {
      stream = s;
      video.srcObject = s;
      detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      status.textContent = 'Inquadra il barcode…';
      const scan = async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              stop();
              await lookupBarcode(codes[0].rawValue);
              return;
            }
          } catch (_) {}
        }
        rafId = requestAnimationFrame(scan);
      };
      rafId = requestAnimationFrame(scan);
    })
    .catch(err => {
      status.textContent = `Errore fotocamera: ${err.message}`;
    });
}

async function lookupBarcode(barcode) {
  showToast(`Barcode: ${barcode} — cerco prodotto…`);
  try {
    const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
    if (data.status === 1) {
      const p = data.product;
      openAddModal({
        nome:      p.product_name_it || p.product_name || barcode,
        categoria: mapOFFCategory(p.categories_tags),
      });
    } else {
      showToast('Prodotto non trovato — inserisci manualmente');
      openAddModal({ nome: barcode });
    }
  } catch {
    showToast('Errore ricerca — inserisci manualmente');
    openAddModal({});
  }
}

function mapOFFCategory(tags = []) {
  if (!tags.length) return 'altro';
  const t = tags.join(' ');
  if (t.includes('dair') || t.includes('latt') || t.includes('formagg')) return 'latticini';
  if (t.includes('egg') || t.includes('uov')) return 'uova';
  if (t.includes('cured') || t.includes('salum') || t.includes('ham') || t.includes('sausage') || t.includes('salam')) return 'salumi';
  if (t.includes('meat') || t.includes('carne')) return 'carne';
  if (t.includes('fish') || t.includes('pesce')) return 'pesce';
  if (t.includes('vegetable') || t.includes('verdure')) return 'verdure';
  if (t.includes('fruit') || t.includes('frutta')) return 'frutta';
  if (t.includes('bread') || t.includes('pane') || t.includes('bakery')) return 'pane';
  if (t.includes('cereal') || t.includes('pasta')) return 'cereali';
  if (t.includes('conserv') || t.includes('canned')) return 'conserve';
  if (t.includes('frozen') || t.includes('surgelat')) return 'surgelati';
  if (t.includes('drink') || t.includes('bevand')) return 'bevande';
  if (t.includes('snack') || t.includes('candy') || t.includes('chocolate') || t.includes('dolci') || t.includes('biscuit')) return 'dolci_snack';
  if (t.includes('clean') || t.includes('hygiene') || t.includes('detergent') || t.includes('igiene')) return 'casa_igiene';
  return 'altro';
}

// ---------- Utility ----------
function closeModal() {
  const modal = document.getElementById('modal-overlay');
  modal.classList.remove('open');
  modal.innerHTML = '';
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
