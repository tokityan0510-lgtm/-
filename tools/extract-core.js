// Pull the DOM-free core (UNITS .. end of step) out of the HTML into core.js
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const a = src.findIndex(l => l.startsWith("const UNITS"));
const b = src.findIndex(l => l.includes('/* ===== 表示まわり ===== */'));
let core = src.slice(a, b).join('\n');
core = core.replace("let save = JSON.parse(JSON.stringify(DEFAULT));", "let save = JSON.parse(JSON.stringify(DEFAULT));\nconst setSave = s => { save = s; };");
fs.writeFileSync('core.js', core + `
module.exports = { get save(){ return save; }, setSave, L, ML, M, UPG, MODS, STAGES, SLOT_COST, upCost, modCost, slotCost, stat, layout, buildGrid, step, tap, cx, cy, fmt,
  get blocks(){ return blocks; }, get boss(){ return boss; }, get combo(){ return combo; }, get fever(){ return fever; }, setState(s){ state = s; }, fx };
`);
