const G = require(process.env.CORE || './core.js');
function run(mode, maxMin = 120, dt = 1/30){
  G.setSave(JSON.parse(JSON.stringify({coins:0, stage:0, lv:{}, mods:{}, equip:[], slots:2, best:0, ended:false, muted:false, t:0, idleRate:0, prog:0, started:true, kills:0, boss:null})));
  G.layout(390, 560); G.buildGrid(); G.setState('play');
  const save = G.save, reach = [0], buyLog = {};
  let t = 0, tapT = 0, buyT = 0, lastStage = 0;
  while (t < maxMin * 60 && !save.ended){
    G.step(dt); t += dt;
    if (mode === 'tap'){ tapT += dt; if (tapT >= .17){ tapT = 0; const bl = G.blocks; let i = -1;
      if (G.boss) i = G.boss.cells[0]; else { const al = []; for (let k = 0; k < bl.length; k++) if (bl[k].alive) al.push(k); if (al.length) i = al[(Math.random()*al.length)|0]; }
      if (i >= 0) G.tap(G.cx(i), G.cy(i)); } }
    buyT += dt;
    if (buyT >= 2){ buyT = 0;
      for (let guard = 0; guard < 50; guard++){
        let best = null, bc = Infinity;
        for (const u of G.UPG){ if (G.L(u.id) < u.max){ const c = G.upCost(u); if (c < bc){ bc = c; best = () => { save.lv[u.id] = G.L(u.id) + 1; buyLog[u.id] = (buyLog[u.id]||0)+1; }; } } }
        for (const m of G.MODS){ if (G.ML(m.id) < m.max){ const c = G.modCost(m); if (c < bc){ bc = c; best = () => { const was = G.ML(m.id); save.mods[m.id] = was + 1; if (!was && save.equip.length < save.slots) save.equip.push(m.id); buyLog[m.id] = (buyLog[m.id]||0)+1; }; } } }
        if (save.slots < 4){ const c = G.slotCost(); if (c < bc){ bc = c; best = () => save.slots++; } }
        if (!best || save.coins < bc) break;
        save.coins -= bc; best();
      }
    }
    if (save.stage !== lastStage){ lastStage = save.stage; reach.push(+(t/60).toFixed(1)); }
  }
  return {mode, reach, endMin: save.ended ? +(t/60).toFixed(1) : null, coins: G.fmt(save.coins), lv: save.lv, mods: save.mods, equip: save.equip};
}
const modes = process.argv[2] ? [process.argv[2]] : ['idle', 'tap'];
for (const m of modes){ const r = run(m, +(process.argv[3] || 120)); console.log(JSON.stringify(r)); }
