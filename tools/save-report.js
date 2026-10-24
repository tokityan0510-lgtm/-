// 使い方: node save-report.js "RENSA1:...."   （またはファイルに保存して node save-report.js save.txt）
// ゲームの「ヘルプ → プレイデータをコピー」で出る文字列を読み、いまの状態をまとめて出す
const fs = require('fs');
const G = require(process.env.CORE || './core.js');
let text = process.argv[2] || '';
if (fs.existsSync(text)) text = fs.readFileSync(text, 'utf8');
text = text.trim();
const raw = text.startsWith('RENSA1:') ? Buffer.from(text.slice(7), 'base64').toString('utf8') : text;
const o = JSON.parse(raw);
const save = Object.assign(JSON.parse(JSON.stringify(G.DEFAULT)), o);
save.st = Object.assign(JSON.parse(JSON.stringify(G.DEFAULT.st)), o.st || {});
// 大きな数に対応する前のセーブ：ひびの進みを素材ごとの基準からの倍率に、累計コインを log10 に（ゲームの読み込みと同じ）
if (!o.scale3){ save.prog = (Number(save.prog) || 0) / Math.pow(10, save.stage * Math.log10(G.TUNE ? G.TUNE.fdmg : 4000)); save.st.earnedLog = Math.log10(Math.max(1, Number(save.st.earnedAll) || 1)); save.ec = 0; }
G.setSave(save);
const fmtT = s => `${Math.floor(s / 3600)}時間${Math.floor(s % 3600 / 60)}分`;
const line = (k, v) => console.log(`${k}：${v}`);
line('素材', `${G.STAGES[save.stage].name}（${save.stage}段目）　ひび ${(save.prog / G.gaugeNeed() * 100).toFixed(1)}%`);
line('最も深い', G.STAGES[save.st.deepest || 0].name);
line('コイン', G.fmtC(save.coins));
line('星屑', `${save.dust}（累計 ${save.st.bestDust}）　砕いた回数 ${save.runs}`);
line('プレイ時間', fmtT(save.st.time || 0));
line('強化Lv合計', Object.values(save.lv).reduce((a, b) => a + b, 0));
console.log('\n■ 強化（Lv）');
for (const cat of ['idle', 'arms', 'tap', 'core', 'build']){
  const us = G.UPG.filter(u => u.cat === cat && G.L(u.id) > 0).map(u => `${u.name} ${G.L(u.id)}${u.max < 1e9 ? '/' + u.max : ''}`);
  if (us.length) console.log(`  [${cat}] ${us.join('、')}`);
}
console.log('\n■ モジュール'); console.log('  ' + (G.MODS.filter(m => G.ML(m.id)).map(m => `${m.name} ${G.ML(m.id)}${save.off && save.off[m.id] ? '(OFF)' : ''}`).join('、') || 'なし'));
console.log('\n■ 特殊強化 ' + Object.keys(save.sp).length + ' / ' + G.SPECIALS.length);
const can = G.SPECIALS.filter(s => !G.SP(s.id) && s.req());
if (can.length) console.log('  買える（条件を満たしている）：' + can.map(s => `${s.name}（${G.fmtC(G.spCost(s))}）`).join('、'));
console.log('\n■ 遺物 ' + Object.keys(save.relics || {}).length + '種'); console.log('  ' + (Object.entries(save.relics || {}).map(([k, v]) => `${(G.RELICS.find(r => r.id === k) || {name:k}).name} Lv${v}`).join('、') || 'なし'));
console.log('\n■ 永続強化'); console.log('  ' + (G.PERM.filter(p => G.P(p.id)).map(p => `${p.name} ${G.P(p.id)}`).join('、') || 'なし'));
console.log('\n■ 実績 ' + Object.keys(save.ach).length + ' / ' + G.ACH.length);
const off = Object.keys(save.off || {}).filter(k => save.off[k]);
if (off.length) console.log('\n■ OFFにしているもの：' + off.join('、'));
