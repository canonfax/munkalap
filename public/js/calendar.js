// ═══════════════════════════════════════════
//  GyulaBringa · calendar.js
// ═══════════════════════════════════════════

const Calendar = (() => {
  let _year, _month, _munkak = [], _onDayClick, _containerId;

  const HU_MONTHS = ['Január','Február','Március','Április','Május','Június',
                     'Július','Augusztus','Szeptember','Október','November','December'];
  const HU_DAYS   = ['H','K','Sze','Cs','P','Szo','V'];

  function _pad(n) { return String(n).padStart(2,'0'); }
  function _dateKey(y, m, d) { return `${y}-${_pad(m+1)}-${_pad(d)}`; }

  function _munkaCountForDay(dateKey) {
    return _munkak.filter(m => (m.atadasDatum || m.felvetelDatum || '') === dateKey).length;
  }

  function _colorClass(cnt) {
    if (cnt === 0) return '';
    if (cnt <= 3)  return 'cal-zold';
    if (cnt <= 6)  return 'cal-sarga';
    return 'cal-piros';
  }

  function _dotColor(cnt) {
    if (cnt <= 3)  return '#10b981';
    if (cnt <= 6)  return '#f59e0b';
    return '#ef4444';
  }

  function _build() {
    const container = document.getElementById(_containerId);
    if (!container) return;

    const today    = new Date(); today.setHours(0,0,0,0);
    const first    = new Date(_year, _month, 1);
    const startCol = (first.getDay() + 6) % 7; // H=0
    const days     = new Date(_year, _month + 1, 0).getDate();

    let html = `
      <div class="cal-wrap">
        <div class="cal-header">
          <div style="display:flex;gap:.4rem;">
            <button class="cal-nav" id="cal-prev">◀</button>
            <button class="cal-nav" id="cal-next">▶</button>
            <button class="cal-nav" id="cal-ma" style="font-size:.72rem;padding:.3rem .75rem;">Ma</button>
          </div>
          <div class="cal-title">${_year} / ${HU_MONTHS[_month]}</div>
          <div></div>
        </div>
        <table class="cal-table">
          <thead><tr>${HU_DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
          <tbody>`;

    let day = 1;
    for (let row = 0; row < 6; row++) {
      if (day > days) break;
      html += '<tr>';
      for (let col = 0; col < 7; col++) {
        if ((row === 0 && col < startCol) || day > days) {
          html += '<td class="cal-empty"></td>';
        } else {
          const dateKey = _dateKey(_year, _month, day);
          const cnt     = _munkaCountForDay(dateKey);
          const isToday = new Date(_year, _month, day).getTime() === today.getTime();
          const dots    = cnt > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:3px;">${
            Array(Math.min(cnt, 6)).fill(0).map(() =>
              `<div class="cal-dot" style="background:${_dotColor(cnt)};"></div>`
            ).join('')}${cnt > 6 ? `<span style="font-size:.6rem;color:var(--text-dim)">+${cnt-6}</span>` : ''}</div>` : '';

          html += `<td class="${_colorClass(cnt)} ${isToday ? 'cal-today' : ''}" data-date="${dateKey}">
            <div class="cal-cell">
              <span class="cal-day-num">${day}</span>
              ${dots}
            </div>
          </td>`;
          day++;
        }
      }
      html += '</tr>';
    }

    html += `</tbody></table>
      <div class="cal-legend">
        <div class="cal-legend-item"><div class="cal-legend-dot" style="background:rgba(16,185,129,.3);border:1px solid #10b981;"></div>1–3 munka</div>
        <div class="cal-legend-item"><div class="cal-legend-dot" style="background:rgba(245,158,11,.3);border:1px solid #f59e0b;"></div>4–6 munka</div>
        <div class="cal-legend-item"><div class="cal-legend-dot" style="background:rgba(239,68,68,.3);border:1px solid #ef4444;"></div>7+ munka</div>
      </div>
      <div class="napi-munkak" id="napi-munkak">
        <div class="napi-munkak-cim">📋 Kattints egy napra a munkák megtekintéséhez</div>
      </div>
    </div>`;

    container.innerHTML = html;

    // Navigáció
    document.getElementById('cal-prev').addEventListener('click', () => {
      _month--; if (_month < 0) { _month = 11; _year--; } _build();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      _month++; if (_month > 11) { _month = 0; _year++; } _build();
    });
    document.getElementById('cal-ma').addEventListener('click', () => {
      const now = new Date(); _year = now.getFullYear(); _month = now.getMonth(); _build();
    });

    // Nap kattintás
    container.querySelectorAll('.cal-table td[data-date]').forEach(td => {
      td.addEventListener('click', () => {
        const dateKey = td.dataset.date;
        const napiMunkak = _munkak.filter(m =>
          (m.atadasDatum || m.felvetelDatum || '') === dateKey
        );
        _showDayPanel(dateKey, napiMunkak);
        if (_onDayClick) _onDayClick(dateKey, napiMunkak);
      });
    });
  }

  function _showDayPanel(dateKey, munkak) {
    const panel = document.getElementById('napi-munkak');
    if (!panel) return;

    const [y, m, d] = dateKey.split('-');
    const cim = `${y}. ${m}. ${d}. – ${munkak.length} munka`;

    if (munkak.length === 0) {
      panel.innerHTML = `<div class="napi-munkak-cim">📋 ${cim} – ezen a napon nincs bejegyzett munka</div>`;
      return;
    }

    // Időrendi sorrend (időpont nélküliek a lista végére)
    const rendezett = [...munkak].sort((a, b) => {
      const ta = a.atadasIdo || '99:99';
      const tb = b.atadasIdo || '99:99';
      return ta.localeCompare(tb);
    });

    panel.innerHTML = `
      <div class="napi-munkak-cim">📋 ${cim}</div>
      ${rendezett.map(m => `
        <div class="napi-item" data-szam="${m.munkalap}">
          <div>
            <div class="napi-item-nev">
              ${m.atadasIdo ? `<span style="font-family:var(--mono);color:var(--blue-light);margin-right:.5rem;">${m.atadasIdo}</span>` : ''}
              ${m.ugyfelNev || '–'} · ${m.kerekparAdat || '–'}
            </div>
            <div class="napi-item-szam">${m.munkalap}</div>
          </div>
          <div class="badge badge-blue">${m.osszeg ? m.osszeg + ' Ft' : '–'}</div>
        </div>
      `).join('')}
    `;

    // Kattintás → szerkesztőbe navigál
    panel.querySelectorAll('.napi-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.APP && window.APP.megnyitSzerkeszto) {
          window.APP.megnyitSzerkeszto(item.dataset.szam);
        }
      });
    });
  }

  return {
    init(containerId, munkak, onDayClick) {
      const now   = new Date();
      _containerId = containerId;
      _year        = now.getFullYear();
      _month       = now.getMonth();
      _munkak      = munkak || [];
      _onDayClick  = onDayClick;
      _build();
    },
    frissit(munkak) {
      _munkak = munkak || [];
      _build();
    },
  };
})();