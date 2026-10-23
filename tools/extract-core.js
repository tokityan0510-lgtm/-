// Pull the DOM-free core (UNITS .. end of step) out of the HTML into core.js
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const a = src.findIndex(l => l.startsWith("const UNITS"));
const b = src.findIndex(l => l.includes('/* ===== 表示まわり ===== */'));
let core = src.slice(a, b).join('\n');
core = core.replace("let save = JSON.parse(JSON.stringify(DEFAULT));", "let save = JSON.parse(JSON.stringify(DEFAULT));\nconst setSave = s => { save = s; };");
fs.writeFileSync('core.js', core + `
// 調整用：環境変数 TUNE='{"gaugeLate":1.5}' で数値を差し替えられる
Object.assign(TUNE, JSON.parse(process.env.TUNE || '{}'));
module.exports = { get save(){ return save; }, setSave, DEFAULT, L, ML, M, SP, P, UPG, MODS, SPECIALS, PERM, STAGES, PRESTIGE_STAGE, SLOT_COST, upCost, modCost, slotCost, spCost, permCost, stat, layout, buildGrid, step, tap, cx, cy, fmt,
  checkAch, prestige, dustGain, ACH, get blocks(){ return blocks; }, get boss(){ return boss; }, get lucky(){ return lucky; }, get combo(){ return combo; }, get fever(){ return fever; }, setState(s){ state = s; }, fx };
`);
