// 极简 PDF 生成器：A4、嵌入中文字体子集、自动换行、表格分页、页码
import zlib from 'node:zlib';
import { TTFont } from './ttf.js';

const A4 = { portrait: [595.28, 841.89], landscape: [841.89, 595.28] };
const fontCache = new Map();
function loadFont(path) {
  if (!fontCache.has(path)) fontCache.set(path, new TTFont(path));
  return fontCache.get(path);
}

function hexColor(c) {
  if (!c) return [0, 0, 0];
  const h = c.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}
const num = (n) => (Math.round(n * 100) / 100).toString();

class FontUse {
  constructor(name, ttf) {
    this.name = name; this.ttf = ttf;
    this.newIds = new Map([[0, 0]]); // 原 gid → 新 gid
    this.order = [0];
    this.unicode = new Map();         // 新 gid → 字符
  }
  id(cp) {
    const g = this.ttf.glyphFor(cp);
    let n = this.newIds.get(g);
    if (n === undefined) { n = this.order.length; this.order.push(g); this.newIds.set(g, n); }
    if (!this.unicode.has(n)) this.unicode.set(n, cp);
    return n;
  }
}

export class PDFDoc {
  constructor({ fonts, orientation = 'portrait', margins = { top: 56, bottom: 56, left: 50, right: 50 }, title = '', onPageStart } = {}) {
    this.fonts = { regular: new FontUse('F1', loadFont(fonts.regular)), bold: new FontUse('F2', loadFont(fonts.bold || fonts.regular)) };
    this.orientation = orientation;
    this.margins = margins;
    this.pages = [];
    this.title = title;
    this.onPageStart = onPageStart;
    this.addPage();
  }

  get pageWidth() { return this.page.size[0]; }
  get pageHeight() { return this.page.size[1]; }
  get contentWidth() { return this.pageWidth - this.margins.left - this.margins.right; }
  get bottomLimit() { return this.pageHeight - this.margins.bottom; }

  addPage(orientation) {
    const size = A4[orientation || this.orientation];
    this.page = { size, ops: [] };
    this.pages.push(this.page);
    this.y = this.margins.top;
    if (this.onPageStart) this.onPageStart(this, this.pages.length);
    return this;
  }

  ensureSpace(h) {
    if (this.y + h > this.bottomLimit) { this.addPage(); return true; }
    return false;
  }

  _op(s) { this.page.ops.push(s); }

  /** 把字符串切成同一字体的片段（粗体缺字时回退到常规字体） */
  _runs(str, bold) {
    const runs = [];
    for (const ch of String(str)) {
      const cp = ch.codePointAt(0);
      let f = bold ? this.fonts.bold : this.fonts.regular;
      if (bold && !f.ttf.hasChar(cp)) f = this.fonts.regular;
      const last = runs[runs.length - 1];
      if (last && last.font === f) last.cps.push(cp); else runs.push({ font: f, cps: [cp] });
    }
    return runs;
  }

  measure(str, size = 10, bold = false) {
    let w = 0;
    for (const r of this._runs(str, bold)) for (const cp of r.cps) w += r.font.ttf.advance(r.font.ttf.glyphFor(cp));
    return w * size / 1000;
  }

  /** 自动换行：中文逐字可断行，英文和数字尽量整词 */
  wrap(str, width, size = 10, bold = false) {
    const lines = [];
    for (const para of String(str ?? '').split('\n')) {
      const tokens = para.match(/[A-Za-z0-9.,%+\-−×÷=:/()（）]+\s*|\s+|./gu) || [''];
      let line = '';
      for (const t of tokens) {
        const trial = line + t;
        if (this.measure(trial.trimEnd(), size, bold) <= width || !line) {
          if (this.measure(t, size, bold) > width && !line) {
            // 超长片段逐字切
            for (const ch of t) {
              if (this.measure(line + ch, size, bold) > width && line) { lines.push(line); line = ch; } else line += ch;
            }
          } else line = trial;
        } else {
          lines.push(line.trimEnd());
          line = t.trimStart();
        }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }

  /** 在 (x, y) 写一行字，y 为文字顶部 */
  textAt(str, x, y, { size = 10, bold = false, color = '#1f2937', align = 'left', width } = {}) {
    if (str === null || str === undefined || str === '') return;
    let tx = x;
    if (align !== 'left' && width) {
      const w = this.measure(str, size, bold);
      tx = align === 'center' ? x + (width - w) / 2 : x + width - w;
    }
    const [r, g, b] = hexColor(color);
    const baseline = this.pageHeight - (y + size * 0.88);
    let out = `BT ${num(r)} ${num(g)} ${num(b)} rg `;
    let cx = tx;
    for (const run of this._runs(str, bold)) {
      const hex = run.cps.map(cp => run.font.id(cp).toString(16).padStart(4, '0')).join('');
      out += `/${run.font.name} ${num(size)} Tf 1 0 0 1 ${num(cx)} ${num(baseline)} Tm <${hex}> Tj `;
      for (const cp of run.cps) cx += run.font.ttf.advance(run.font.ttf.glyphFor(cp)) * size / 1000;
    }
    out += 'ET';
    this._op(out);
  }

  /** 段落：自动换行与分页，返回占用高度 */
  paragraph(str, { x = this.margins.left, width = this.contentWidth, size = 10.5, bold = false, color = '#1f2937', lineGap = 4, align = 'left', after = 4 } = {}) {
    const lines = this.wrap(str, width, size, bold);
    const lh = size + lineGap;
    for (const ln of lines) {
      this.ensureSpace(lh);
      this.textAt(ln, x, this.y, { size, bold, color, align, width });
      this.y += lh;
    }
    this.y += after;
    return lines.length * lh;
  }

  rect(x, y, w, h, { fill, stroke, lineWidth = 0.6, radius = 0 } = {}) {
    const py = this.pageHeight - y - h;
    let s = '';
    if (fill) { const [r, g, b] = hexColor(fill); s += `${num(r)} ${num(g)} ${num(b)} rg `; }
    if (stroke) { const [r, g, b] = hexColor(stroke); s += `${num(r)} ${num(g)} ${num(b)} RG ${num(lineWidth)} w `; }
    if (radius > 0) {
      const k = 0.5523 * radius, X = x, Y = py, W = w, H = h, R = radius;
      s += `${num(X + R)} ${num(Y)} m ${num(X + W - R)} ${num(Y)} l ${num(X + W - R + k)} ${num(Y)} ${num(X + W)} ${num(Y + R - k)} ${num(X + W)} ${num(Y + R)} c `;
      s += `${num(X + W)} ${num(Y + H - R)} l ${num(X + W)} ${num(Y + H - R + k)} ${num(X + W - R + k)} ${num(Y + H)} ${num(X + W - R)} ${num(Y + H)} c `;
      s += `${num(X + R)} ${num(Y + H)} l ${num(X + R - k)} ${num(Y + H)} ${num(X)} ${num(Y + H - R + k)} ${num(X)} ${num(Y + H - R)} c `;
      s += `${num(X)} ${num(Y + R)} l ${num(X)} ${num(Y + R - k)} ${num(X + R - k)} ${num(Y)} ${num(X + R)} ${num(Y)} c h `;
    } else s += `${num(x)} ${num(py)} ${num(w)} ${num(h)} re `;
    s += fill && stroke ? 'B' : fill ? 'f' : 'S';
    this._op(s);
  }

  line(x1, y1, x2, y2, { color = '#9ca3af', width = 0.6, dash } = {}) {
    const [r, g, b] = hexColor(color);
    const H = this.pageHeight;
    this._op(`${num(r)} ${num(g)} ${num(b)} RG ${num(width)} w ${dash ? `[${dash.join(' ')}] 0 d ` : ''}${num(x1)} ${num(H - y1)} m ${num(x2)} ${num(H - y2)} l S${dash ? ' [] 0 d' : ''}`);
  }

  circle(cx, cy, r, { fill } = {}) {
    const [cr, cg, cb] = hexColor(fill);
    const y = this.pageHeight - cy, k = 0.5523 * r;
    this._op(`${num(cr)} ${num(cg)} ${num(cb)} rg ${num(cx + r)} ${num(y)} m ${num(cx + r)} ${num(y + k)} ${num(cx + k)} ${num(y + r)} ${num(cx)} ${num(y + r)} c ${num(cx - k)} ${num(y + r)} ${num(cx - r)} ${num(y + k)} ${num(cx - r)} ${num(y)} c ${num(cx - r)} ${num(y - k)} ${num(cx - k)} ${num(y - r)} ${num(cx)} ${num(y - r)} c ${num(cx + k)} ${num(y - r)} ${num(cx + r)} ${num(y - k)} ${num(cx + r)} ${num(y)} c f`);
  }

  /**
   * 表格：columns = [{key, title, width(比例或点), align}]
   * 自动换行、跨页时重复表头、不裁切。
   */
  table(columns, rows, { size = 9.5, headerFill = '#e8eef9', stripe = '#f8fafc', border = '#cbd5e1', padding = 4, minRow = 18, headerColor = '#1e3a8a' } = {}) {
    const total = this.contentWidth;
    const sum = columns.reduce((s, c) => s + (c.width || 1), 0);
    const widths = columns.map(c => (c.width || 1) / sum * total);
    const x0 = this.margins.left;
    const lh = size + 3.5;
    const rowHeight = (row) => Math.max(minRow, Math.max(...columns.map((c, i) => this.wrap(row[c.key] ?? '', widths[i] - padding * 2, size, !!row._bold).length)) * lh + padding * 2);
    const firstH = rows.length ? Math.min(rowHeight(rows[0]), 200) : minRow;
    const drawHeader = () => {
      const hLines = columns.map((c, i) => this.wrap(c.title, widths[i] - padding * 2, size, true));
      const h = Math.max(minRow, Math.max(...hLines.map(l => l.length)) * lh + padding * 2);
      this.ensureSpace(h + firstH);
      let x = x0;
      columns.forEach((c, i) => {
        this.rect(x, this.y, widths[i], h, { fill: headerFill, stroke: border });
        hLines[i].forEach((ln, k) => this.textAt(ln, x + padding, this.y + padding + k * lh, { size, bold: true, color: headerColor, align: c.align || 'left', width: widths[i] - padding * 2 }));
        x += widths[i];
      });
      this.y += h;
    };
    drawHeader();
    rows.forEach((row, ri) => {
      const cells = columns.map((c, i) => this.wrap(row[c.key] ?? '', widths[i] - padding * 2, size, !!row._bold));
      const h = Math.max(minRow, Math.max(...cells.map(l => l.length)) * lh + padding * 2);
      if (this.y + h > this.bottomLimit) { this.addPage(); drawHeader(); }
      let x = x0;
      columns.forEach((c, i) => {
        this.rect(x, this.y, widths[i], h, { fill: row._fill || (ri % 2 ? stripe : '#ffffff'), stroke: border });
        const color = (row._colors && row._colors[c.key]) || '#1f2937';
        cells[i].forEach((ln, k) => this.textAt(ln, x + padding, this.y + padding + k * lh, { size, bold: !!row._bold, color, align: c.align || 'left', width: widths[i] - padding * 2 }));
        x += widths[i];
      });
      this.y += h;
    });
    this.y += 8;
  }

  /** 生成 PDF 二进制 */
  finish({ footer } = {}) {
    const n = this.pages.length;
    if (footer) this.pages.forEach((p, i) => {
      const saved = this.page; this.page = p;
      const txt = footer(i + 1, n);
      if (txt) this.textAt(txt, this.margins.left, p.size[1] - this.margins.bottom + 22, { size: 8.5, color: '#6b7280', align: 'center', width: p.size[0] - this.margins.left - this.margins.right });
      this.page = saved;
    });
    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };
    const catalogId = add(null);
    const pagesId = add(null);
    const fontRefs = {};
    for (const key of ['regular', 'bold']) {
      const f = this.fonts[key];
      if (f.order.length <= 1) continue;
      const { data, order } = f.ttf.subset(f.order);
      const fontFile = zlib.deflateSync(data);
      const fileId = add({ stream: fontFile, dict: `/Length ${fontFile.length} /Length1 ${data.length} /Filter /FlateDecode` });
      const tag = 'MAMATH'.slice(0, 6 - (key === 'bold' ? 1 : 0)) + (key === 'bold' ? 'B' : '');
      const psName = `${tag}+NotoSansSC-${key === 'bold' ? 'Bold' : 'Regular'}`;
      const sc = 1000 / f.ttf.unitsPerEm;
      const descId = add(`<< /Type /FontDescriptor /FontName /${psName} /Flags 4 /FontBBox [${f.ttf.bbox.map(v => Math.round(v * sc)).join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(f.ttf.ascent * sc)} /Descent ${Math.round(f.ttf.descent * sc)} /CapHeight 700 /StemV ${key === 'bold' ? 140 : 80} /FontFile2 ${fileId} 0 R >>`);
      const widths = order.map((g) => Math.round(f.ttf.advance(g)));
      const cidId = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${psName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descId} 0 R /W [0 [${widths.join(' ')}]] /CIDToGIDMap /Identity >>`);
      // ToUnicode
      const entries = [...f.unicode.entries()].sort((a, b) => a[0] - b[0]);
      let cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
      for (let i = 0; i < entries.length; i += 100) {
        const chunk = entries.slice(i, i + 100);
        cmap += `${chunk.length} beginbfchar\n`;
        for (const [gid, cp] of chunk) {
          const u = String.fromCodePoint(cp);
          const hex = Buffer.from(u, 'utf16le').swap16().toString('hex');
          cmap += `<${gid.toString(16).padStart(4, '0')}> <${hex}>\n`;
        }
        cmap += 'endbfchar\n';
      }
      cmap += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
      const cmapBuf = zlib.deflateSync(Buffer.from(cmap));
      const toUniId = add({ stream: cmapBuf, dict: `/Length ${cmapBuf.length} /Filter /FlateDecode` });
      fontRefs[f.name] = add(`<< /Type /Font /Subtype /Type0 /BaseFont /${psName} /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${toUniId} 0 R >>`);
    }
    const fontDict = Object.entries(fontRefs).map(([k, v]) => `/${k} ${v} 0 R`).join(' ');
    const pageIds = [];
    for (const p of this.pages) {
      const content = zlib.deflateSync(Buffer.from(p.ops.join('\n'), 'latin1'));
      const cId = add({ stream: content, dict: `/Length ${content.length} /Filter /FlateDecode` });
      pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(p.size[0])} ${num(p.size[1])}] /Resources << /Font << ${fontDict} >> >> /Contents ${cId} 0 R >>`));
    }
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(i => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R /ViewerPreferences << /DisplayDocTitle true >> >>`;
    const titleHex = Buffer.from('﻿' + this.title, 'utf16le').swap16().toString('hex');
    const infoId = add(`<< /Title <${titleHex}> /Producer (Math Adventure) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);

    const chunks = [Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    let offset = chunks[0].length;
    const offsets = [];
    objs.forEach((o, i) => {
      offsets.push(offset);
      let buf;
      if (o && typeof o === 'object' && o.stream) {
        buf = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< ${o.dict} >>\nstream\n`, 'latin1'), o.stream, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
      } else buf = Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
      chunks.push(buf); offset += buf.length;
    });
    let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(chunks);
  }
}
