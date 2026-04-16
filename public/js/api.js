// ═══════════════════════════════════════════
//  GyulaBringa · api.js  – közös API modul
// ═══════════════════════════════════════════

const API = {

    async getAll() {
        const r = await fetch('/api/storage');
        if (!r.ok) throw new Error('Betöltési hiba');
        return await r.json();
    },

    async ujSzam() {
        const r = await fetch('/api/ujMunkalapSzam');
        if (!r.ok) throw new Error('Számlgenerálási hiba');
        return (await r.json()).szam;
    },

    async ment(adatok) {
        const r = await fetch('/api/munkalap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adatok),
        });
        if (!r.ok) throw new Error('Mentési hiba');
        return await r.json();
    },

    async kesz(szam) {
        const r = await fetch(`/api/kesz/${encodeURIComponent(szam)}`, { method: 'POST' });
        if (!r.ok) throw new Error('Státusz hiba');
        return await r.json();
    },

    async archiv(szam) {
        const r = await fetch(`/api/archiv/${encodeURIComponent(szam)}`, { method: 'POST' });
        if (!r.ok) throw new Error('Archiválási hiba');
        return await r.json();
    },

    async torol(szam) {
        const r = await fetch(`/api/munkalap/${encodeURIComponent(szam)}`, { method: 'DELETE' });
        if (!r.ok) throw new Error('Törlési hiba');
        return await r.json();
    },

    async visszaallitas(szam) {
        const r = await fetch(`/api/visszaallitas/${encodeURIComponent(szam)}`, { method: 'POST' });
        if (!r.ok) throw new Error('Visszaállítási hiba');
        return await r.json();
    },
};