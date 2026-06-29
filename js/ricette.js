// ============================================================
// ricette.js – Tab Ricette (stub – da implementare)
// ============================================================

export function renderRicette() {
  const panel = document.getElementById('panel-ricette');
  panel.innerHTML = `
    <div class="empty-state" style="padding-top:64px">
      <div class="empty-icon">👨‍🍳</div>
      <p style="font-size:1rem;font-weight:600;color:var(--gray-600)">
        Ricette in arrivo
      </p>
      <p class="mt-8" style="font-size:0.85rem">
        Suggerimenti AI basati su cosa hai in dispensa,<br>
        con priorità agli ingredienti in scadenza.
      </p>
    </div>
  `;
}
