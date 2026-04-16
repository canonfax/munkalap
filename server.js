// ═══════════════════════════════════════════
//  GyulaBringa · server.js
//  Robusztus Express szerver – mutex alapú
//  írás, race condition mentes
// ═══════════════════════════════════════════

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;
const DB   = path.join(__dirname, 'data', 'munkalapok.json');

// ── Mutex: egyszerre csak 1 írás ──
let writeLock = false;
const writeQueue = [];

function acquireLock(fn) {
  if (!writeLock) {
    writeLock = true;
    fn(() => {
      writeLock = false;
      if (writeQueue.length) writeQueue.shift()();
    });
  } else {
    writeQueue.push(() => acquireLock(fn));
  }
}

// ── JSON helpers ──
function readDB() {
  if (!fs.existsSync(DB)) {
    return { munkalapok: [], keszMunkalapok: [], archivMunkalapok: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB, 'utf8'));
  } catch {
    return { munkalapok: [], keszMunkalapok: [], archivMunkalapok: [] };
  }
}

function writeDB(data, done) {
  acquireLock(release => {
    try {
      // data/ mappa létrehozása ha nem létezik
      const dir = path.dirname(DB);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // Atomikus írás: temp fájlba, majd rename
      const tmp = DB + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, DB);
      done(null);
    } catch (e) {
      done(e);
    } finally {
      release();
    }
  });
}

// ── Middleware ──
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

// ── Gyökér ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Összes adat lekérése ──
app.get('/api/storage', (req, res) => {
  res.json(readDB());
});

// ── Új munkalapszám generálása ──
app.get('/api/ujMunkalapSzam', (req, res) => {
  const data = readDB();
  const osszes = [
    ...(data.munkalapok       || []),
    ...(data.keszMunkalapok   || []),
    ...(data.archivMunkalapok || []),
  ];

  const now   = new Date();
  const ev    = now.getFullYear();
  const honap = String(now.getMonth() + 1).padStart(2, '0');
  let idx = 1;
  let szam;

  do {
    szam = `${ev}-${honap}-${String(idx).padStart(3, '0')}`;
    idx++;
  } while (osszes.some(m => m.munkalap === szam));

  res.json({ szam });
});

// ── Mentés (új vagy frissítés) ──
// Duplikáció védelem: munkalapszám alapján ellenőrizzük
app.post('/api/munkalap', (req, res) => {
  const munkalap = req.body;
  if (!munkalap || !munkalap.munkalap) {
    return res.status(400).json({ error: 'Hiányzó munkalapszám' });
  }

  writeDB(readDB(), release => {}); // dummy – valódi:
  acquireLock(release => {
    try {
      const data  = readDB();
      const lista = data.munkalapok || [];
      const idx   = lista.findIndex(m => m.munkalap === munkalap.munkalap);

      if (idx >= 0) {
        lista[idx] = munkalap;  // frissítés
      } else {
        lista.push(munkalap);   // új
      }
      data.munkalapok = lista;

      const tmp = DB + '.tmp';
      if (!fs.existsSync(path.dirname(DB))) fs.mkdirSync(path.dirname(DB), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, DB);
      res.json({ ok: true });
    } catch (e) {
      console.error('Mentési hiba:', e);
      res.status(500).json({ error: e.message });
    } finally {
      release();
    }
  });
});

// ── Kerékpár kész: aktív → kész ──
app.post('/api/kesz/:szam', (req, res) => {
  acquireLock(release => {
    try {
      const data = readDB();
      const szam = decodeURIComponent(req.params.szam);
      const idx  = (data.munkalapok || []).findIndex(m => m.munkalap === szam);
      if (idx < 0) { release(); return res.status(404).json({ error: 'Nem található' }); }

      const m = data.munkalapok.splice(idx, 1)[0];
      m.keszDatum = new Date().toISOString().slice(0, 10);
      m.allapot   = 'kesz';
      if (!data.keszMunkalapok) data.keszMunkalapok = [];
      // duplikáció védelem
      if (!data.keszMunkalapok.find(x => x.munkalap === szam)) {
        data.keszMunkalapok.push(m);
      }

      const tmp = DB + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, DB);
      res.json({ ok: true, keszDatum: m.keszDatum });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      release();
    }
  });
});

// ── Archiválás: kész → archív ──
app.post('/api/archiv/:szam', (req, res) => {
  acquireLock(release => {
    try {
      const data = readDB();
      const szam = decodeURIComponent(req.params.szam);
      const idx  = (data.keszMunkalapok || []).findIndex(m => m.munkalap === szam);
      if (idx < 0) { release(); return res.status(404).json({ error: 'Nem található' }); }

      const m = data.keszMunkalapok.splice(idx, 1)[0];
      m.archivDatum = new Date().toISOString().slice(0, 10);
      m.allapot     = 'archiv';
      if (!data.archivMunkalapok) data.archivMunkalapok = [];
      if (!data.archivMunkalapok.find(x => x.munkalap === szam)) {
        data.archivMunkalapok.push(m);
      }

      const tmp = DB + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, DB);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      release();
    }
  });
});

// ── Törlés (bármely listából) ──
app.delete('/api/munkalap/:szam', (req, res) => {
  acquireLock(release => {
    try {
      const data = readDB();
      const szam = decodeURIComponent(req.params.szam);

      data.munkalapok       = (data.munkalapok       || []).filter(m => m.munkalap !== szam);
      data.keszMunkalapok   = (data.keszMunkalapok   || []).filter(m => m.munkalap !== szam);
      data.archivMunkalapok = (data.archivMunkalapok || []).filter(m => m.munkalap !== szam);

      const tmp = DB + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, DB);
      console.log(`🗑️ Törölve: ${szam}`);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      release();
    }
  });
});

// ── Státusz visszaállítás: kész → aktív ──
app.post('/api/visszaallitas/:szam', (req, res) => {
  acquireLock(release => {
    try {
      const data = readDB();
      const szam = decodeURIComponent(req.params.szam);
      const idx  = (data.keszMunkalapok || []).findIndex(m => m.munkalap === szam);
      if (idx < 0) { release(); return res.status(404).json({ error: 'Nem található' }); }

      const m = data.keszMunkalapok.splice(idx, 1)[0];
      delete m.keszDatum;
      m.allapot = 'aktiv';
      if (!data.munkalapok.find(x => x.munkalap === szam)) {
        data.munkalapok.push(m);
      }

      const tmp = DB + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, DB);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      release();
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ GyulaBringa szerver fut: http://localhost:${PORT}`);
});