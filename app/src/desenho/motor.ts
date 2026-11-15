/* eslint-disable */
// @ts-nocheck
/*
 * Motor da folha de desenho (só mouse e teclado, para o computador).
 * Desenha direto num <svg>, sem React, porque redesenha a cada movimento do mouse.
 * A tela screens/Desenho.tsx cria o motor, entrega as peças do orçamento e grava o que mudar.
 * Unidade da folha: 1 linha do caderno = 4 (1 unidade = 2 mm no A4 impresso). Todo ponto cai em meia linha
 * (Ctrl = um quarto). A posição das peças na folha é calculada (2 colunas, depois outra folha) só quando a
 * peça termina, para nada pular de lugar no meio do desenho.
 * Sem checagem de tipos: veio pronto e testado do protótipo; as contas ficam em lib/desenho.ts (com testes).
 */
import { batidas, corteReal, fmtGrupo, fmtGrupos, fmtMed, gruposMetr, numero, parseMed } from '../lib/desenho';
import { uid } from '../lib/format';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function criarFolha(host, svg, api) {
  const limpar = [];
  const ouvir = (alvo, ev, fn, opt) => { alvo.addEventListener(ev, fn, opt); limpar.push(() => alvo.removeEventListener(ev, fn, opt)); };

  /* ---------- janelas (padrões, atalhos, pedir nome) ---------- */
  const modalAberto = () => !!host.querySelector('.dz-fundo');
  function modal(op) {
    const f = document.createElement('div'); f.className = 'dz-fundo';
    f.innerHTML = '<div class="dz-modal' + (op.largo ? ' largo' : '') + '" role="dialog"><header><h2>' + esc(op.titulo) + '</h2><button class="dz-x" data-fechar title="Fechar (Esc)">×</button></header><div class="dz-corpo">' + op.html + '</div></div>';
    const m = { el: f, fechar() { document.removeEventListener('keydown', tecla, true); f.remove(); } };
    function tecla(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); m.fechar(); return; }
      if (op.tecla && !/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) && op.tecla(ev)) { ev.preventDefault(); ev.stopPropagation(); }
    }
    document.addEventListener('keydown', tecla, true);
    limpar.push(() => document.removeEventListener('keydown', tecla, true));
    f.addEventListener('mousedown', (ev) => { if (ev.target === f || ev.target.closest('[data-fechar]')) m.fechar(); });
    f.addEventListener('click', (ev) => { if (op.clique) op.clique(ev); });
    host.appendChild(f);
    return m;
  }
  function pedir(op, cb) {
    const m = modal({ titulo: op.titulo, html: '<label class="dz-campo"><span>' + esc(op.rotulo) + '</span><input type="text" value="' + esc(op.valor || '') + '" placeholder="' + esc(op.dica || '') + '"></label><div class="dz-acoes"><button class="btn" data-fechar>Cancelar</button><button class="btn primary" data-ok>Salvar</button></div>' });
    const inp = m.el.querySelector('input'), ok = () => { const v = inp.value; m.fechar(); cb(v); };
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ok(); } });
    m.el.querySelector('[data-ok]').addEventListener('click', ok);
    inp.focus(); inp.select();
  }

  const CA = {
    BOBINA_INTEIRA: 120, uid, esc, num: numero, parseMed, corte: corteReal, batidas, gruposMetr, fmtGrupo, fmtGrupos, fmtMed,
    fmt: (n, dec, max) => (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec || 0, maximumFractionDigits: max == null ? (dec || 0) : max }),
    db: { padroes: api.padroes }, salvar: () => api.mudou(), toast: (m) => api.toast(m), modal, pedir, modalAberto,
  };

  const G = CA.G = {
    PW: 105, PH: 148.5, PITCH: 156,          // página A4 e distância entre páginas na tela
    COLX: [12, 57], COLW: 43, TOP: 16, BOT: 144, GAP: 4, // duas colunas; espaço de 1 linha entre peças
    PEN: 0.32, FS: 2.5, FSC: 2.7, FSM: 3.4, FSB: 2.2
  };
  const FONTE = "'Segoe Print','Ink Free','Comic Sans MS',cursive";
  const TINTA = { preta: '#1c1a1b', azul: '#1a3c9e' };
  const VERM = '#c4201c', LAPIS = '#35343d';
  CA.TINTA = TINTA; CA.FONTE = FONTE;

  /* ---------- medir texto ---------- */
  let _ctx = null;
  function largura(txt, fs) {
    if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
    _ctx.font = '100px ' + FONTE;
    return _ctx.measureText(txt).width / 100 * fs;
  }
  // segmento cruza o retângulo?
  function segRet(ax, ay, bx, by, r) {
    let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
    const p = [-dx, dx, -dy, dy], q = [ax - r.x0, r.x1 - ax, ay - r.y0, r.y1 - ay];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
    }
    return true;
  }
  const cruza = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

  /* ---------- onde vai cada número de uma peça ---------- */
  CA.layoutPeca = function (p, opt) {
    opt = opt || {};
    const pts = p.pts, ns = pts.length - 1;
    let gx0 = 1e9, gy0 = 1e9, gx1 = -1e9, gy1 = -1e9, cx = 0, cy = 0;
    for (const q of pts) { gx0 = Math.min(gx0, q[0]); gy0 = Math.min(gy0, q[1]); gx1 = Math.max(gx1, q[0]); gy1 = Math.max(gy1, q[1]); cx += q[0]; cy += q[1]; }
    cx /= pts.length; cy /= pts.length;
    const segs = [];
    for (let i = 0; i < ns; i++) {
      const A = pts[i], B = pts[i + 1], dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
      segs.push({ i, A, B, len, ux: dx / len, uy: dy / len, mx: (A[0] + B[0]) / 2, my: (A[1] + B[1]) / 2 });
    }
    const rets = [], labels = new Array(ns);
    const colide = (r, proprio) => {
      const f = 0.22, R = { x0: r.x0 - f, y0: r.y0 - f, x1: r.x1 + f, y1: r.y1 + f };
      for (const o of rets) if (cruza(R, o)) return true;
      for (const t of segs) { if (t.i === proprio) continue; if (segRet(t.A[0], t.A[1], t.B[0], t.B[1], R)) return true; }
      return false;
    };
    // abas menores primeiro: são as que têm menos lugar pra pôr o número
    for (const s of segs.slice().sort((a, b) => a.len - b.len)) {
      const m = CA.parseMed(p.med[s.i]), txt = m ? m.txt : '';
      const w = largura(txt || '00', G.FS) + 0.2, h = G.FS * 0.8;
      let nx = -s.uy, ny = s.ux;
      let lado = (s.mx - cx) * nx + (s.my - cy) * ny;                 // lado de fora da peça
      if (Math.abs(lado) < 0.35) lado = Math.abs(ny) > 0.01 ? (ny < 0 ? 1 : -1) : (nx < 0 ? 1 : -1); // sem lado claro: em cima / à esquerda
      if (lado < 0) { nx = -nx; ny = -ny; }
      if (p.lado && p.lado[s.i] === -1) { nx = -nx; ny = -ny; }       // ele pediu esse número do outro lado (Alt + clique)
      const ext = (Math.abs(nx) * w + Math.abs(ny) * h) / 2;
      const desl = s.len >= 5 ? [0, s.len * 0.28, -s.len * 0.28] : [0];
      let esc = null, prim = null;
      busca:
      for (const dist of [0, 1.7, 3.4]) for (const sh of desl) for (const sg of [1, -1]) {
        const k = G.PEN / 2 + 0.45 + ext + dist;
        const bx = s.mx + s.ux * sh, by = s.my + s.uy * sh;
        const x = bx + nx * sg * k, y = by + ny * sg * k;
        const c = { x, y, w, h, txt, vazio: !txt, r: { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 }, guia: null };
        if (dist > 0) c.guia = [bx + nx * sg * (G.PEN / 2 + 0.3), by + ny * sg * (G.PEN / 2 + 0.3), x - nx * sg * (ext + 0.2), y - ny * sg * (ext + 0.2)];
        if (!prim) prim = c;
        if (!colide(c.r, s.i)) { esc = c; break busca; }
      }
      esc = esc || prim; labels[s.i] = esc; rets.push(esc.r);
    }
    const ink = { x0: gx0 - G.PEN / 2, y0: gy0 - G.PEN / 2, x1: gx1 + G.PEN / 2, y1: gy1 + G.PEN / 2 };
    const cresce = r => { ink.x0 = Math.min(ink.x0, r.x0); ink.y0 = Math.min(ink.y0, r.y0); ink.x1 = Math.max(ink.x1, r.x1); ink.y1 = Math.max(ink.y1, r.y1); };
    labels.forEach(l => { if (!l.vazio) cresce(l.r); });

    // C/50 em vermelho, em cima: o corte REAL, sem arredondar
    const ct = CA.corte(p); let c = null;
    if (ct.tem) {
      const txt = 'C/' + CA.fmtMed(ct.a) + (ct.conica ? '–' + CA.fmtMed(ct.b) : '');
      const w = largura(txt, G.FSC) + 0.3, h = G.FSC * 0.8;
      // fica em cima do desenho, no canto da esquerda. Se já tem número naquele lugar (ou vai ter),
      // sobe e fica em cima dele, como na folha da Tuca. Assim todo desenho começa alinhado na coluna.
      let y = gy0 - G.PEN / 2 - 0.8 - h / 2;
      let r = { x0: gx0, y0: y - h / 2, x1: gx0 + w, y1: y + h / 2 };
      // vale pra qualquer número naquela altura, mesmo longe: senão uma peça saía de um jeito e a outra de outro
      const naFaixa = labels.some(l => l.r.y0 < r.y1 + 0.2 && l.r.y1 > r.y0 - 0.2);
      if (naFaixa || colide(r, -1)) {
        const topo = Math.min.apply(null, [ink.y0].concat(labels.map(l => l.r.y0)));
        y = topo - 0.6 - h / 2; r = { x0: gx0, y0: y - h / 2, x1: gx0 + w, y1: y + h / 2 };
      }
      c = { x: gx0, y, txt, r };
      if (ct.maior > CA.BOBINA_INTEIRA) {   // não sai de uma bobina: avisa do lado
        c.aviso = 'passa de ' + CA.BOBINA_INTEIRA + '!'; c.ax = r.x1 + 0.9;
        r.x1 = c.ax + largura(c.aviso, G.FSB);
      }
    }
    // metragem do lado, com tracinho, na altura do meio do desenho
    const mlist = CA.gruposMetr(p.metr);       // "9+2" são dois grupos; "4x2,5" é um grupo de quatro peças
    let mlin = mlist.length ? ['– ' + CA.fmtGrupos(mlist)] : (p.placed ? ['– ?'] : []);
    const maisLarga = l => Math.max.apply(null, l.map(t => largura(t, G.FSM)));
    let mx = ink.x1 + 1.5;
    // duas metragens que não cabem na coluna: uma embaixo da outra, cada uma numa linha do caderno
    if (mlist.length > 1 && mx + maisLarga(mlin) - ink.x0 > G.COLW - 1) mlin = mlist.map((g, i) => (i ? '+ ' : '– ') + CA.fmtGrupo(g));
    const mw = mlin.length ? maisLarga(mlin) : largura('– 0,00', G.FSM), mh = G.FSM * 0.8, mdy = 4;
    const my = (gy0 + gy1) / 2 - (Math.max(1, mlin.length) - 1) * mdy / 2;
    const mret = () => ({ x0: mx, y0: my - mh / 2, x1: mx + mw, y1: my + (Math.max(1, mlin.length) - 1) * mdy + mh / 2 });
    if (c && cruza(mret(), c.r)) mx = c.r.x1 + 1.2;
    const m = { x: mx, y: my, dy: mdy, linhas: mlin, vazio: !mlist.length, tem: mlin.length > 0, r: mret() };
    if (c) cresce(c.r);
    if (m.tem) cresce(m.r);

    // marcações de batida (só quando pedir)
    let bat = null;
    if (opt.bat) {
      const linhas = CA.batidas(p);
      if (linhas) {
        const dy = G.FSB * 1.45, y = ink.y1 + 0.7 + dy / 2;
        const w = Math.max.apply(null, linhas.map(t => largura(t, G.FSB)));
        bat = { x: gx0, y, dy, linhas, r: { x0: gx0, y0: ink.y1 + 0.5, x1: gx0 + w, y1: ink.y1 + 0.7 + dy * linhas.length } };
        cresce(bat.r);
      }
    }
    return { labels, c, m, bat, ink, geo: { x0: gx0, y0: gy0, x1: gx1, y1: gy1 } };
  };

  /* ---------- arrumar as peças na folha: 2 colunas, depois próxima folha ---------- */
  CA.reflow = function (o, opt) {
    let pag = 0, col = 0, y = G.TOP;
    const pula = () => { col++; if (col > 1) { col = 0; pag++; } y = G.TOP; };
    const largas = {};   // peça da coluna da esquerda que é larga demais: a da direita desvia dela
    for (const p of o.pecas) {
      if (!p.placed) continue;
      const L = CA.layoutPeca(p, opt);
      const top = Math.floor(L.ink.y0 / 4) * 4, bot = Math.ceil(L.ink.y1 / 4) * 4, alt = bot - top;
      for (; ;) {
        if (y + alt > G.BOT && y > G.TOP) { pula(); continue; }
        if (col === 1) {
          const b = (largas[pag] || []).find(r => y < r[1] + G.GAP && y + alt + G.GAP > r[0]);
          if (b) { y = b[1] + G.GAP; continue; }
        }
        break;
      }
      p.oy = pag * G.PITCH + y - top;            // sempre múltiplo de uma linha: a peça não sai das linhas do caderno
      p.ox = G.COLX[col] - Math.floor(L.ink.x0);
      if (col === 0 && L.ink.x1 - Math.floor(L.ink.x0) > G.COLX[1] - G.COLX[0] - 2) (largas[pag] = largas[pag] || []).push([y, y + alt]);
      y += alt + G.GAP;
    }
    return { pag, col, y, pula };
  };

  /* ---------- desenho de uma peça (serve pra tela e pra impressão) ---------- */
  const n2 = v => Math.round(v * 100) / 100;
  CA.svgPeca = function (p, L, opt) {
    const cor = opt.cor;
    let s = '<g class="peca" data-pid="' + p.id + '" transform="translate(' + p.ox + ' ' + (p.oy - (opt.dy || 0)) + ')">';
    if (!opt.print) {
      const k = L.ink;
      s += '<rect x="' + n2(k.x0 - 0.8) + '" y="' + n2(k.y0 - 0.8) + '" width="' + n2(k.x1 - k.x0 + 1.6) + '" height="' + n2(k.y1 - k.y0 + 1.6) + '" rx="1" fill="#000" fill-opacity="0"' +
        (opt.ativo ? ' stroke="' + cor + '" stroke-opacity=".2" stroke-width=".12" stroke-dasharray=".9 .9"' : '') + '/>';
    }
    s += '<path d="M' + p.pts.map(q => q[0] + ' ' + q[1]).join('L') + '" fill="none" stroke="' + cor + '" stroke-width="' + G.PEN + '" stroke-linejoin="round" stroke-linecap="round"/>';
    L.labels.forEach((l, i) => {
      if (l.vazio || i === opt.semLabel) return;
      if (l.guia) s += '<path d="M' + l.guia.map(n2).join(' ').replace(/^(\S+ \S+) /, '$1L') + '" stroke="' + cor + '" stroke-width=".12" stroke-linecap="round" fill="none"/>';
      s += '<text data-k="med" data-i="' + i + '" x="' + n2(l.x) + '" y="' + n2(l.y) + '" font-size="' + G.FS + '" text-anchor="middle" dominant-baseline="central" fill="' + cor + '">' + CA.esc(l.txt) + '</text>';
    });
    if (L.c) s += '<text x="' + n2(L.c.x) + '" y="' + n2(L.c.y) + '" font-size="' + G.FSC + '" font-weight="700" dominant-baseline="central" fill="' + VERM + '">' + L.c.txt + '</text>';
    if (L.c && L.c.aviso) s += '<text x="' + n2(L.c.ax) + '" y="' + n2(L.c.y) + '" font-size="' + G.FSB + '" dominant-baseline="central" fill="' + VERM + '">' + L.c.aviso + '</text>';
    if (L.m.tem || opt.editMetr) {
      const falta = L.m.vazio && !opt.editMetr;
      (opt.editMetr ? ['–'] : L.m.linhas).forEach((t, i) => {
        s += '<text data-k="metr" x="' + n2(L.m.x) + '" y="' + n2(L.m.y + i * L.m.dy) + '" font-size="' + G.FSM + '" dominant-baseline="central" fill="' + (falta ? VERM : cor) + '"' + (falta ? ' fill-opacity=".55"' : '') + '>' + t + '</text>';
      });
    }
    if (L.bat) L.bat.linhas.forEach((t, i) => {
      s += '<text data-k="bat" x="' + n2(L.bat.x) + '" y="' + n2(L.bat.y + i * L.bat.dy) + '" font-size="' + G.FSB + '" dominant-baseline="central" fill="' + (opt.print ? '#000' : LAPIS) + '">' + CA.esc(t) + '</text>';
    });
    return s + '</g>';
  };

  /* ---------- folha de produção impressa: branca, sem pauta ---------- */
  CA.svgProducao = function (o, opt) {
    const c = JSON.parse(JSON.stringify(o));
    c.pecas = c.pecas.filter(p => p.pts.length > 1); c.pecas.forEach(p => { p.placed = true; });
    const f = CA.reflow(c, { bat: opt.bat });
    const cor = TINTA[o.caneta] || TINTA.preta;
    // lista do que vai junto (silicone, brocante, bocal...), como no papel
    const notas = opt.notas || [];
    let pag = f.pag, col = f.col, y = f.y;
    const notasPos = [];
    if (notas.length) {
      if (y + notas.length * 4 > G.BOT && y > G.TOP) { col++; if (col > 1) { col = 0; pag++; } y = G.TOP; }
      notas.forEach((t, i) => notasPos.push({ pag, x: G.COLX[col], y: y + 4 * i + 3, t }));
    }
    const npag = Math.max(pag, f.pag) + 1, out = [];
    const data = o.data ? o.data.split('-').reverse().slice(0, 2).join('/') : '';
    for (let g = 0; g < npag; g++) {
      let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 105 148.5" font-family="' + FONTE + '">';
      s += '<text x="57.5" y="10.4" text-anchor="middle" font-size="4.2" fill="' + cor + '">' + CA.esc(o.cliente || '') + '</text>';
      s += '<text x="100" y="10.4" text-anchor="end" font-size="2.2" fill="' + cor + '">' + data + ' · nº ' + o.num + (npag > 1 ? ' · folha ' + (g + 1) + '/' + npag : '') + '</text>';
      for (const p of c.pecas) if (Math.floor(p.oy / G.PITCH) === g) s += CA.svgPeca(p, CA.layoutPeca(p, { bat: opt.bat }), { cor, print: true, dy: g * G.PITCH });
      for (const n of notasPos) if (n.pag === g) s += '<text x="' + n.x + '" y="' + n.y + '" font-size="2.6" fill="' + cor + '">' + CA.esc(n.t) + '</text>';
      out.push(s + '</svg>');
    }
    return out;
  };

  // miniatura de um padrão
  CA.svgMini = function (pd) {
    const p = { id: 'm', pts: pd.pts, med: pd.med, metr: '', ox: 0, oy: 0, placed: false };
    const L = CA.layoutPeca(p, {}), k = L.ink, f = 1.2;
    return '<svg viewBox="' + n2(k.x0 - f) + ' ' + n2(k.y0 - f) + ' ' + n2(k.x1 - k.x0 + 2 * f) + ' ' + n2(k.y1 - k.y0 + 2 * f) + '" font-family="' + FONTE + '">' + CA.svgPeca(p, L, { cor: TINTA.preta, print: true }) + '</svg>';
  };

  /* =====================================================================
     O EDITOR
     ===================================================================== */
  const E = CA.E = { o: null, act: null, drag: null, inp: null, sug: null, bat: false, guia: null, hist: [], fut: [], tx: 0, ty: 0, s: 10, flow: null, pan: null, espaco: false, ult: null, raf: 0 };

  const peca = id => E.o.pecas.find(p => p.id === id);
  const ativa = () => (E.act ? peca(E.act) : null);
  const optL = () => ({ bat: E.bat });
  const refl = () => { E.flow = CA.reflow(E.o, optL()); };
  const paraU = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left - E.tx) / E.s, (e.clientY - r.top - E.ty) / E.s]; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /* ---------- histórico (Ctrl+Z) ---------- */
  const foto = () => ({ j: JSON.stringify(E.o), act: E.act });
  function restaura(f) {
    const n = JSON.parse(f.j);
    Object.keys(E.o).forEach(k => delete E.o[k]); Object.assign(E.o, n);
    E.act = f.act && peca(f.act) ? f.act : null; E.sug = null; E.guia = null;
    CA.salvar(); render();
  }
  function mut(fn) {
    E.hist.push(foto()); if (E.hist.length > 150) E.hist.shift();
    E.fut = []; fn(); CA.salvar(); render();
  }
  function desfazer() { if (E.inp) { fecharInput(false); return; } if (!E.hist.length) return; E.fut.push(foto()); restaura(E.hist.pop()); }
  function refazer() { if (!E.fut.length) return; E.hist.push(foto()); restaura(E.fut.pop()); }

  // termina a peça que está sendo desenhada e arruma a folha
  function fin() {
    const a = ativa();
    E.act = null; E.sug = null; E.guia = null;
    if (a) { if (a.pts.length < 2) E.o.pecas.splice(E.o.pecas.indexOf(a), 1); else a.placed = true; }
    refl(); CA.salvar();
  }
  function selecionar(pid) { if (E.act !== pid) { fin(); E.act = pid; } }

  /* ---------- desenhar na tela ---------- */
  function render() { if (E.raf) return; E.raf = requestAnimationFrame(() => { E.raf = 0; desenha(); }); }
  function papel(g, o, cor) {
    let s = '<g transform="translate(0 ' + g * G.PITCH + ')">';
    s += '<rect x=".5" y=".7" width="105" height="148.5" rx=".5" fill="#000" fill-opacity=".32"/>';
    s += '<rect width="105" height="148.5" rx=".5" fill="url(#papel)"/>';
    let d = ''; for (let y = 12; y <= 144; y += 4) d += 'M0 ' + y + 'H105';
    s += '<path d="' + d + '" stroke="#476fa6" stroke-opacity=".5" stroke-width=".13" fill="none"/>';
    s += '<path d="M10 0V148.5" stroke="#b23a33" stroke-opacity=".62" stroke-width=".17"/>';
    if (g === 0) {
      const edit = E.inp && E.inp.kind === 'cliente';
      if (!edit) s += '<text x="57.5" y="10.4" text-anchor="middle" font-size="4.2" fill="' + cor + '"' + (o.cliente ? '' : ' fill-opacity=".3"') + '>' + CA.esc(o.cliente || '') + '</text>';
      const data = o.data ? o.data.split('-').reverse().slice(0, 2).join('/') : '';
      s += '<text x="100" y="10.4" text-anchor="end" font-size="2.2" fill="' + cor + '" fill-opacity=".7">' + data + ' · nº ' + o.num + '</text>';
    } else s += '<text x="100" y="10.4" text-anchor="end" font-size="2.2" fill="' + cor + '" fill-opacity=".7">folha ' + (g + 1) + '</text>';
    return s + '</g>';
  }
  function desenha() {
    if (!E.o) return;
    const o = E.o, cor = TINTA[o.caneta] || TINTA.preta;
    let npag = (E.flow ? E.flow.pag : 0) + 1;
    for (const p of o.pecas) npag = Math.max(npag, Math.floor(p.oy / G.PITCH) + 1);
    let h = '<defs><linearGradient id="papel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dac7a4"/><stop offset=".55" stop-color="#d3bf9a"/><stop offset="1" stop-color="#c9b38c"/></linearGradient></defs>';
    h += '<g transform="translate(' + n2(E.tx) + ' ' + n2(E.ty) + ') scale(' + E.s + ')" font-family="' + FONTE + '">';
    for (let g = 0; g < npag; g++) h += papel(g, o, cor);
    for (const p of o.pecas) {
      const L = CA.layoutPeca(p, optL()), ed = E.inp && E.inp.pid === p.id ? E.inp : null;
      h += CA.svgPeca(p, L, { cor, ativo: p.id === E.act, semLabel: ed && ed.kind === 'med' ? ed.i : -1, editMetr: !!(ed && ed.kind === 'metr') });
    }
    const a = ativa();
    if (E.sug && a && E.sug.pid === a.id) {      // sugestão do outro lado: tracejado clarinho
      const P = a.pts[E.sug.ponta === 'fim' ? a.pts.length - 1 : 0];
      const d = 'M' + [P].concat(E.sug.pts).map(q => (q[0] + a.ox) + ' ' + (q[1] + a.oy)).join('L');
      h += '<path d="' + d + '" fill="none" stroke="' + cor + '" stroke-opacity=".3" stroke-width="' + G.PEN + '" stroke-dasharray="1 1.1" stroke-linecap="round" stroke-linejoin="round"/>';
      h += '<path data-k="sug" d="' + d + '" fill="none" stroke="#000" stroke-opacity="0" stroke-width="3"/>';
    }
    const dg = E.drag;
    if (dg && dg.moveu) {
      if (dg.modo === 'vert') {
        const viz = [dg.idx - 1, dg.idx + 1].filter(i => i >= 0 && i < a.pts.length).map(i => [a.pts[i][0] + a.ox, a.pts[i][1] + a.oy]);
        for (const v of viz) h += '<path d="M' + v[0] + ' ' + v[1] + 'L' + dg.ate[0] + ' ' + dg.ate[1] + '" stroke="' + cor + '" stroke-opacity=".5" stroke-width="' + G.PEN + '" stroke-dasharray="1 1" stroke-linecap="round"/>';
      } else h += '<path d="M' + dg.de[0] + ' ' + dg.de[1] + 'L' + dg.ate[0] + ' ' + dg.ate[1] + '" stroke="' + cor + '" stroke-width="' + G.PEN + '" stroke-linecap="round"/>';
    }
    svg.innerHTML = h + '</g>';
    posInput();
    if (api.desenhou) api.desenhou();
  }

  function enquadra() {
    const w = host.clientWidth, larg = w;
    E.s = Math.max(5, Math.min(10, (larg - 40) / G.PW));
    E.tx = Math.max(16, (larg - G.PW * E.s) / 2); E.ty = 54;
    E.auto = { s: E.s, tx: E.tx };
  }
  // abriu/fechou o painel: se você não mexeu no zoom, a folha se ajeita no espaço que sobrou
  function reenquadra() {
    if (!E.auto || E.s !== E.auto.s || E.tx !== E.auto.tx) return;
    const ty = E.ty; enquadra(); E.ty = ty;
  }
  // deixa à vista o lugar da próxima peça
  function verProxima() {
    const f = E.flow; if (!f) return;
    const w = host.clientWidth, hh = host.clientHeight;
    const sy = E.ty + (f.pag * G.PITCH + f.y) * E.s, sx = E.tx + G.COLX[f.col] * E.s;
    if (sy > hh * 0.7 || sy < 70) E.ty += hh * 0.42 - sy;
    if (sx > w - 260 || sx < 0) E.tx += w * 0.3 - sx;
    render();
  }
  function verPeca(p) {
    const L = CA.layoutPeca(p, optL()), hh = host.clientHeight, w = host.clientWidth;
    const y0 = E.ty + (p.oy + L.ink.y0) * E.s, y1 = E.ty + (p.oy + L.ink.y1) * E.s, x1 = E.tx + (p.ox + L.ink.x1) * E.s, x0 = E.tx + (p.ox + L.ink.x0) * E.s;
    if (y1 > hh - 40) E.ty -= y1 - hh * 0.6; else if (y0 < 60) E.ty += 90 - y0;
    if (x1 > w - 20) E.tx -= x1 - w + 60; else if (x0 < 10) E.tx += 40 - x0;
  }

  /* ---------- digitar a medida em cima da folha ---------- */
  function abrirInput(sp) {
    if (E.inp && !fecharInput(true)) return;
    const el = document.createElement('input');
    el.type = 'text'; el.className = 'finp finp-' + sp.kind; el.autocomplete = 'off'; el.spellcheck = false;
    const p = sp.pid && peca(sp.pid);
    el.value = sp.kind === 'med' ? (p.med[sp.i] || '') : sp.kind === 'metr' ? (p.metr || '').replace(/\s/g, '') : (E.o.cliente || '');
    el.style.color = sp.kind === 'cliente' || sp.kind === 'med' || sp.kind === 'metr' ? (TINTA[E.o.caneta] || TINTA.preta) : '';
    sp.el = el; E.inp = sp; host.appendChild(el);
    el.addEventListener('input', () => {
      if (sp.kind === 'med') el.value = el.value.replace(/[^\d.,\/]/g, '');
      if (sp.kind === 'metr') el.value = el.value.replace(/[^\d.,+xX*×crpCRP]/g, '');   // 9+2, 4x2,5 e a letra do nome no fim
      posInput();
    });
    el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); fecharInput(true, 'enter'); }
      else if (ev.key === 'Tab') { ev.preventDefault(); ev.stopPropagation(); fecharInput(true, ev.shiftKey ? 'tabv' : 'tab'); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fecharInput(false); }
      else if (!/^F\d+$/.test(ev.key) && !(ev.ctrlKey && /^[pd]$/i.test(ev.key))) ev.stopPropagation();
    });
    el.addEventListener('blur', () => setTimeout(() => { if (E.inp === sp) fecharInput(true, 'blur'); }, 0));
    desenha(); el.focus(); el.select();
  }
  function posInput() {
    const sp = E.inp; if (!sp) return;
    let x, y, fs, centro = true;
    if (sp.kind === 'cliente') { x = 57.5; y = 9; fs = 4.2; }
    else {
      const p = peca(sp.pid); if (!p) return;
      const L = CA.layoutPeca(p, optL());
      if (sp.kind === 'med') { const l = L.labels[sp.i]; x = p.ox + l.x; y = p.oy + l.y; fs = G.FS; }
      else { x = p.ox + L.m.x + largura('– ', G.FSM); y = p.oy + L.m.y; fs = G.FSM; centro = false; }
    }
    const el = sp.el, min = sp.kind === 'cliente' ? 'nome do cliente' : sp.kind === 'metr' ? '0,00' : '00';
    el.style.fontSize = (fs * E.s) + 'px';
    el.style.width = (largura(el.value.length >= min.length ? el.value : min, fs) * E.s + fs * E.s * 0.7) + 'px';
    el.style.left = (E.tx + x * E.s) + 'px'; el.style.top = (E.ty + y * E.s) + 'px';
    el.style.transform = centro ? 'translate(-50%,-50%)' : 'translate(0,-50%)';
    el.style.textAlign = centro ? 'center' : 'left';
  }
  function treme(el) { el.classList.remove('treme'); void el.offsetWidth; el.classList.add('treme'); }

  // na hora de preencher um padrão: aba deitada estica junto com a medida, no mesmo jeito do padrão
  function esticaDeitada(p, i, antes, depois) {
    const a = CA.parseMed(antes), d = CA.parseMed(depois);
    if (!a || !d || a.a !== a.b || d.a !== d.b || a.a === d.a) return;
    const A = p.pts[i], B = p.pts[i + 1];
    if (A[1] !== B[1]) return;
    const len = Math.abs(B[0] - A[0]); if (len < 4) return;
    const novo = Math.max(4, Math.round(len * d.a / a.a)), dx = (novo - len) * Math.sign(B[0] - A[0]);
    for (let k = i + 1; k < p.pts.length; k++) p.pts[k][0] += dx;
  }

  function fecharInput(ok, via) {
    const sp = E.inp; if (!sp) return true;
    let v = sp.el.value.trim();
    let med = null, metr = [], nomeDado = null;
    if (ok && sp.kind === 'med' && v) { med = CA.parseMed(v); if (!med) { treme(sp.el); return false; } }
    if (ok && sp.kind === 'metr') {
      const mm = /^(.*?)([crp])$/i.exec(v);        // letra no fim já dá o nome da peça: c = calha, r = rufo, p = pingadeira
      if (mm) { nomeDado = { c: 'Calha', r: 'Rufo', p: 'Pingadeira' }[mm[2].toLowerCase()]; v = mm[1].trim(); }
      if (v) { metr = CA.gruposMetr(v); if (!metr.length) { treme(sp.el); return false; } }
    }
    E.inp = null; sp.el.remove();
    const p = sp.pid && peca(sp.pid);
    if (!ok) {
      if (sp.novo && E.hist.length) restaura(E.hist.pop());   // Esc numa linha nova: apaga a linha
      E.guia = null; render(); return true;
    }
    if (sp.kind === 'cliente') { E.o.cliente = v; CA.salvar(); render(); return true; }
    if (sp.kind === 'med') {
      const novo = med ? med.txt : null, antes = p.med[sp.i];
      if (novo !== antes) {
        const f = () => { if (E.guia && E.guia.estica) esticaDeitada(p, sp.i, antes, novo); p.med[sp.i] = novo; };
        if (sp.novo) { f(); CA.salvar(); } else mut(f);
      }
      if (sp.novo) calcSug(p, sp.ponta);
      if (via === 'tab' && E.sug && !E.guia) aceitarSug();
      if (E.guia && E.guia.pid === p.id) {
        const ns = p.med.length;
        if (via === 'tab') { abrirInput({ kind: 'med', pid: p.id, i: (sp.i + 1) % ns }); return true; }
        if (via === 'tabv') { abrirInput({ kind: 'med', pid: p.id, i: (sp.i + ns - 1) % ns }); return true; }
        if (via === 'enter') { refl(); abrirInput({ kind: 'metr', pid: p.id }); return true; }
        E.guia = null;
      }
      render(); return true;   // a folha só é rearrumada quando a peça termina, pra nada pular de lugar no meio do desenho
    }
    if (sp.kind === 'metr') {
      const txt = metr.length ? CA.fmtGrupos(metr) : (nomeDado ? (p.metr || '') : '');
      if (txt !== (p.metr || '') || (nomeDado && nomeDado !== p.nome)) mut(() => { p.metr = txt; if (nomeDado) p.nome = nomeDado; });
      if (nomeDado) CA.toast('Peça marcada como ' + nomeDado);
      if (via === 'enter' || via === 'tab') { fin(); verProxima(); }
      render(); return true;
    }
    return true;
  }

  /* ---------- sugestão do outro lado (peça simétrica) ---------- */
  function calcSug(p, ponta) {
    E.sug = null;
    const ns = p.pts.length - 1; if (ns < 2 || p.med.some(m => !m)) return;
    const fim = ponta !== 'ini';
    const A = p.pts[fim ? ns - 1 : 1], B = p.pts[fim ? ns : 0];
    const len = dist(A, B);
    for (let i = 0; i < ns; i++) { if (i === (fim ? ns - 1 : 0)) continue; if (dist(p.pts[i], p.pts[i + 1]) >= len) return; }  // só quando a última aba é a maior (o "meio")
    const ux = (B[0] - A[0]) / len, uy = (B[1] - A[1]) / len, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    const idx = []; if (fim) for (let i = ns - 2; i >= 0; i--) idx.push(i); else for (let i = 2; i <= ns; i++) idx.push(i);
    const pts = [];
    for (const i of idx) {
      const P = p.pts[i], t = (P[0] - mx) * ux + (P[1] - my) * uy;
      const x = P[0] - 2 * t * ux, y = P[1] - 2 * t * uy;
      if (Math.abs(x - Math.round(x)) > 0.02 || Math.abs(y - Math.round(y)) > 0.02) return;
      pts.push([Math.round(x), Math.round(y)]);
    }
    const med = fim ? p.med.slice(0, ns - 1).reverse() : p.med.slice(1);
    const lado = p.lado ? (fim ? p.lado.slice(0, ns - 1).reverse() : p.lado.slice(1)) : null;
    E.sug = { pid: p.id, ponta: fim ? 'fim' : 'ini', pts, med, lado };
  }
  function aceitarSug() {
    const s = E.sug, p = s && peca(s.pid); if (!p) return;
    mut(() => {
      const lado = p.lado ? (s.lado || s.med.map(() => 1)) : null;   // o lado de cada número acompanha a aba espelhada
      if (s.ponta === 'fim') { p.pts.push.apply(p.pts, s.pts); p.med.push.apply(p.med, s.med); if (lado) p.lado.push.apply(p.lado, lado); }
      else { p.pts.unshift.apply(p.pts, s.pts.slice().reverse()); p.med.unshift.apply(p.med, s.med.slice().reverse()); if (lado) p.lado.unshift.apply(p.lado, lado.slice().reverse()); }
      E.sug = null;
    });
  }

  /* ---------- mouse ---------- */
  function onDown(e) {
    if (CA.modalAberto && CA.modalAberto()) return;
    if (e.button === 1 || e.button === 2 || (e.button === 0 && E.espaco)) { E.pan = { x: e.clientX, y: e.clientY, tx: E.tx, ty: E.ty }; e.preventDefault(); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    if (E.inp && !fecharInput(true)) return;
    const u = paraU(e), sn = [prende(u[0], e), prende(u[1], e)], a = ativa();
    let d = null;
    if (a) {
      const abs = i => [a.pts[i][0] + a.ox, a.pts[i][1] + a.oy], ult = a.pts.length - 1;
      if (e.altKey) {                               // Alt + arrastar um canto: mexe o canto
        let melhor = -1, md = 2.6;
        for (let i = 0; i <= ult; i++) { const q = dist(u, abs(i)); if (q < md) { md = q; melhor = i; } }
        if (melhor >= 0) d = { modo: 'vert', idx: melhor, de: abs(melhor) };
      }
      if (!d) {                                     // perto de uma das duas pontas: continua a peça
        const d0 = dist(u, abs(0)), d1 = dist(u, abs(ult));
        if (Math.min(d0, d1) <= 3) d = d1 <= d0 ? { modo: 'ext', ponta: 'fim', de: abs(ult) } : { modo: 'ext', ponta: 'ini', de: abs(0) };
      }
    }
    if (!d) d = { modo: 'novo', de: sn };
    d.ate = d.de.slice(); d.moveu = false; d.cx = e.clientX; d.cy = e.clientY;
    E.drag = d;
  }
  // A linha encaixa de meia em meia linha do caderno. Segurando Ctrl, de quarto em quarto (ajuste fino).
  function prende(v, e) { const g = e.ctrlKey ? 1 : 2; return Math.round(v / g) * g; }
  // perto de uma ponta da peça que está sendo desenhada, o cursor muda: a linha vai sair dali
  function cursorPerto(e) {
    const a = ativa(); let perto = false;
    if (a && svg.contains(e.target)) {
      const u = paraU(e), ult = a.pts.length - 1;
      perto = Math.min(dist(u, [a.pts[0][0] + a.ox, a.pts[0][1] + a.oy]), dist(u, [a.pts[ult][0] + a.ox, a.pts[ult][1] + a.oy])) <= 3;
    }
    if (perto !== E.perto) { E.perto = perto; svg.style.cursor = perto ? 'cell' : ''; }
  }
  function onMove(e) {
    if (E.pan) { E.tx = E.pan.tx + e.clientX - E.pan.x; E.ty = E.pan.ty + e.clientY - E.pan.y; render(); return; }
    const d = E.drag; if (!d) { if (E.o) cursorPerto(e); return; }
    const u = paraU(e); let x = prende(u[0], e), y = prende(u[1], e);
    if (e.shiftKey && d.modo !== 'vert') { if (Math.abs(x - d.de[0]) >= Math.abs(y - d.de[1])) y = d.de[1]; else x = d.de[0]; }  // Shift: reta
    d.ate = [x, y];
    if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) > 4) d.moveu = true;
    render();
  }
  function onUp(e) {
    if (E.pan) { E.pan = null; return; }
    const d = E.drag; if (!d) return;
    E.drag = null;
    if (!d.moveu || dist(d.de, d.ate) < 1) { clique(e); render(); return; }
    E.sug = null;
    if (d.modo === 'vert') { const a = ativa(); mut(() => { a.pts[d.idx] = [d.ate[0] - a.ox, d.ate[1] - a.oy]; }); return; }
    let pid, i, ponta = 'fim';
    if (d.modo === 'novo') {
      mut(() => {
        fin();
        const oy = Math.floor(d.de[1] / 4) * 4;
        const p = { id: CA.uid(), nome: '', pts: [[0, d.de[1] - oy], [d.ate[0] - d.de[0], d.ate[1] - oy]], med: [null], metr: '', ox: d.de[0], oy, placed: false, flip: false };
        E.o.pecas.push(p); E.act = p.id; pid = p.id; i = 0;
      });
    } else {
      const a = ativa(); pid = a.id; ponta = d.ponta;
      mut(() => {
        const q = [d.ate[0] - a.ox, d.ate[1] - a.oy];
        if (ponta === 'fim') { a.pts.push(q); a.med.push(null); if (a.lado) a.lado.push(1); i = a.med.length - 1; }
        else { a.pts.unshift(q); a.med.unshift(null); if (a.lado) a.lado.unshift(1); i = 0; }
      });
    }
    abrirInput({ kind: 'med', pid, i, novo: true, ponta });
  }
  function clique(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY), agora = Date.now();
    const duplo = E.ult && agora - E.ult.t < 420 && Math.hypot(e.clientX - E.ult.x, e.clientY - E.ult.y) < 7;
    E.ult = duplo ? null : { t: agora, x: e.clientX, y: e.clientY };
    const k = el && el.closest ? el.closest('[data-k]') : null, g = el && el.closest ? el.closest('[data-pid]') : null;
    const tipo = k && k.dataset.k;
    if (tipo === 'sug') { aceitarSug(); return; }
    if (g) {
      const pid = g.dataset.pid, p = peca(pid);
      selecionar(pid);
      if (e.altKey && tipo === 'med') {             // Alt + clique no número: joga ele pro outro lado da aba
        const i = +k.dataset.i;
        mut(() => { if (!p.lado || p.lado.length !== p.med.length) p.lado = p.med.map(() => 1); p.lado[i] = -p.lado[i]; });
        return;
      }
      if (tipo === 'metr' && (duplo || !CA.gruposMetr(p.metr).length)) { abrirInput({ kind: 'metr', pid }); return; }
      if (duplo && tipo === 'med') { abrirInput({ kind: 'med', pid, i: +k.dataset.i }); return; }
      if (duplo && tipo === 'bat') { mut(() => { p.flip = !p.flip; }); return; }
      return;
    }
    fin();
  }
  function onWheel(e) {
    e.preventDefault();
    const r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (e.shiftKey) { E.ty -= (e.deltaY || e.deltaX) * (e.deltaMode === 1 ? 33 : 1); render(); return; }   // Shift + rodinha: sobe e desce a folha
    const f = Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 33 : 1)), ns = Math.max(2.5, Math.min(60, E.s * f)), k = ns / E.s;
    E.tx = mx - (mx - E.tx) * k; E.ty = my - (my - E.ty) * k; E.s = ns;   // zoom no ponto onde o mouse está
    render();
  }

  /* ---------- padrões (meu jeito de desenhar uma peça) ---------- */
  function salvarPadrao() {
    const a = ativa(); if (!a || a.pts.length < 2) { CA.toast('Clique numa peça primeiro, depois F8.'); return; }
    CA.pedir({ titulo: 'Salvar meu jeito como padrão', rotulo: 'Nome da peça', valor: a.nome || '', dica: 'Ex.: Pingadeira dupla, Rufo de encosto' }, nome => {
      nome = nome.trim(); if (!nome) return;
      const mx = Math.min.apply(null, a.pts.map(q => q[0])), my = Math.floor(Math.min.apply(null, a.pts.map(q => q[1])) / 4) * 4;
      const pd = { id: CA.uid(), nome, pts: a.pts.map(q => [q[0] - mx, q[1] - my]), med: a.med.slice() };
      if (a.lado && a.lado.length === a.med.length) pd.lado = a.lado.slice();
      const i = CA.db.padroes.findIndex(x => x.nome.toLowerCase() === nome.toLowerCase());
      if (i >= 0) CA.db.padroes[i] = pd; else CA.db.padroes.push(pd);
      if (!a.nome) a.nome = nome;
      CA.salvar(); render();
      CA.toast('Padrão “' + nome + '” salvo. Aperte P pra usar.');
    });
  }
  function novaDePadrao(pd, depoisDe) {
    let pid;
    mut(() => {
      fin();
      const p = { id: CA.uid(), nome: pd.nome || '', pts: pd.pts.map(q => q.slice()), med: pd.med.slice(), metr: '', ox: 0, oy: 0, placed: true, flip: false };
      if (pd.lado && pd.lado.length === pd.med.length) p.lado = pd.lado.slice();
      const i = depoisDe ? E.o.pecas.indexOf(depoisDe) : -1;
      if (i >= 0) E.o.pecas.splice(i + 1, 0, p); else E.o.pecas.push(p);
      E.act = p.id; pid = p.id; refl();
    });
    const p = peca(pid); verPeca(p);
    E.guia = { pid, estica: true };
    let maior = 0, ml = -1;                         // começa pela aba maior, que é a que mais muda
    for (let i = 0; i < p.med.length; i++) { const l = dist(p.pts[i], p.pts[i + 1]); if (l > ml) { ml = l; maior = i; } }
    abrirInput({ kind: 'med', pid, i: maior });
  }
  function paleta() {
    const ps = CA.db.padroes;
    const corpo = ps.length
      ? '<div class="pads">' + ps.map((pd, i) => '<button class="pad" data-i="' + i + '">' + CA.svgMini(pd) + '<span>' + (i < 9 ? '<kbd>' + (i + 1) + '</kbd>' : '') + CA.esc(pd.nome) + '</span><i class="pad-x" data-x="' + i + '" title="Apagar este padrão">×</i></button>').join('') + '</div>'
      : '<p class="vazio">Nenhum padrão salvo ainda.<br>Desenhe uma peça do seu jeito e aperte <kbd>F8</kbd>.</p>';
    const m = CA.modal({
      titulo: 'Meus padrões', html: corpo + '<p class="rodape-modal">Aperte o número ou clique. A peça entra na folha e você só digita as medidas: <kbd>Tab</kbd> passa pra próxima aba, <kbd>Enter</kbd> vai pra metragem.</p>', largo: true,
      tecla: ev => { const n = parseInt(ev.key, 10); if (n >= 1 && n <= ps.length) { m.fechar(); novaDePadrao(ps[n - 1]); return true; } },
      clique: ev => {
        const x = ev.target.closest('[data-x]');
        if (x) { ps.splice(+x.dataset.x, 1); CA.salvar(); m.fechar(); paleta(); return; }
        const b = ev.target.closest('[data-i]'); if (b) { m.fechar(); novaDePadrao(ps[+b.dataset.i]); }
      }
    });
  }
  function ajuda() {
    const L = [
      ['Desenhar', 'Clica, arrasta, solta e digita a medida. Segurar <kbd>Shift</kbd> deixa a linha reta.'],
      ['Continuar a peça', 'Começa a próxima linha em qualquer uma das duas pontas.'],
      ['Outro lado', 'Quando aparecer o tracejado clarinho: <kbd>Tab</kbd> ou um clique nele aceita.'],
      ['Cônica', 'Digita as duas medidas com barra: <kbd>13/10</kbd>.'],
      ['Terminar a peça', '<kbd>Enter</kbd> e digita a metragem (<kbd>9+2</kbd> pra duas medidas). <kbd>Enter</kbd> de novo.'],
      ['Corrigir', 'Dois cliques no número ou na metragem. <kbd>Ctrl</kbd> <kbd>Z</kbd> desfaz. <kbd>Alt</kbd> + arrastar um canto mexe o canto.'],
      ['Apagar / copiar', 'Clica na peça: <kbd>Delete</kbd> apaga, <kbd>Ctrl</kbd> <kbd>D</kbd> faz outra igual. <kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd> muda a ordem.'],
      ['Meus padrões', '<kbd>F8</kbd> salva o jeito da peça. <kbd>P</kbd> abre os padrões.'],
      ['Batidas', '<kbd>F7</kbd> mostra/esconde as marcações. Dois cliques nelas inverte o lado.'],
      ['Caneta', '<kbd>C</kbd> troca entre preta e azul.'],
      ['Folha', 'Rodinha dá zoom onde o mouse está. <kbd>Shift</kbd> + rodinha sobe e desce. Botão direito (ou <kbd>Espaço</kbd>) + arrastar move a folha. <kbd>Home</kbd> volta ao tamanho normal.'],
      ['Nome da peça', 'No fim da metragem, a letra dá o nome: <kbd>5,3c</kbd> calha, <kbd>3r</kbd> rufo, <kbd>6p</kbd> pingadeira.'],
      ['Vários iguais', 'Metragem <kbd>4x2,5</kbd> são quatro peças de 2,50.'],
      ['Espelhar', 'Clica na peça e aperta <kbd>E</kbd>. <kbd>Alt</kbd> + clique num número joga ele pro outro lado da aba.'],
      ['Ajuste fino', 'A linha encaixa de meia em meia linha do caderno. Segurando <kbd>Ctrl</kbd>, de quarto em quarto.'],
      ['Imprimir', '<kbd>Ctrl</kbd> <kbd>P</kbd> imprime a folha de produção.']
    ];
    CA.modal({ titulo: 'Atalhos', largo: true, html: '<dl class="atalhos">' + L.map(l => '<dt>' + l[0] + '</dt><dd>' + l[1] + '</dd>').join('') + '</dl>' });
  }

  /* ---------- teclado ---------- */
  function espelhar(a) {   // vira a peça de lado (esquerda ↔ direita)
    const xs = a.pts.map((q) => q[0]), soma = Math.min.apply(null, xs) + Math.max.apply(null, xs);
    mut(() => { a.pts = a.pts.map((q) => [soma - q[0], q[1]]); E.sug = null; });
  }
  function onKey(e) {
    if (!E.o) return;
    if (modalAberto()) return;
    const t = e.target, digitando = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (k === 'Escape' && E.drag) { E.drag = null; render(); return; }          // Esc no meio do traço: desiste da linha
    if (k === 'F1') { e.preventDefault(); ajuda(); return; }
    if (ctrl && /^p$/i.test(k)) { e.preventDefault(); if (E.inp) fecharInput(true); fin(); render(); api.imprimir(E.bat); return; }
    if (ctrl && /^s$/i.test(k)) { e.preventDefault(); api.toast('Tudo salvo. O sistema salva sozinho.'); return; }
    if (k === 'F7') { e.preventDefault(); E.bat = !E.bat; refl(); render(); api.toast(E.bat ? 'Marcações de batida: aparecendo' : 'Marcações de batida: escondidas'); return; }
    if (k === 'F8') { e.preventDefault(); if (E.inp) fecharInput(true); salvarPadrao(); return; }
    if (k === 'F9') { e.preventDefault(); if (E.inp) fecharInput(true); paleta(); return; }
    if (ctrl && /^d$/i.test(k)) {
      e.preventDefault(); if (E.inp) fecharInput(true);
      const a = ativa() || E.o.pecas[E.o.pecas.length - 1];                       // sem peça clicada: copia a última
      if (a) novaDePadrao({ nome: a.nome, pts: a.pts, med: a.med, lado: a.lado }, a);
      return;
    }
    if (digitando) return;
    if (k === ' ') { E.espaco = true; host.classList.add('movendo'); e.preventDefault(); return; }
    if (ctrl && /^z$/i.test(k)) { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); return; }
    if (ctrl && /^y$/i.test(k)) { e.preventDefault(); refazer(); return; }
    if (ctrl) return;
    const a = ativa();
    if (k === 'Enter') { e.preventDefault(); if (a) abrirInput({ kind: 'metr', pid: a.id }); return; }
    if (k === 'Tab') { e.preventDefault(); if (E.sug) aceitarSug(); return; }
    if (k === 'Escape') { fin(); render(); return; }
    if (k === 'Delete' && a) { e.preventDefault(); mut(() => { E.o.pecas.splice(E.o.pecas.indexOf(a), 1); E.act = null; E.sug = null; refl(); }); return; }
    if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown') && a) {
      e.preventDefault();
      const i = E.o.pecas.indexOf(a), j = i + (k === 'ArrowUp' ? -1 : 1);
      if (j >= 0 && j < E.o.pecas.length) mut(() => { E.o.pecas.splice(i, 1); E.o.pecas.splice(j, 0, a); a.placed = true; refl(); });
      return;
    }
    if (/^e$/i.test(k) && a) { e.preventDefault(); espelhar(a); return; }
    if (/^p$/i.test(k)) { e.preventDefault(); paleta(); return; }
    if (/^c$/i.test(k)) { E.o.caneta = E.o.caneta === 'azul' ? 'preta' : 'azul'; CA.salvar(); render(); return; }
    if (k === 'Home') { enquadra(); render(); return; }
    const passo = host.clientHeight * 0.6;
    if (k === 'PageDown' || k === 'ArrowDown') { E.ty -= k === 'PageDown' ? passo : 80; render(); }
    else if (k === 'PageUp' || k === 'ArrowUp') { E.ty += k === 'PageUp' ? passo : 80; render(); }
    else if (k === 'ArrowLeft') { E.tx += 80; render(); }
    else if (k === 'ArrowRight') { E.tx -= 80; render(); }
  }
  function onKeyUp(e) { if (e.key === ' ') { E.espaco = false; host.classList.remove('movendo'); } }

  /* ---------- ligar / desligar ---------- */
  ouvir(svg, 'mousedown', onDown);
  ouvir(window, 'mousemove', onMove);
  ouvir(window, 'mouseup', onUp);
  ouvir(svg, 'wheel', onWheel, { passive: false });
  ouvir(svg, 'contextmenu', (e) => e.preventDefault());
  ouvir(document, 'keydown', onKey);
  ouvir(document, 'keyup', onKeyUp);
  ouvir(window, 'resize', () => { if (E.o) { reenquadra(); render(); } });

  return {
    /** começa a desenhar neste orçamento: { cliente, data, num, caneta, pecas } (o objeto é alterado no lugar) */
    abrir(o) {
      E.o = o; E.act = null; E.sug = null; E.guia = null; E.inp = null; E.drag = null; E.hist = []; E.fut = []; E.bat = false;
      o.pecas.forEach((p) => { p.placed = true; if (p.lado && p.lado.length !== p.med.length) delete p.lado; });
      refl(); enquadra(); desenha();
    },
    /** os dados mudaram por fora (nuvem): troca as peças se ninguém está no meio de um traço */
    ocupado: () => !!(E.drag || E.inp || E.act),
    trocar(o) { E.o = o; E.act = null; E.sug = null; E.guia = null; E.hist = []; E.fut = []; o.pecas.forEach((p) => { p.placed = true; }); refl(); render(); },
    /** termina a peça em andamento (antes de gravar pela última vez ou imprimir) */
    terminar() { if (E.inp) fecharInput(true); fin(); },
    paginasProducao: (o, opt) => CA.svgProducao(o, opt),
    ajuda, paleta, render,
    batidas: () => E.bat,
    destruir() { if (E.inp) E.inp.el.remove(); E.inp = null; if (E.raf) cancelAnimationFrame(E.raf); limpar.forEach((f) => f()); host.querySelectorAll('.dz-fundo').forEach((x) => x.remove()); E.o = null; },
  };
}
