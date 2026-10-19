// TrueType 字体解析与子集化（只嵌入用到的字形，PDF 体积小）
import { readFileSync } from 'node:fs';

export class TTFont {
  constructor(path) {
    const buf = readFileSync(path);
    this.buf = buf;
    const numTables = buf.readUInt16BE(4);
    this.tables = {};
    for (let i = 0; i < numTables; i++) {
      const off = 12 + i * 16;
      const tag = buf.toString('latin1', off, off + 4);
      this.tables[tag] = { offset: buf.readUInt32BE(off + 8), length: buf.readUInt32BE(off + 12) };
    }
    const head = this.tables.head.offset;
    this.unitsPerEm = buf.readUInt16BE(head + 18);
    this.bbox = [buf.readInt16BE(head + 36), buf.readInt16BE(head + 38), buf.readInt16BE(head + 40), buf.readInt16BE(head + 42)];
    this.indexToLocFormat = buf.readInt16BE(head + 50);
    const hhea = this.tables.hhea.offset;
    this.ascent = buf.readInt16BE(hhea + 4);
    this.descent = buf.readInt16BE(hhea + 6);
    this.numberOfHMetrics = buf.readUInt16BE(hhea + 34);
    this.numGlyphs = buf.readUInt16BE(this.tables.maxp.offset + 4);
    this._parseCmap();
    this._parseHmtx();
    this._parseLoca();
  }

  _parseCmap() {
    const buf = this.buf, base = this.tables.cmap.offset;
    const n = buf.readUInt16BE(base + 2);
    this.cmap = new Map();
    let best = null;
    for (let i = 0; i < n; i++) {
      const pid = buf.readUInt16BE(base + 4 + i * 8), eid = buf.readUInt16BE(base + 6 + i * 8);
      const off = base + buf.readUInt32BE(base + 8 + i * 8);
      const fmt = buf.readUInt16BE(off);
      if (fmt === 12 && (pid === 3 && eid === 10 || pid === 0)) best = { off, fmt };
      else if (fmt === 4 && !best && (pid === 3 && eid === 1 || pid === 0)) best = { off, fmt };
    }
    if (!best) throw new Error('字体缺少 Unicode cmap');
    const { off, fmt } = best;
    if (fmt === 12) {
      const groups = buf.readUInt32BE(off + 12);
      for (let g = 0; g < groups; g++) {
        const p = off + 16 + g * 12;
        const start = buf.readUInt32BE(p), end = buf.readUInt32BE(p + 4), gid = buf.readUInt32BE(p + 8);
        for (let c = start; c <= end; c++) this.cmap.set(c, gid + (c - start));
      }
    } else {
      const segX2 = buf.readUInt16BE(off + 6);
      const endO = off + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = buf.readUInt16BE(endO + s * 2), start = buf.readUInt16BE(startO + s * 2);
        const delta = buf.readInt16BE(deltaO + s * 2), ro = buf.readUInt16BE(rangeO + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let gid;
          if (ro === 0) gid = (c + delta) & 0xffff;
          else {
            const gi = rangeO + s * 2 + ro + (c - start) * 2;
            gid = buf.readUInt16BE(gi);
            if (gid) gid = (gid + delta) & 0xffff;
          }
          if (gid) this.cmap.set(c, gid);
        }
      }
    }
  }

  _parseHmtx() {
    const off = this.tables.hmtx.offset;
    this.advances = new Uint16Array(this.numGlyphs);
    let last = 0;
    for (let g = 0; g < this.numGlyphs; g++) {
      if (g < this.numberOfHMetrics) last = this.buf.readUInt16BE(off + g * 4);
      this.advances[g] = last;
    }
  }

  _parseLoca() {
    const off = this.tables.loca.offset;
    this.loca = new Uint32Array(this.numGlyphs + 1);
    for (let g = 0; g <= this.numGlyphs; g++) {
      this.loca[g] = this.indexToLocFormat === 0 ? this.buf.readUInt16BE(off + g * 2) * 2 : this.buf.readUInt32BE(off + g * 4);
    }
  }

  glyphFor(codePoint) { return this.cmap.get(codePoint) || 0; }
  hasChar(codePoint) { return this.cmap.has(codePoint); }
  advance(gid) { return this.advances[gid] * 1000 / this.unitsPerEm; }

  glyphData(gid) {
    const start = this.tables.glyf.offset + this.loca[gid];
    return this.buf.subarray(start, this.tables.glyf.offset + this.loca[gid + 1]);
  }

  /** 复合字形的组件 */
  components(gid) {
    const d = this.glyphData(gid);
    if (d.length < 10 || d.readInt16BE(0) >= 0) return [];
    const out = [];
    let p = 10;
    for (;;) {
      const flags = d.readUInt16BE(p);
      out.push({ pos: p + 2, gid: d.readUInt16BE(p + 2) });
      p += 4 + (flags & 1 ? 4 : 2);
      if (flags & 8) p += 2; else if (flags & 0x40) p += 4; else if (flags & 0x80) p += 8;
      if (!(flags & 0x20)) break;
    }
    return out;
  }

  /**
   * 生成子集字体。order：新字形编号 → 原字形编号（0 必须是 .notdef）
   * 复合字形的组件会追加到末尾。返回 {data, order}
   */
  subset(order) {
    const ord = order.slice();
    const index = new Map(ord.map((g, i) => [g, i]));
    for (let i = 0; i < ord.length; i++) {
      for (const c of this.components(ord[i])) if (!index.has(c.gid)) { index.set(c.gid, ord.length); ord.push(c.gid); }
    }
    const glyphs = ord.map((g) => {
      let d = Buffer.from(this.glyphData(g));
      const comps = this.components(g);
      for (const c of comps) d.writeUInt16BE(index.get(c.gid), c.pos);
      if (d.length % 4) d = Buffer.concat([d, Buffer.alloc(4 - (d.length % 4))]);
      return d;
    });
    const glyf = Buffer.concat(glyphs);
    const loca = Buffer.alloc((ord.length + 1) * 4);
    let pos = 0;
    glyphs.forEach((g, i) => { loca.writeUInt32BE(pos, i * 4); pos += g.length; });
    loca.writeUInt32BE(pos, ord.length * 4);
    const hmtx = Buffer.alloc(ord.length * 4);
    ord.forEach((g, i) => { hmtx.writeUInt16BE(this.advances[g], i * 4); hmtx.writeInt16BE(0, i * 4 + 2); });
    const head = Buffer.from(this.buf.subarray(this.tables.head.offset, this.tables.head.offset + 54));
    head.writeUInt32BE(0, 8); // checkSumAdjustment 稍后计算
    head.writeInt16BE(1, 50); // long loca
    const hhea = Buffer.from(this.buf.subarray(this.tables.hhea.offset, this.tables.hhea.offset + 36));
    hhea.writeUInt16BE(ord.length, 34);
    const maxp = Buffer.from(this.buf.subarray(this.tables.maxp.offset, this.tables.maxp.offset + this.tables.maxp.length));
    maxp.writeUInt16BE(ord.length, 4);
    const tables = { glyf, head, hhea, hmtx, loca, maxp };
    const tags = Object.keys(tables).sort();
    const headerLen = 12 + tags.length * 16;
    const parts = [];
    const dir = Buffer.alloc(headerLen);
    dir.writeUInt32BE(0x00010000, 0);
    dir.writeUInt16BE(tags.length, 4);
    let es = 0; while ((1 << (es + 1)) <= tags.length) es++;
    dir.writeUInt16BE((1 << es) * 16, 6); dir.writeUInt16BE(es, 8); dir.writeUInt16BE(tags.length * 16 - (1 << es) * 16, 10);
    let off = headerLen;
    const checksum = (b) => { let s = 0; const p = Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]); for (let i = 0; i < p.length; i += 4) s = (s + p.readUInt32BE(i)) >>> 0; return s; };
    tags.forEach((t, i) => {
      const data = tables[t];
      const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
      dir.write(t, 12 + i * 16, 'latin1');
      dir.writeUInt32BE(checksum(data), 16 + i * 16);
      dir.writeUInt32BE(off, 20 + i * 16);
      dir.writeUInt32BE(data.length, 24 + i * 16);
      parts.push(padded);
      off += padded.length;
    });
    const font = Buffer.concat([dir, ...parts]);
    const headOff = 12 + tags.length * 16 + parts.slice(0, tags.indexOf('head')).reduce((s, p) => s + p.length, 0);
    font.writeUInt32BE((0xB1B0AFBA - checksum(font)) >>> 0, headOff + 8);
    return { data: font, order: ord };
  }
}
