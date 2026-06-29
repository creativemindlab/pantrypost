// ============================================================
// consumati.js – Tab Consumati (storico)
// ============================================================
import {
  state,
  formatDate, getCategoriaLabel
} from './app.js';

export function renderConsumati() {
  const panel = document.getElementById('panel-consumati');
  const lista = state.consumed;

  panel.innerHTML = `
    <div class="section-header">
      <h2>Consumati</h2>
      <span class="text-muted">${lista.length} voci</span>
    </div>

    ${lista.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Nessun prodotto consumato ancora.</p>
      </div>` :
      lista.map(item => `
        <div class="card consumed-item">
          <div class="consumed-item-info">
            <div class="consumed-item-name">${escHtml(item.nome)}</div>
            <div class="consumed-item-meta">
              ${item.quantita} ${escHtml(item.unita || '')}
              · <span class="badge badge-green">${getCategoriaLabel(item.categoria)}</span>
            </div>
          </div>
          <div class="consumed-date">${formatDate(item.consumato_il)}</div>
        </div>`).join('')
    }
  `;
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}
