// ============================================================
// app.js – stato globale, sync JSONBin, routing tab, utility
// ============================================================

// ---------- Configurazione JSONBin ----------
const JSONBIN_BIN_ID  = '6a3059e1da38895dfec5d8f6';
const JSONBIN_API_KEY = '$2a$10$lncAOHeJqkcM4Fc8/VZuIOxJm5xqEclQk1NWFPs5wP0D12kIqKFXS';
const JSONBIN_URL     = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// ---------- Stato applicazione ----------
export const state = {
  pantry:     [],   // { id, nome, categoria, quantita, unita, scadenza, aggiunto_il, congelato }
  consumed:   [],   // { id, nome, categoria, quantita, unita, consumato_il }
  listaSpesa: [],   // { id, nome, quantita, unita, categoria, nota, spuntato }
};

// ---------- Sync JSONBin ----------
let syncTimer = null;

export async function loadData() {
  setSyncState('syncing');
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      headers: { 'X-Access-Key': JSONBIN_API_KEY }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const record = json.record || {};
    // Schema JSONBin: items/history (nomi originali, per retrocompatibilità)
    state.pantry     = record.items     || [];
    state.consumed   = record.history   || [];
    state.listaSpesa = record.listaSpesa || [];
    setSyncState('ok');
  } catch (err) {
    console.error('Errore caricamento dati:', err);
    setSyncState('error');
    showToast('Errore connessione — dati locali');
  }
}

export function scheduleSave() {
  // debounce: salva dopo 800ms dall'ultima modifica
  clearTimeout(syncTimer);
  syncTimer = setTimeout(saveData, 800);
}

export async function saveData() {
  setSyncState('syncing');
  try {
    const res = await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': JSONBIN_API_KEY
      },
      body: JSON.stringify({
        // Schema JSONBin: items/history (nomi originali, per retrocompatibilità)
        items:      state.pantry,
        history:    state.consumed,
        listaSpesa: state.listaSpesa,
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setSyncState('ok');
  } catch (err) {
    console.error('Errore salvataggio:', err);
    setSyncState('error');
    showToast('Errore salvataggio — riprova');
  }
}

function setSyncState(s) {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  el.className = s === 'syncing' ? 'syncing' : s === 'error' ? 'error' : '';
  el.title = s === 'ok' ? 'Sincronizzato' : s === 'syncing' ? 'Sincronizzazione…' : 'Errore sync';
}

// ---------- Tab routing ----------
const tabs = ['dispensa', 'lista-spesa', 'consumati', 'ricette'];
let currentTab = 'dispensa';

export function initTabs(renderFns) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab, renderFns);
    });
  });
}

export function switchTab(tab, renderFns) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `panel-${tab}`)
  );
  if (renderFns[tab]) renderFns[tab]();
}

// ---------- Utility: ID univoco ----------
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Utility: formatta data ----------
export function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------- Utility: giorni alla scadenza ----------
export function daysToExpiry(isoString) {
  if (!isoString) return null;
  const diff = new Date(isoString).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.round(diff / 86400000);
}

// ---------- Utility: classe colore scadenza ----------
export function expiryClass(days) {
  if (days === null) return 'expiry-none';
  if (days < 0)  return 'expiry-urgent';
  if (days <= 3) return 'expiry-urgent';
  if (days <= 7) return 'expiry-soon';
  return 'expiry-ok';
}

// ---------- Utility: label scadenza ----------
export function expiryLabel(isoString) {
  const days = daysToExpiry(isoString);
  if (days === null) return 'Nessuna scadenza';
  if (days < 0)  return `Scaduto ${Math.abs(days)}g fa`;
  if (days === 0) return 'Scade oggi';
  if (days === 1) return 'Scade domani';
  return `Scade ${formatDate(isoString)} (${days}g)`;
}

// ---------- Utility: toast ----------
let toastTimer = null;
export function showToast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ---------- Utility: step quantità per unità ----------
export function stepForUnit(unita) {
  const wholeUnits = ['pz', 'pezzi', 'confezioni', 'conf', 'bottiglie', 'lattine', 'scatole'];
  return wholeUnits.includes((unita || '').toLowerCase()) ? 1 : 0.1;
}

// ---------- Categorie e scadenze default ----------
// frozenDays: scadenza suggerita se l'item è marcato come congelato (flag per-item,
// non legato alla categoria "surgelati" che resta un fallback generico per prodotti
// già surgelati all'acquisto). Categorie senza frozenDays ignorano il flag.
export const CATEGORIE = [
  { id: 'latticini',   label: '🧀 Latticini',    defaultDays: 7,    frozenDays: 90  },
  { id: 'uova',        label: '🥚 Uova',          defaultDays: 25 },
  { id: 'carne',       label: '🥩 Carne',         defaultDays: 3,    frozenDays: 180 },
  { id: 'salumi',      label: '🥓 Salumi',        defaultDays: 6,    frozenDays: 60  },
  { id: 'pesce',       label: '🐟 Pesce',         defaultDays: 2,    frozenDays: 120 },
  { id: 'verdure',     label: '🥦 Verdure',       defaultDays: 5,    frozenDays: 240 },
  { id: 'frutta',      label: '🍎 Frutta',        defaultDays: 7,    frozenDays: 240 },
  { id: 'pane',        label: '🥖 Pane',          defaultDays: 4,    frozenDays: 90  },
  { id: 'cereali',     label: '🌾 Cereali',       defaultDays: 365 },
  { id: 'conserve',    label: '🥫 Conserve',      defaultDays: 730 },
  { id: 'surgelati',   label: '🧊 Surgelati',     defaultDays: 90  },
  { id: 'bevande',     label: '🥤 Bevande',       defaultDays: 180 },
  { id: 'condimenti',  label: '🫙 Condimenti',    defaultDays: 365 },
  { id: 'dolci_snack', label: '🍪 Dolci/Snack',   defaultDays: 180 },
  { id: 'casa_igiene', label: '🧴 Casa/Igiene',   defaultDays: 3650 },
  { id: 'altro',       label: '📦 Altro',         defaultDays: 30  },
];

export function getCategoriaLabel(id) {
  return CATEGORIE.find(c => c.id === id)?.label ?? id ?? '—';
}

// ---------- Utility: scadenza suggerita in base a categoria + flag congelato ----------
export function scadenzaSuggerita(categoriaId, congelato = false) {
  const cat = CATEGORIE.find(c => c.id === categoriaId);
  if (!cat) return '';
  const giorni = (congelato && cat.frozenDays) ? cat.frozenDays : cat.defaultDays;
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

// ---------- Utility: suggerimento categoria in base al nome prodotto ----------
const KEYWORDS_CATEGORIA = {
  latticini: [
    'latte', 'formaggio', 'formaggi', 'mozzarella', 'burrata', 'stracciatella',
    'yogurt', 'burro', 'panna', 'ricotta', 'parmigiano', 'grana', 'pecorino',
    'provolone', 'stracchino', 'mascarpone', 'crescenza', 'philadelphia',
    'caciotta', 'scamorza', 'gorgonzola', 'taleggio', 'asiago', 'fontina',
    'emmentaler', 'edamer', 'feta', 'quark', 'skyr', 'kefir', 'latticello',
    'formaggino', 'sottilette', 'primo sale', 'caciocavallo', 'robiola',
  ],
  uova: ['uova', 'uovo', 'albume', 'tuorlo'],
  salumi: [
    'prosciutto', 'crudo', 'cotto', 'salame', 'salamino', 'mortadella',
    'speck', 'bresaola', 'pancetta', 'coppa', 'wurstel', 'guanciale',
    'lardo', 'culatello', 'capocollo', 'nduja', 'salsiccia', 'cotechino',
    'zampone', 'porchetta', 'affettati', 'affettato', 'pastrami',
  ],
  carne: [
    'pollo', 'manzo', 'maiale', 'tacchino', 'vitello', 'vitellone',
    'macinato', 'agnello', 'coniglio', 'bistecca', 'costine', 'costata',
    'hamburger', 'arrosto', 'spezzatino', 'fesa', 'fettine', 'cotoletta',
    'filetto', 'controfiletto', 'scaloppine', 'ali di pollo', 'cosce di pollo',
    'petto di pollo', 'sovracosce', 'anatra', 'faraona', 'cinghiale',
    'cervo', 'selvaggina', 'entrecote', 'tagliata', 'carne trita',
  ],
  pesce: [
    'pesce', 'salmone', 'tonno fresco', 'gamberi', 'gamberetti', 'gamberoni',
    'merluzzo', 'orata', 'branzino', 'spigola', 'cozze', 'vongole',
    'calamari', 'calamaretti', 'polpo', 'polipo', 'alici', 'acciughe',
    'sardine', 'sgombro', 'nasello', 'platessa', 'sogliola', 'trota',
    'baccalà', 'baccala', 'stoccafisso', 'seppie', 'scampi', 'aragosta',
    'granchio', 'ostriche', 'pesce spada', 'moscardini', 'totani',
  ],
  verdure: [
    'pomodoro', 'pomodori', 'pomodorini', 'insalata', 'lattuga', 'rucola',
    'radicchio', 'zucchina', 'zucchine', 'carota', 'carote', 'patata',
    'patate', 'cipolla', 'cipolle', 'scalogno', 'porro', 'porri',
    'peperone', 'peperoni', 'melanzana', 'melanzane', 'broccoli',
    'broccoletti', 'cavolfiore', 'cavolo', 'verza', 'spinaci', 'bietole',
    'fagiolini', 'funghi', 'champignon', 'aglio', 'sedano', 'finocchio',
    'finocchi', 'zucca', 'asparagi', 'carciofi', 'carciofo', 'ravanelli',
    'cetriolo', 'cetrioli', 'taccole', 'piselli freschi', 'fave', 'rape',
    'barbabietola', 'catalogna', 'cicoria', 'indivia', 'songino',
    'valeriana', 'erbette', 'prezzemolo', 'basilico', 'salvia',
    'rosmarino', 'menta', 'origano', 'timo', 'erba cipollina',
  ],
  frutta: [
    'mela', 'mele', 'banana', 'banane', 'arancia', 'arance', 'pera',
    'pere', 'uva', 'fragola', 'fragole', 'kiwi', 'pesca', 'pesche',
    'albicocca', 'albicocche', 'susina', 'susine', 'prugna', 'prugne',
    'limone', 'limoni', 'pompelmo', 'mandarino', 'mandarini', 'clementine',
    'anguria', 'cocomero', 'melone', 'ciliegia', 'ciliegie', 'ananas',
    'mango', 'avocado', 'cachi', 'fico', 'fichi', 'melograno', 'castagne',
    'noci', 'nocciole', 'mandorle', 'pistacchi', 'datteri', 'uvetta',
    'more', 'mirtilli', 'lamponi', 'ribes', 'litchi', 'papaya',
  ],
  pane: [
    'pane', 'panino', 'panini', 'baguette', 'focaccia', 'piadina',
    'grissini', 'michetta', 'ciabatta', 'rosetta', 'pancarré', 'pancarre',
    'panbauletto', 'tramezzino', 'brioche', 'cornetto', 'croissant',
    'taralli', 'crostini', 'pane carasau', 'schiacciata', 'pane in cassetta',
  ],
  cereali: [
    'pasta', 'spaghetti', 'penne', 'fusilli', 'rigatoni', 'farfalle',
    'tagliatelle', 'lasagne', 'gnocchi', 'tortellini', 'ravioli', 'riso',
    'farina', 'cereali', 'orzo', 'farro', 'cous cous', 'couscous', 'avena',
    'muesli', 'fiocchi d avena', 'polenta', 'semolino', 'quinoa',
    'fette biscottate', 'crackers',
  ],
  conserve: [
    'passata', 'polpa di pomodoro', 'pelati', 'concentrato di pomodoro',
    'legumi', 'fagioli', 'ceci', 'lenticchie', 'borlotti', 'cannellini',
    'mais', 'tonno in scatola', 'tonno sott olio', 'sgombro in scatola',
    'marmellata', 'confettura', 'miele', 'nutella', 'sottaceti', 'sottoli',
    'olive', 'capperi', 'funghi sott olio', 'carciofini', 'giardiniera',
  ],
  surgelati: [
    'surgelat', 'gelato', 'sorbetto', 'verdure surgelate', 'pesce surgelato',
    'bastoncini di pesce', 'patatine surgelate', 'pizza surgelata',
    'ghiacciol',
  ],
  bevande: [
    'acqua', 'vino', 'birra', 'succo', 'succhi', 'bibita', 'bibite',
    'caffè', 'caffe', 'tè', 'the ', 'tisana', 'aranciata', 'cola',
    'chinotto', 'spremuta', 'bevanda vegetale', 'energy drink', 'gassosa',
    'prosecco', 'spumante', 'liquore', 'grappa', 'whisky', 'rum', 'gin',
    'vodka', 'aperitivo', 'the freddo', 'ginger',
  ],
  condimenti: [
    'olio', 'aceto', 'sale', 'pepe', 'spezie', 'curry', 'paprika',
    'senape', 'maionese', 'ketchup', 'zucchero', 'dolcificante', 'brodo',
    'dado', 'lievito', 'bicarbonato', 'salsa di soia', 'pesto', 'salsa',
  ],
  dolci_snack: [
    'cioccolat', 'biscotti', 'patatine', 'caramelle', 'merendine', 'snack',
    'crostata', 'torta', 'dolce', 'dolci', 'wafer', 'barretta', 'popcorn',
    'gelatine', 'marshmallow', 'gomme da masticare', 'ciambelle',
    'plumcake', 'girella', 'savoiardi', 'pandoro', 'panettone',
  ],
  casa_igiene: [
    'detersivo', 'ammorbidente', 'candeggina', 'sapone', 'shampoo',
    'balsamo', 'dentifricio', 'spazzolino', 'carta igienica', 'fazzoletti',
    'tovaglioli', 'scottex', 'sacchetti spazzatura', 'deodorante',
    'bagnoschiuma', 'filo interdentale', 'assorbenti', 'pannolini',
    'salviette', 'disinfettante', 'sgrassatore', 'anticalcare', 'spugne',
    'carta forno', 'pellicola', 'alluminio', 'sacchetti freezer',
  ],
};

export function suggerisciCategoria(nome) {
  if (!nome) return null;
  const n = nome.toLowerCase().trim();
  if (n.length < 2) return null;
  for (const [catId, keywords] of Object.entries(KEYWORDS_CATEGORIA)) {
    if (keywords.some(k => n.includes(k))) return catId;
  }
  return null;
}
