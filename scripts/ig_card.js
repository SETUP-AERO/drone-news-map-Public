// Render SETUP AERO weekly Instagram cards (1080x1350 JPEG) from a JSON spec.
// Usage: node scripts/ig_card.js instagram/queue/2026-12-07/card.json [more.json ...]
// Writes 1.jpg next to each spec. Needs Playwright (Chromium) and Google Fonts access.
//
// Spec fields:
//   series: brief | company | d101 | numbers | safe     (sets color + badge)
//   corner: top-right text ("12월 1주차", "Vol.02")
//   title: [line1, line2]  words wrapped in *...* are colored; if no *...* in line2, all of line2 is colored
//   subtitle, source (footer left)
//   blocks: one of
//     {type:"news", items:[{title, tag, source, place}]}
//     {type:"cards", items:[{label, value?, text?, wide?}]}    value = big number/word
//     {type:"bars", items:[{label, value}], stats:[{label, value}]}
//     {type:"checks", items:[{icon, title, text}]}
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SERIES = {
  brief:   { color: '#f59e0b', badge: 'WEEKLY BRIEF · 월' },
  company: { color: '#60a5fa', badge: 'COMPANY SPOTLIGHT · 수' },
  d101:    { color: '#a78bfa', badge: 'DRONE 101 · 금' },
  numbers: { color: '#7dd3fc', badge: 'DRONE IN NUMBERS · 격주 토' },
  safe:    { color: '#4ade80', badge: 'FLY SAFE · 격주 토' },
};
const TAGS = { 방산: '#f87171', UAM: '#a78bfa', 상업: '#60a5fa', 정책: '#4ade80', 산업: '#f59e0b', 분쟁: '#fb923c' };

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hl = s => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');

function blocks(b) {
  if (b.type === 'news') return `<div class="news">${b.items.map((it, i) => `
    <div class="box row"><div class="num">${String(i + 1).padStart(2, '0')}</div><div>
      <div class="nt">${esc(it.title)}</div>
      <div class="meta"><span class="tag" style="--t:${TAGS[it.tag] || '#94a3b8'}">${esc(it.tag)}</span>${esc(it.source)}${it.place ? ` <span class="dot">·</span> ${esc(it.place)}` : ''}</div>
    </div></div>`).join('')}</div>`;
  if (b.type === 'cards') return `<div class="grid">${b.items.map(it => `
    <div class="box card${it.wide ? ' wide' : ''}"><div class="lab">${esc(it.label)}</div>
      ${it.value ? `<div class="val">${hl(it.value)}</div>` : ''}${it.text ? `<div class="txt">${esc(it.text).replace(/\n/g, '<br>')}</div>` : ''}</div>`).join('')}</div>`;
  if (b.type === 'bars') {
    const max = Math.max(...b.items.map(i => i.value));
    return `<div class="bars">${b.items.map(it => `
      <div class="bar"><span class="bl">${esc(it.label)}</span><span class="track"><span style="width:${(it.value / max * 100).toFixed(1)}%"></span></span><span class="bv">${it.value.toLocaleString('en-US')}</span></div>`).join('')}</div>
      ${b.stats ? `<div class="grid">${b.stats.map(s => `<div class="box card"><div class="lab">${esc(s.label)}</div><div class="val">${esc(s.value)}</div></div>`).join('')}</div>` : ''}`;
  }
  if (b.type === 'checks') return `<div class="news">${b.items.map(it => `
    <div class="box row chk"><div class="ic">${esc(it.icon)}</div><div><div class="nt">${esc(it.title)}</div><div class="meta">${esc(it.text)}</div></div></div>`).join('')}</div>`;
  throw new Error('unknown block ' + b.type);
}

function html(spec) {
  const s = SERIES[spec.series];
  if (!s) throw new Error('unknown series ' + spec.series);
  const [t1, t2] = spec.title;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{word-break:keep-all;width:1080px;height:1350px;background:#0c141c;color:#e6edf3;font-family:'IBM Plex Sans KR',sans-serif;padding:70px 64px 56px;display:flex;flex-direction:column;--c:${s.color}}
em{font-style:normal;color:var(--c)}
.top{display:flex;justify-content:space-between;font:600 21px 'IBM Plex Mono',monospace;letter-spacing:1px}
.top span:last-child{color:#8b98a5;font-weight:500}
.badge{align-self:flex-start;margin-top:56px;background:var(--c);color:#0c141c;font:600 21px 'IBM Plex Mono','IBM Plex Sans KR',monospace;padding:12px 18px;border-radius:24px;letter-spacing:1px}
h1{font-size:84px;font-weight:700;line-height:1.08;letter-spacing:-2px;margin-top:30px}
h1 .l2{color:var(--c)}
.sub{margin-top:26px;font-size:28px;color:#94a3b8}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px;padding:30px 0}
.box{background:#111b25;border:1px solid #1f2b38;border-radius:16px}
.news{display:flex;flex-direction:column;gap:18px}
.row{display:flex;gap:26px;padding:24px 26px;align-items:flex-start}
.num{font:600 32px 'IBM Plex Mono',monospace;color:var(--c);padding-top:2px}
.nt{font-size:29px;font-weight:700;line-height:1.3}
.meta{margin-top:8px;font-size:20px;color:#94a3b8;font-family:'IBM Plex Mono','IBM Plex Sans KR',monospace}
.dot{margin:0 8px}
.tag{display:inline-block;border:1.5px solid var(--t);color:var(--t);border-radius:6px;padding:1px 9px;margin-right:10px;font-size:18px}
.chk{align-items:center}.ic{flex:none;width:64px;height:64px;border-radius:10px;background:#16352b;display:flex;align-items:center;justify-content:center;font:600 30px 'IBM Plex Mono',monospace;color:var(--c)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.card{padding:26px}.card.wide{grid-column:1/-1}
.lab{font:500 20px 'IBM Plex Mono','IBM Plex Sans KR',monospace;color:#94a3b8;letter-spacing:2px}
.val{font-size:44px;font-weight:700;margin-top:10px;color:var(--c)}
.txt{font-size:22px;line-height:1.6;margin-top:10px;color:#cbd5e1}
.bars{display:flex;flex-direction:column;gap:22px}
.bar{display:flex;align-items:center;gap:24px;font-size:26px}
.bl{width:115px}.bv{width:105px;text-align:right;font:600 26px 'IBM Plex Mono',monospace}
.track{flex:1;height:34px;background:#111b25;border:1px solid #1f2b38;border-radius:8px;overflow:hidden}
.track span{display:block;height:100%;background:var(--c);border-radius:8px}
.foot{border-top:1px solid #1f2b38;padding-top:26px;display:flex;justify-content:space-between;align-items:center;gap:30px;font-size:20px;color:#8b98a5}
.foot span:last-child{font-family:'IBM Plex Mono','IBM Plex Sans KR',monospace;white-space:nowrap}
</style></head><body>
<div class="top"><span>SETUP AERO</span><span>${esc(spec.corner)}</span></div>
<div class="badge">${esc(s.badge)}</div>
<h1>${hl(t1)}${t2 ? `<br><span class="${t2.includes('*') ? '' : 'l2'}">${hl(t2)}</span>` : ''}</h1>
${spec.subtitle ? `<div class="sub">${esc(spec.subtitle)}</div>` : ''}
<div class="body">${(spec.blocks || []).map(blocks).join('')}</div>
<div class="foot"><span>${esc(spec.source)}</span><span>전체 지도 → 프로필 링크</span></div>
</body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  for (const f of process.argv.slice(2)) {
    const spec = JSON.parse(fs.readFileSync(f, 'utf8'));
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.setContent(html(spec), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.body.scrollHeight > 1350);
    if (overflow) console.warn(`WARNING ${f}: content taller than 1350px, shorten the text`);
    const out = path.join(path.dirname(f), spec.out || '1.jpg');
    await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log('wrote', out);
    await page.close();
  }
  await browser.close();
})();
