// 使い方: node bot.js [idle|tap] [最大分]
//   idle: 一切触らない（幸運ブロックも見逃す）
//   tap : 0.17秒ごとにタップ。幸運ブロックが出ていれば優先して叩く
const G = require(process.env.CORE || './core.js');
function run(mode, maxMin = 120, dt = 1/30, fresh = true){
  if (fresh){ G.setSave(JSON.parse(JSON.stringify(G.DEFAULT))); G.save.started = true; G.layout(390, 560); }
  G.buildGrid(); G.setState('play');
  const save = G.save, reach = [0], dust = [], lvAt = [];
  const lvsum = () => Object.values(save.lv).reduce((a, b) => a + b, 0);
  let t = 0, tapT = 0, buyT = 0, achT = 0, lastStage = save.stage, prestigeAt = null, gridLv = -1;
  while (t < maxMin * 60 && !save.ended){
    G.step(dt); t += dt;
    if (mode === 'tap' || mode === 'ctap'){ tapT += dt; if (tapT >= (mode === 'ctap' ? .33 : G.stat.holdMs() / 1000)){ tapT = 0;
      // 幸運ブロックが出ていれば叩き、それ以外は巨大ブロックのどこかを叩く
      const lk = G.lucky;
      if (lk) G.tap(lk.x, lk.y); else G.tap(G.BX + (Math.random() - .5) * G.BS * .8, G.BY + (Math.random() - .5) * G.BS * .8); } }
    achT += dt; if (achT >= 1){ achT = 0; G.checkAch(); }
    buyT += dt;
    const casual = mode === 'ctap' || mode === 'cidle';
    if (casual && buyT >= 10){ buyT = 0;
      // 人間らしい買い方：買えるものからランダムに6件。半分はまとめ買い（×MAX）、残りは1Lv
      for (let k = 0; k < 6; k++){
        const opts = [];
        for (const u of G.UPG) if (!(process.env.SKIP || '').split(',').includes(u.id) && G.L(u.id) < u.max && G.upCost(u) <= save.coins) opts.push(() => { let n = Math.random() < .5 ? 1e9 : 1; while (n-- > 0 && G.L(u.id) < u.max && G.upCost(u) <= save.coins){ save.coins -= G.upCost(u); save.lv[u.id] = G.L(u.id) + 1; } });
        for (const s of G.SPECIALS) if (!G.SP(s.id) && s.req() && G.spCost(s) <= save.coins) opts.push(() => { save.coins -= G.spCost(s); save.sp[s.id] = 1; });
        for (const m of G.MODS) if (G.ML(m.id) < m.max && G.modCost(m) <= save.coins) opts.push(() => { save.coins -= G.modCost(m); const w = G.ML(m.id); save.mods[m.id] = w + 1; });
        if (!opts.length) break;
        opts[(Math.random() * opts.length) | 0]();
      }
      if (G.L('grid') !== gridLv){ gridLv = G.L('grid'); G.layout(390, 560); G.buildGrid(); }
    }
    if (!casual && buyT >= 2){ buyT = 0;
      for (let guard = 0; guard < 5000; guard++){
        let best = null, bc = Infinity;
        for (const u of G.UPG){ if (G.L(u.id) < u.max){ const c = G.upCost(u); if (c < bc){ bc = c; best = () => save.lv[u.id] = G.L(u.id) + 1; } } }
        for (const s of G.SPECIALS){ if (!G.SP(s.id) && s.req()){ const c = G.spCost(s); if (c < bc){ bc = c; best = () => save.sp[s.id] = 1; } } }
        for (const m of G.MODS){ if (G.ML(m.id) < m.max){ const c = G.modCost(m); if (c < bc){ bc = c; best = () => { const was = G.ML(m.id); save.mods[m.id] = was + 1; }; } } }
        if (!best || save.coins < bc) break;
        save.coins -= bc; best();
      }
      // 盤面拡張を買ったら組み直す
      if (G.L('grid') !== gridLv){ gridLv = G.L('grid'); G.layout(390, 560); G.buildGrid(); }
    }
    if (save.stage !== lastStage){ lastStage = save.stage; reach.push(+(t/60).toFixed(1)); lvAt.push(lvsum()); if (save.stage >= G.PRESTIGE_STAGE) dust.push(G.dustGain()); if (save.stage === G.PRESTIGE_STAGE) prestigeAt = G.dustGain(); }
  }
  return {mode, reach, lvAt, grid: G.L('grid'), cells: G.blocks.length, lvMax: G.UPG.reduce((a, u) => a + Math.min(u.max, 30), 0), dust, best: save.best, destroyed: save.st.destroyed, endMin: save.ended ? +(t/60).toFixed(1) : null, dustAtUnlock: prestigeAt, dustAtEnd: G.dustGain(),
    sp: Object.keys(save.sp).length + '/' + G.SPECIALS.length, ach: Object.keys(save.ach).length + '/' + G.ACH.length, lucky: save.st.lucky, coins: G.fmt(save.coins)};
}
// 第3引数に周回数を渡すと、エンディング後に砕いて永続強化を買い、次の周を続けて測る
//   例: node bot.js tap 180 3
function buyPerms(){
  for (let guard = 0; guard < 200; guard++){
    let best = null, bc = Infinity;
    for (const p of G.PERM){ if (G.P(p.id) < p.max){ const c = G.permCost(p); if (c < bc){ bc = c; best = p; } } }
    if (!best || G.save.dust < bc) break;
    G.save.dust -= bc; G.save.perm[best.id] = G.P(best.id) + 1;
  }
}
const modes = process.argv[2] ? [process.argv[2]] : ['idle', 'tap'];
const loops = +(process.argv[4] || 1);
for (const m of modes){
  for (let k = 0; k < loops; k++){
    const r = run(m, +(process.argv[3] || 180), 1/30, k === 0);
    console.log(JSON.stringify(Object.assign({run:k + 1}, r)));
    if (k < loops - 1){ const d = G.prestige(); buyPerms(); console.log(JSON.stringify({prestige:d, dust:G.save.dust, perm:G.save.perm})); }
  }
}
