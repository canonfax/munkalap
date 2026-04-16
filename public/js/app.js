// ═══════════════════════════════════════════
//  GyulaBringa · app.js  – fő SPA logika
// ═══════════════════════════════════════════

(() => {
  // ── Globális állapot ──
  let allData     = { munkalapok: [], keszMunkalapok: [], archivMunkalapok: [] };
  let aktivOldal  = 'dashboard';
  let tetelek     = [];
  let aktualisSzam = null;
  let mentesZarolva = false;  // duplikáció elleni zárolás

  // ── DOM segédek ──
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtDate(s) {
    if (!s) return '–';
    const [y,m,d] = s.split('-');
    return `${y}. ${m}. ${d}.`;
  }
  function fmtFt(n) { return Number(n || 0).toLocaleString('hu-HU') + ' Ft'; }

  // ── Toast értesítések ──
  function toast(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const c = $('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${msg}`;
    c.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
  }

  // ── Navigáció ──
  function navigal(oldal) {
    aktivOldal = oldal;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.oldal === oldal);
    });
    document.querySelectorAll('.content').forEach(el => {
      el.classList.toggle('active', el.id === `page-${oldal}`);
    });
    document.querySelector('.topbar-title').textContent = {
      dashboard:  '📊 Dashboard',
      uj:         '➕ Új munkalap',
      aktiv:      '🔧 Aktív munkák',
      archiv:     '📦 Archív',
    }[oldal] || '';

    // Tartalom frissítése
    if (oldal === 'dashboard')  renderDashboard();
    if (oldal === 'aktiv')      renderAktiv();
    if (oldal === 'archiv')     renderArchiv();

    // Mobilon sidebar zárása
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('open');
  }

  // ── Adatok betöltése ──
  async function betolt() {
    try {
      allData = await API.getAll();
      frissitBadgek();
    } catch (e) {
      toast('Adatok betöltése sikertelen!', 'error');
    }
  }

  function frissitBadgek() {
    const nb = $('badge-aktiv');
    const kb = $('badge-kesz');
    const ab = $('badge-archiv');
    if (nb) nb.textContent = (allData.munkalapok || []).length;
    if (kb) kb.textContent = (allData.keszMunkalapok || []).length;
    if (ab) ab.textContent = (allData.archivMunkalapok || []).length;
  }

  // ══════════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════════
  function renderDashboard() {
    const aktiv  = allData.munkalapok       || [];
    const kesz   = allData.keszMunkalapok   || [];
    const archiv = allData.archivMunkalapok || [];
    const osszes = [...aktiv, ...kesz, ...archiv];

    // Stat kártyák
    $('stat-aktiv').textContent  = aktiv.length;
    $('stat-kesz').textContent   = kesz.length;
    $('stat-archiv').textContent = archiv.length;

    // Havi bevétel (archív, aktuális hónap)
    const ma     = new Date();
    const honap  = `${ma.getFullYear()}-${String(ma.getMonth()+1).padStart(2,'0')}`;
    const haviOsszeg = archiv
      .filter(m => (m.keszDatum || m.archivDatum || '').startsWith(honap))
      .reduce((s, m) => s + (parseInt(m.osszeg) || 0), 0);
    $('stat-bevetel').textContent = fmtFt(haviOsszeg);

    // Naptár – összes aktív + kész munka
    const calMunkak = [...aktiv, ...kesz];
    Calendar.frissit ? Calendar.frissit(calMunkak) : Calendar.init('calendar-wrap', calMunkak);

    // Legutóbbi aktív munkák
    const recentHtml = aktiv.slice(-5).reverse().map(m => `
      <div class="napi-item" data-szam="${m.munkalap}" onclick="APP.megnyitSzerkeszto('${m.munkalap}')">
        <div>
          <div class="napi-item-nev">${esc(m.ugyfelNev)} · ${esc(m.kerekparAdat)}</div>
          <div class="napi-item-szam">${m.munkalap} · Átadás: ${fmtDate(m.atadasDatum)}</div>
        </div>
        <span class="badge badge-blue">${fmtFt(m.osszeg)}</span>
      </div>
    `).join('') || '<p style="color:var(--text-dim);font-size:.85rem;">Nincsenek aktív munkák.</p>';

    $('recent-list').innerHTML = recentHtml;

    // Havi összesítő
    renderHaviOsszesito();
  }

  function renderHaviOsszesito() {
    const valaszto = $('honap-valaszto');
    if (!valaszto) return;
    const val = valaszto.value;
    if (!val) return;

    const archiv = allData.archivMunkalapok || [];
    const szurt  = archiv.filter(m => (m.keszDatum || m.archivDatum || '').startsWith(val));
    const osszeg = szurt.reduce((s, m) => s + (parseInt(m.osszeg) || 0), 0);

    const szerelok = {};
    szurt.forEach(m => {
      const nev = m.szereloNev || 'Ismeretlen';
      szerelok[nev] = (szerelok[nev] || 0) + (parseInt(m.osszeg) || 0);
    });

    $('osszesito-box').innerHTML = szurt.length === 0
      ? `<p style="color:var(--text-dim);">Nincs adat erre a hónapra.</p>`
      : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
          <div class="stat-card c-blue" style="flex-direction:column;align-items:flex-start;gap:.25rem;">
            <div class="stat-l">Elvégzett munkák</div>
            <div class="stat-n">${szurt.length}</div>
          </div>
          <div class="stat-card c-green" style="flex-direction:column;align-items:flex-start;gap:.25rem;">
            <div class="stat-l">Összesített bevétel</div>
            <div class="stat-n" style="font-size:1.2rem;">${fmtFt(osszeg)}</div>
          </div>
        </div>
        <div style="font-size:.8rem;color:var(--text-dim);margin-bottom:.5rem;">Szerelőnként:</div>
        ${Object.entries(szerelok).map(([nev,ossz]) =>
          `<div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--border2);">
            <span>${esc(nev)}</span><span style="font-family:var(--mono);color:var(--blue-light);">${fmtFt(ossz)}</span>
          </div>`
        ).join('')}`;
  }

  // ══════════════════════════════════════════
  //  ÚJ / SZERKESZTŐ OLDAL
  // ══════════════════════════════════════════
  async function ujMunkalap() {
    tetelek      = [];
    aktualisSzam = null;

    const szam = await API.ujSzam();
    aktualisSzam = szam;

    $('ml-szam-display').textContent = szam;
    $('munkalapForm').reset();
    $('felvetelDatum').value = new Date().toISOString().slice(0,10);
    frissitTetelLista();

    ['ugyfelNev','telefon','kerekparAdat','atadasDatum','hibaLeiras']
      .forEach(id => $(`inp-${id}`)?.classList.remove('invalid'));

    navigal('uj');
    toast(`Új munkalap: ${szam}`, 'success');
  }

  function betoltSzerkesztesbe(m) {
    aktualisSzam = m.munkalap;
    tetelek      = m.tetelek ? JSON.parse(JSON.stringify(m.tetelek)) : [];

    $('ml-szam-display').textContent  = m.munkalap;
    $('inp-ugyfelNev').value           = m.ugyfelNev    || '';
    $('inp-telefon').value             = m.telefon      || '';
    $('inp-kerekparAdat').value        = m.kerekparAdat || '';
    $('inp-felvetelDatum').value       = m.felvetelDatum || '';
    $('inp-atadasDatum').value         = m.atadasDatum  || '';
    $('inp-hibaLeiras').value          = m.hibaLeiras   || '';
    $('inp-alkatreszek').value         = m.alkatreszek  || '';
    $('inp-szereloNev').value          = m.szereloNev   || '';
    $('inp-munkaegysegek').value       = m.munkaegysegek || '';
    $('inp-osszeg').value              = m.osszeg       || '';

    frissitTetelLista();
    frissitMunkaDij();
    navigal('uj');
  }

  // ── Tételek ──
  function hozzaadTetel() {
    const sel = $('tetel-select');
    const idx = parseInt(sel.value);
    if (isNaN(idx)) return;
    const t = ARLISTA[idx];
    if (!t) return;
    tetelek.push({ nev: t.nev, ar: t.ar });
    sel.value = '';
    frissitTetelLista();
    frissitMunkaDij();
  }

  function torolTetel(i) {
    tetelek.splice(i, 1);
    frissitTetelLista();
    frissitMunkaDij();
  }

  function frissitTetelLista() {
    const lista = $('tetel-lista');
    if (!lista) return;
    if (tetelek.length === 0) {
      lista.innerHTML = '<div style="padding:.75rem;color:var(--text-dim);font-size:.82rem;">Nincs hozzáadott tétel.</div>';
      return;
    }
    lista.innerHTML = tetelek.map((t, i) => `
      <div class="tetel-item">
        <span class="tetel-nev">${esc(t.nev)}</span>
        <span class="tetel-ar">${fmtFt(t.ar)}</span>
        <button class="btn btn-danger btn-sm" onclick="APP.torolTetel(${i})">✕</button>
      </div>
    `).join('');
  }

  function frissitMunkaDij() {
    const egysegek = parseInt($('inp-munkaegysegek')?.value) || 0;
    const percek   = egysegek * EGYSEG_PERC;
    const orak     = percek / 60;
    const munkaDij = Math.round(orak * MUNKADIJ_ORA);
    const tetelOsszeg = tetelek.reduce((s, t) => s + (t.ar || 0), 0);
    const total    = munkaDij + tetelOsszeg;

    const info = $('munkadij-info');
    if (info) {
      info.innerHTML = egysegek > 0
        ? `${egysegek} egység = ${percek} perc = <strong>${fmtFt(munkaDij)}</strong> munkadíj + <strong>${fmtFt(tetelOsszeg)}</strong> tételek`
        : `Tételek összege: <strong>${fmtFt(tetelOsszeg)}</strong>`;
    }

    const osszeg = $('inp-osszeg');
    if (osszeg) osszeg.value = total;
  }

  // ── Mentés ──
  async function mentes() {
    if (!aktualisSzam) return toast('Nincs aktív munkalap!', 'error');
    if (mentesZarolva) return;  // duplikáció védelem

    // Validáció
    const kotelezo = [
      { id: 'inp-ugyfelNev',    nev: 'Ügyfél neve' },
      { id: 'inp-telefon',      nev: 'Telefonszám' },
      { id: 'inp-kerekparAdat', nev: 'Kerékpár adatai' },
      { id: 'inp-atadasDatum',  nev: 'Várható átadás' },
      { id: 'inp-hibaLeiras',   nev: 'Hiba leírása' },
    ];
    let hiba = false;
    kotelezo.forEach(({ id, nev }) => {
      const el = $(id);
      if (!el) return;
      if (!el.value.trim()) { el.classList.add('invalid'); hiba = true; }
      else el.classList.remove('invalid');
    });
    if (hiba) return toast('Töltsd ki a kötelező mezőket!', 'error');

    mentesZarolva = true;
    try {
      const adatok = {
        munkalap      : aktualisSzam,
        ugyfelNev     : $('inp-ugyfelNev').value.trim(),
        telefon       : $('inp-telefon').value.trim(),
        kerekparAdat  : $('inp-kerekparAdat').value.trim(),
        felvetelDatum : $('inp-felvetelDatum').value,
        atadasDatum   : $('inp-atadasDatum').value,
        hibaLeiras    : $('inp-hibaLeiras').value.trim(),
        tetelek,
        osszeg        : $('inp-osszeg').value,
        munkaegysegek : $('inp-munkaegysegek').value,
        szereloNev    : $('inp-szereloNev').value.trim(),
        alkatreszek   : $('inp-alkatreszek').value.trim(),
        allapot       : 'aktiv',
      };

      await API.ment(adatok);
      await betolt();
      toast('Munkalap mentve!', 'success');
    } catch (e) {
      toast('Mentési hiba: ' + e.message, 'error');
    } finally {
      setTimeout(() => { mentesZarolva = false; }, 1000);
    }
  }

  // ── Kész jelölés ──
  async function kerekparKesz() {
    if (!aktualisSzam) return toast('Nincs aktív munkalap!', 'error');
    if (!confirm(`Kész jelöljük ezt a kerékpárt? (${aktualisSzam})`)) return;
    try {
      // Először mentjük, majd kész-be tesszük
      await mentes();
      await API.kesz(aktualisSzam);
      await betolt();
      toast('Kerékpár kész jelölve!', 'success');
      navigal('aktiv');
    } catch (e) {
      toast('Hiba: ' + e.message, 'error');
    }
  }

  // ── Törlés ──
  async function torolMunkalap(szam) {
    if (!szam) return;
    if (!confirm(`Biztosan törlöd? (${szam}) – Ez visszafordíthatatlan!`)) return;
    try {
      await API.torol(szam);
      await betolt();
      toast('Munkalap törölve.', 'success');
      if (aktualisSzam === szam) {
        aktualisSzam = null;
        navigal('dashboard');
      }
    } catch (e) {
      toast('Törlési hiba: ' + e.message, 'error');
    }
  }

  // ══════════════════════════════════════════
  //  AKTÍV MUNKÁK OLDAL
  // ══════════════════════════════════════════
  function renderAktiv() {
    const aktiv = allData.munkalapok || [];
    const kesz  = allData.keszMunkalapok || [];

    $('aktiv-table').innerHTML = renderMunkalapTabla(aktiv, 'aktiv');
    $('kesz-table').innerHTML  = renderMunkalapTabla(kesz, 'kesz');
  }

  function renderMunkalapTabla(lista, tipus) {
    if (lista.length === 0) {
      return `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-dim);">Nincs ${tipus === 'aktiv' ? 'aktív' : 'kész'} munkalap.</td></tr>`;
    }
    return lista.map(m => `
      <tr>
        <td><span class="badge badge-blue" style="font-family:var(--mono);">${esc(m.munkalap)}</span></td>
        <td><strong>${esc(m.ugyfelNev)}</strong><br><span class="td-muted">${esc(m.telefon)}</span></td>
        <td class="td-muted">${esc(m.kerekparAdat)}</td>
        <td class="td-muted">${fmtDate(m.atadasDatum)}</td>
        <td><span style="font-family:var(--mono);color:var(--blue-light);">${fmtFt(m.osszeg)}</span></td>
        <td>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" onclick="APP.megnyitSzerkeszto('${m.munkalap}')">✏️ Szerkeszt</button>
            <button class="btn btn-ghost btn-sm" onclick="APP.nyomtatMunkalap('${m.munkalap}')">🖨️</button>
            ${tipus === 'aktiv' ? `<button class="btn btn-success btn-sm" onclick="APP.keszJelol('${m.munkalap}')">✅ Kész</button>` : ''}
            ${tipus === 'kesz'  ? `<button class="btn btn-ghost btn-sm" onclick="APP.archivalas('${m.munkalap}')">📦 Archív</button>
                                   <button class="btn btn-ghost btn-sm" onclick="APP.visszaallitas('${m.munkalap}')">↩ Vissza</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="APP.torolMunkalap('${m.munkalap}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ══════════════════════════════════════════
  //  ARCHÍV OLDAL
  // ══════════════════════════════════════════
  function renderArchiv() {
    const archiv = allData.archivMunkalapok || [];
    const q      = ($('archiv-search')?.value || '').toLowerCase();

    const szurt = archiv.filter(m =>
      !q ||
      (m.ugyfelNev || '').toLowerCase().includes(q) ||
      (m.munkalap  || '').toLowerCase().includes(q) ||
      (m.kerekparAdat || '').toLowerCase().includes(q)
    );

    $('archiv-table').innerHTML = szurt.length === 0
      ? `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-dim);">Nincs archivált munkalap.</td></tr>`
      : szurt.slice().reverse().map(m => `
        <tr>
          <td><span class="badge badge-blue" style="font-family:var(--mono);">${esc(m.munkalap)}</span></td>
          <td><strong>${esc(m.ugyfelNev)}</strong><br><span class="td-muted">${esc(m.telefon)}</span></td>
          <td class="td-muted">${esc(m.kerekparAdat)}</td>
          <td class="td-muted">${fmtDate(m.keszDatum || m.archivDatum)}</td>
          <td><span style="font-family:var(--mono);color:var(--green);">${fmtFt(m.osszeg)}</span></td>
          <td>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
              <button class="btn btn-ghost btn-sm" onclick="APP.nyomtatMunkalap('${m.munkalap}')">🖨️ Nyomtat</button>
              <button class="btn btn-danger btn-sm" onclick="APP.torolMunkalap('${m.munkalap}')">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');
  }

  // ══════════════════════════════════════════
  //  NYOMTATÁS / PDF
  // ══════════════════════════════════════════
  function megtalal(szam) {
    const osszes = [
      ...(allData.munkalapok || []),
      ...(allData.keszMunkalapok || []),
      ...(allData.archivMunkalapok || []),
    ];
    return osszes.find(m => m.munkalap === szam);
  }

  function nyomtatMunkalap(szam) {
    const m = megtalal(szam);
    if (!m) return toast('Munkalap nem található!', 'error');

    const ujAblak = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    ujAblak.document.write(munkalapHtml(m));
    ujAblak.document.close();
  }

  function munkalapHtml(m) {
    const tetelSor = (m.tetelek || []).map(t =>
      `<tr><td>${t.nev}</td><td style="text-align:right;font-weight:600;">${Number(t.ar).toLocaleString('hu-HU')} Ft</td></tr>`
    ).join('');

    return `<!DOCTYPE html><html lang="hu"><head>
      <meta charset="UTF-8">
      <title>Munkalap – ${m.munkalap}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20mm 15mm; color: #111; font-size: 13pt; }
        h2 { font-size: 18pt; margin-bottom: 4px; }
        .sub { font-size: 11pt; color: #555; margin-bottom: 20px; }
        .row { display: flex; gap: 40px; margin-bottom: 16px; }
        .field { flex: 1; }
        .field label { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: .05em; display: block; margin-bottom: 3px; }
        .field .val { font-weight: 600; font-size: 12pt; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th { background: #f0f0f0; padding: 7px 10px; text-align: left; font-size: 10pt; border: 1px solid #ddd; }
        td { padding: 6px 10px; border: 1px solid #eee; font-size: 11pt; }
        .total { font-size: 14pt; font-weight: 700; text-align: right; margin-top: 10px; }
        .sig { display: flex; justify-content: space-between; margin-top: 50px; }
        .sig-box { width: 42%; border-top: 1px solid #000; text-align: center; padding-top: 6px; font-size: 10pt; color: #555; }
        .buttons { display: flex; gap: 10px; margin-bottom: 20px; }
        button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 12pt; color: #fff; }
        #pdfBtn { background: #2563eb; }
        #printBtn { background: #059669; }
        @media print { .buttons { display: none !important; } body { padding: 10mm 15mm; } }
      </style>
    </head><body>
      <div class="buttons">
        <button id="pdfBtn">📄 PDF mentés</button>
        <button id="printBtn">🖨️ Nyomtatás</button>
      </div>
      <h2>GyulaBringa Szerviz</h2>
      <div class="sub">Munkalap száma: <strong>${m.munkalap}</strong></div>
      <div class="row">
        <div class="field"><label>Ügyfél neve</label><div class="val">${m.ugyfelNev || '–'}</div></div>
        <div class="field"><label>Telefonszám</label><div class="val">${m.telefon || '–'}</div></div>
      </div>
      <div class="row">
        <div class="field"><label>Kerékpár adatai</label><div class="val">${m.kerekparAdat || '–'}</div></div>
        <div class="field"><label>Szerelő</label><div class="val">${m.szereloNev || '–'}</div></div>
      </div>
      <div class="row">
        <div class="field"><label>Felvétel dátuma</label><div class="val">${m.felvetelDatum || '–'}</div></div>
        <div class="field"><label>Várható átadás</label><div class="val">${m.atadasDatum || '–'}</div></div>
      </div>
      <div class="field" style="margin-bottom:16px;"><label>Hiba leírása / kért munka</label><div class="val" style="min-height:50px;">${(m.hibaLeiras || '–').replace(/\n/g,'<br>')}</div></div>
      ${m.tetelek?.length ? `<table><thead><tr><th>Elvégzett munka</th><th style="text-align:right;">Díj</th></tr></thead><tbody>${tetelSor}</tbody></table>` : ''}
      ${m.alkatreszek ? `<div class="field" style="margin-bottom:16px;"><label>Felhasznált alkatrészek</label><div class="val">${m.alkatreszek.replace(/\n/g,'<br>')}</div></div>` : ''}
      <div class="total">Összeg: ${Number(m.osszeg || 0).toLocaleString('hu-HU')} Ft</div>
      <div class="sig">
        <div class="sig-box">Ügyfél aláírása</div>
        <div class="sig-box">P.H. / Szerelő</div>
      </div>
      <script>
        const { jsPDF } = window.jspdf;
        document.getElementById('printBtn').onclick = () => window.print();
        document.getElementById('pdfBtn').onclick = () => {
          const doc = new jsPDF({ format: 'a4', unit: 'mm' });
          const sorok = [
            'GyulaBringa Szerviz – Munkalap',
            '==============================',
            'Munkalap: ${m.munkalap}',
            'Ügyfél: ${m.ugyfelNev || "–"}',
            'Telefon: ${m.telefon || "–"}',
            'Kerékpár: ${m.kerekparAdat || "–"}',
            'Szerelő: ${m.szereloNev || "–"}',
            'Felvétel: ${m.felvetelDatum || "–"}',
            'Átadás: ${m.atadasDatum || "–"}',
            '',
            'Hiba leírása:',
            '${(m.hibaLeiras || "–").replace(/'/g, "\\'")}',
            '',
            'Elvégzett munkák:',
            ${JSON.stringify((m.tetelek||[]).map(t => t.nev + ' – ' + t.ar + ' Ft'))},
            '',
            'Alkatrészek: ${(m.alkatreszek || "–").replace(/\n/g," | ").replace(/'/g,"\\'")}',
            '',
            'ÖSSZEG: ${m.osszeg || 0} Ft',
            '',
            '______________________        ______________________',
            '    Ügyfél aláírása                  P.H. / Szerelő',
          ];
          let y = 20;
          sorok.forEach(s => {
            if (Array.isArray(s)) {
              s.forEach(ss => { const ls = doc.splitTextToSize(ss, 170); doc.text(ls, 20, y); y += ls.length * 6; });
            } else {
              const lines = doc.splitTextToSize(String(s), 170);
              doc.text(lines, 20, y); y += lines.length * 6;
            }
            if (y > 270) { doc.addPage(); y = 20; }
          });
          doc.save('munkalap_${m.munkalap}.pdf');
        };
      <\/script>
    </body></html>`;
  }

  // ══════════════════════════════════════════
  //  GLOBÁLIS APP INTERFÉSZ
  // ══════════════════════════════════════════
  window.APP = {
    megnyitSzerkeszto(szam) {
      const m = megtalal(szam);
      if (m) betoltSzerkesztesbe(m);
    },
    torolTetel,
    torolMunkalap,
    nyomtatMunkalap,
    keszJelol: async (szam) => {
      if (!confirm(`Kész jelölés: ${szam}?`)) return;
      try {
        await API.kesz(szam);
        await betolt();
        renderAktiv();
        toast('Kerékpár kész!', 'success');
      } catch (e) { toast(e.message, 'error'); }
    },
    archivalas: async (szam) => {
      if (!confirm(`Archiválás: ${szam}?`)) return;
      try {
        await API.archiv(szam);
        await betolt();
        renderAktiv();
        toast('Archiválva!', 'success');
      } catch (e) { toast(e.message, 'error'); }
    },
    visszaallitas: async (szam) => {
      if (!confirm(`Visszaállítás aktívba: ${szam}?`)) return;
      try {
        await API.visszaallitas(szam);
        await betolt();
        renderAktiv();
        toast('Visszaállítva!', 'success');
      } catch (e) { toast(e.message, 'error'); }
    },
  };

  // ══════════════════════════════════════════
  //  INICIALIZÁLÁS
  // ══════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', async () => {
    // Navigáció
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => navigal(el.dataset.oldal));
    });

    // Form gombok
    $('btn-uj-munkalap')?.addEventListener('click', ujMunkalap);
    $('btn-mentes')?.addEventListener('click', mentes);
    $('btn-kesz')?.addEventListener('click', kerekparKesz);
    $('btn-torol')?.addEventListener('click', () => torolMunkalap(aktualisSzam));
    $('btn-nyomtat')?.addEventListener('click', () => nyomtatMunkalap(aktualisSzam));

    // Tétel hozzáadás
    $('btn-tetel-add')?.addEventListener('click', hozzaadTetel);
    $('inp-munkaegysegek')?.addEventListener('input', frissitMunkaDij);

    // Havi összesítő
    $('honap-valaszto')?.addEventListener('change', renderHaviOsszesito);

    // Archív keresés
    $('archiv-search')?.addEventListener('input', renderArchiv);

    // Hamburger menü
    $('hamburger')?.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
      document.querySelector('.sidebar-overlay').classList.toggle('open');
    });
    document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay').classList.remove('open');
    });

    // Validáció: input esetén piros keret eltűnik
    ['inp-ugyfelNev','inp-telefon','inp-kerekparAdat','inp-atadasDatum','inp-hibaLeiras']
      .forEach(id => $(id)?.addEventListener('input', () => $(id)?.classList.remove('invalid')));

    // Naptár init
    Calendar.init('calendar-wrap', []);

    // Adatok betöltése
    await betolt();
    renderDashboard();
    frissitBadgek();
  });

  // Typo fix: frissitBadgek → frissitBadgek
  function frissitBadgek() {
    const nb = $('badge-aktiv');
    const kb = $('badge-kesz');
    const ab = $('badge-archiv');
    if (nb) nb.textContent = (allData.munkalapok || []).length;
    if (kb) kb.textContent = (allData.keszMunkalapok || []).length;
    if (ab) ab.textContent = (allData.archivMunkalapok || []).length;
  }

})();