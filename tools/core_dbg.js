const UNITS = ['', '万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗', '正', '載', '極', '恒河沙', '阿僧祇', '那由他', '不可思議', '無量大数'];
function fmt(n){
  if (!isFinite(n)) return '∞';
  if (n < 10000) return Math.floor(n).toLocaleString('ja-JP');
  const k = Math.floor(Math.log10(n) / 4);
  if (k >= UNITS.length) return fmt(n / 1e68) + '無量大数';
  const v = n / Math.pow(10, 4 * k);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + UNITS[k];
}
const fmtX = x => x < 100 ? x.toFixed(x < 10 ? 2 : 1) : fmt(x);
const fmtT = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}時間${m}分` : `${m}分`; };

const STAGES = [
  {name:'木箱',     color:'#d08a45', dark:'#8a5726', glow:'#ffb36b', bg:'#1a1410'},
  {name:'石',       color:'#a3acb7', dark:'#636d79', glow:'#e4ecf5', bg:'#12161c'},
  {name:'鉄',       color:'#6f88a0', dark:'#3c4f63', glow:'#a9d4ff', bg:'#0d141d'},
  {name:'水晶',     color:'#7fe0f0', dark:'#2f9db5', glow:'#c9fbff', bg:'#071a22'},
  {name:'溶岩',     color:'#ff6a2b', dark:'#a3300f', glow:'#ffb15c', bg:'#1f0b06'},
  {name:'隕石',     color:'#9a74b0', dark:'#563b6c', glow:'#e0b8ff', bg:'#130b1c'},
  {name:'星',       color:'#ffd84d', dark:'#c99a10', glow:'#fff3b0', bg:'#14110a'},
  {name:'銀河',     color:'#b48cff', dark:'#6a43c4', glow:'#ffb3ff', bg:'#0c0820'},
  {name:'暗黒物質', color:'#4a4f6a', dark:'#23263a', glow:'#8f9bff', bg:'#05050c'},
  {name:'時空',     color:'#3fd9c0', dark:'#1a7f70', glow:'#b8fff2', bg:'#031a18'},
  {name:'次元',     color:'#ff7ad9', dark:'#a3287f', glow:'#ffd1f4', bg:'#1a0616'},
  {name:'宇宙',     color:'#ffffff', dark:'#6a6a7a', glow:'#ffffff', bg:'#000000'},
];
// 宇宙の先：宇宙を砕いた（エンディング）あとも素材が続く。最初の6つは名前つき、その先は「深淵 第N層」
const UNIVERSE = STAGES.length - 1;
const BEYOND = ['多元宇宙', '虚無', '混沌', '始原', '終焉', '神域'];
for (let k = 1; k <= 38; k++){
  const h = (k * 47 + 200) % 360;
  STAGES.push({name:BEYOND[k - 1] || `深淵 第${k - BEYOND.length}層`, color:`hsl(${h},70%,62%)`, dark:`hsl(${h},55%,32%)`, glow:`hsl(${h},100%,82%)`, bg:`hsl(${h},45%,5%)`, beyond:k});
}
const PRESTIGE_STAGE = 8;   // この素材に到達したら「砕く」が解放される
// ブロックの価値の素材倍率（TUNE.valStage）
const sv = s => Math.pow(TUNE.valStage, s);
const TUNE = {fhp:4000, fhpLate:4000, fdmg:4000, reqBase:2200, reqPow:5.4, dmgG:1.5, hpPow:3.4, hpMul:1, lvBonus:.01, tapProg:1.5, dustBase:18, dustDiv:8, dustBonus:.001, pmultBonus:.1, idleBonus:7, idleRamp:30, idleDmgK:.35, feverReward:2, costX:3, valStage:1e4, modSpan:7, droneDmg:5, droneInt:1.5, armMul:15, armIdle:0, reso:.01, bossHp:1500, bossGrow:1.35, bossReward:300, comboDecay:.6};
Object.assign(TUNE, JSON.parse(process.env.TUNE || '{}'));
const DEFAULT = {
  coins:0, stage:0, lv:{}, mods:{}, best:0, ended:false, muted:false, t:0, idleRate:0, prog:0, started:false, kills:0, boss:null,
  sp:{}, ach:{}, dust:0, perm:{}, off:{}, runs:0, buyMode:1, endSeen:false, relics:{},
  st:{depth:0, destroyed:0, taps:0, bosses:0, lucky:0, fevers:0, time:0, earnedRun:0, earnedAll:0, offline:0, bestDust:0, bigCombo:0, deepest:0, relics:0},
};
let save = JSON.parse(JSON.stringify(DEFAULT));
const setSave = s => { save = s; };
const L = id => save.lv[id] || 0;
const ML = id => save.mods[id] || 0;
// モジュールは解放したら全部効く（装備枠はなし）。ON/OFFボタンで止めたものだけ効かない
const M = id => save.off && save.off[id] ? 0 : ML(id);
const SP = id => !!save.sp[id];
const P = id => save.perm[id] || 0;

// ===== 兵器：放置で勝手に戦う。素材を進めるほど新しい兵器が手に入る =====
//   st：手に入る目安の素材の段。n：最大台数。every：1台あたりの発射間隔（秒）。dmg：1発の威力（破片1つの何倍か。さらに TUNE.armMul 倍）
const ARMS = [
  {id:'cannon',  name:'砲台',           st:1, n:6, every:3.0, dmg:3,  note:'画面下の砲台が砲弾を撃ち、着弾した周りを吹き飛ばす'},
  {id:'laser',   name:'レーザー',       st:2, n:5, every:4.5, dmg:10, note:'横一列をまとめて焼き払う'},
  {id:'missile', name:'ミサイル',       st:4, n:5, every:5.0, dmg:20, note:'狙ったブロックへ曲がって飛び、大爆発する'},
  {id:'hole',    name:'ブラックホール', st:6, n:3, every:10,  dmg:8,  note:'周りを吸い込みながら削り、最後に爆発する'},
];
// 値段はボスを倒しても上がらない（クッキークリッカー型）。上がるのは買ったときだけ。
//   inf:true … 上限なし。値段は g 倍ずつ。効果は足し算で伸びる（ボス撃破のたびに数十Lvまとめて買える）
//   それ以外 … 上限あり。span 段ぶんの価値の伸びをかけて上限に届くよう、1Lvごとに大きく上がる（素材が進むごとに解放される感覚）
const UPG = [
  // 放置
  {cat:'idle', id:'drones',   name:'ドローンの台数', note:'勝手に撃ち続けるドローン',           cost:800,   span:10, max:11,  v:l => `${1+l+P('pdrone')}台`},
  {cat:'idle', id:'droneint', name:'連射速度',       note:'ドローンが撃つ間隔',                 cost:600,   span:9,  max:8,  v:l => `${(TUNE.droneInt*Math.pow(.85,l)*(SP('rl1')?.8:1)).toFixed(2)}秒`},
  {cat:'idle', id:'dronedmg', name:'弾の威力',       note:'ドローンの弾が与えるダメージ（上限なし）', cost:900, inf:true, g:TUNE.dmgG, max:1e9, v:l => `×${fmtX(TUNE.droneDmg*(1+.25*l))}`},
  {cat:'idle', id:'spawn',    name:'共鳴',           note:'1秒ごとに、直前1秒に与えたダメージの一部をもう一度与える', cost:1200, span:8, max:15, v:l => l ? `${Math.round(stat.reso(l)*100)}%` : 'なし'},
  {cat:'idle', id:'drburst',  name:'弾の炸裂',       note:'弾が当たったとき飛び散るかけら',     cost:2500,  span:8,  max:10,  v:l => `+${l*2*(SP('bu1')?2:1)}個`},
  // 兵器（台数は上限あり、威力は上限なし）。値段は手に入る目安の段の価値に合わせる
  ...ARMS.flatMap(a => [
    {cat:'arms', id:a.id + 'N', name:a.name + 'の数', note:a.note, cost:2000 * Math.pow(TUNE.valStage, a.st), span:8, max:a.n, v:l => l ? `${l}台` : 'なし'},
    {cat:'arms', id:a.id + 'P', name:a.name + 'の威力', note:a.name + 'のダメージ（上限なし）', cost:3000 * Math.pow(TUNE.valStage, a.st), inf:true, g:TUNE.dmgG, max:1e9, v:l => `×${fmtX(1 + .25 * l)}`},
  ]),
  // 操作
  {cat:'tap',  id:'tapburst', name:'タップの破片',   note:'タップしたとき飛び散るかけらの倍率',     cost:500,   span:9,  max:10,  v:l => `×${2+l}`},
  {cat:'tap',  id:'heat',     name:'熱量',           note:'1タップで溜まるフィーバーゲージ',     cost:1500,  span:7,  max:12,  v:l => `+${((8+2*l)*(SP('ht1')?1.5:1)).toFixed(0)}`},
  {cat:'tap',  id:'fever',    name:'フィーバー',     note:'ゲージ満タンで報酬2倍・威力2倍になる時間', cost:4000, span:8, max:10, v:l => `${5+l}秒`},
  {cat:'tap',  id:'tapboom',  name:'衝撃波',         note:'タップしたところで衝撃波が起きる', cost:3000, span:8,  max:5,   v:l => l ? `半径${(1+.3*l+(SP('sw1')?1:0)).toFixed(1)}・威力×${l*2}` : 'なし'},
  // 共通
  {cat:'core', id:'market',   name:'相場',           note:'すべてのブロックの価値が上がる（上限なし）', cost:1000, inf:true, g:1.15, max:1e9, v:l => `+${(l*10).toLocaleString('ja-JP')}%`},
  {cat:'core', id:'chain',    name:'コンボ係数',     note:'コンボが高いほど報酬が増える（上限なし）', cost:5000, inf:true, g:1.22, max:1e9, v:l => `${(0.1+0.05*l).toFixed(2)}`},
  {cat:'core', id:'power',    name:'基本威力',       note:'タップ・かけら・ドローン・兵器すべての基本ダメージ（上限なし）', cost:1500, inf:true, g:TUNE.dmgG, max:1e9, v:l => `×${fmtX(1+.2*l)}`},
  {cat:'core', id:'shards',   name:'かけらの数',     note:'叩いたとき飛び散るかけら。弧を描いて戻ってきて、もう一度当たる', cost:1000,  span:10, max:25,  v:l => `${3+l}個`},
  {cat:'core', id:'keep',     name:'連鎖の持続',     note:'かけらが戻ってくるたびに威力が落ちる。その落ち方をゆるやかにする', cost:3000, span:9, max:10, v:l => `1段ごと×${(.65+.025*l).toFixed(3)}`},
  {cat:'core', id:'crit',     name:'クリティカル',   note:'大ダメージが出る確率',               cost:4000,  span:9,  max:15,  v:l => `${5+3*l}%`},
  {cat:'core', id:'bomb',     name:'爆発するかけら', note:'当たったところで、ときどき爆発が起きる確率', cost:6000, span:8, max:15, v:l => `${(Math.min(.25,.02+.015*l)*100).toFixed(1)}%`},
  {cat:'core', id:'gold',     name:'金のかけら',     note:'当たったとき、ときどき金のかけらが出てコイン15倍になる確率',           cost:8000,  span:9,  max:15,  v:l => `${Math.round(Math.min(.2,.01+.01*l)*100)}%`},
];
const MODS = [
  {id:'ricochet', name:'跳弾', note:'かけらが画面の端で跳ね返り、跳ねるたびに威力が上がる', unlock:15000,  cost:12000, st:0, max:10, v:l => `${1+l}回・1回ごと+${25+5*(l-1)}%`},
  {id:'split',    name:'分裂', note:'戻ってきたかけらが当たると、ときどき2つに分かれて飛び出す',     unlock:30000,  cost:20000, st:1, max:10, v:l => `${Math.round(Math.min(.8,.2+.07*(l-1))*100)}%`},
  {id:'homing',   name:'誘導', note:'かけらがブロックへ早く戻ってくる',               unlock:50000,  cost:30000, st:1, max:10, v:l => `曲がる強さ ${l}`},
  {id:'pierce',   name:'貫通', note:'かけらがブロックを突き抜けて、もう一度戻ってくる',                       unlock:80000,  cost:45000, st:2, max:8,  v:l => `${l}枚`},
  {id:'bolt',     name:'雷撃', note:'当たったところから雷が走り、ブロックに何度も落ちる',       unlock:150000, cost:80000, st:3, max:10, v:l => `${Math.round(Math.min(.6,.15+.05*(l-1))*100)}%で${2+Math.floor((l-1)/2)}本`},
  {id:'burn',     name:'炎上', note:'かけらが当たるとブロックが燃え、少しずつダメージ',   unlock:250000, cost:120000, st:4, max:10, v:l => `毎秒 威力×${(0.8*(1+.3*(l-1))).toFixed(1)}`},
  {id:'blast',    name:'誘爆', note:'当たったところがときどき爆発する',                 unlock:400000, cost:180000, st:5, max:10, v:l => `${Math.round(Math.min(.5,.08+.04*(l-1))*100)}%`},
];
// 特殊強化：強化Lvなどが条件で現れる一発もの
const SPECIALS = [
  {cat:'idle', id:'dr1', name:'ドローン改良 I',   note:'ドローンの弾の威力 ×1.5',             ref:['drones',3], req:() => L('drones') >= 3, rq:'ドローンの台数 Lv3'},
  {cat:'idle', id:'dr2', name:'ドローン改良 II',  note:'ドローンの弾の威力 ×1.5',             ref:['drones',6],   req:() => L('drones') >= 6, rq:'ドローンの台数 Lv6'},
  {cat:'idle', id:'dr3', name:'ドローン改良 III', note:'ドローンの弾の威力 ×2',               ref:['drones',9],   req:() => L('drones') >= 9, rq:'ドローンの台数 Lv9'},
  {cat:'idle', id:'dr4', name:'ドローン軍団',     note:'ドローンの弾の威力 ×2',               ref:['drones',11],   req:() => L('drones') >= 11, rq:'ドローンの台数 Lv11'},
  {cat:'idle', id:'rl1', name:'速射機構',         note:'ドローンの発射間隔 ×0.8',             ref:['droneint',5],   req:() => L('droneint') >= 5, rq:'連射速度 Lv5'},
  {cat:'idle', id:'rl2', name:'二連装',           note:'ドローンが2発同時に撃つ',             ref:['droneint',8],    req:() => L('droneint') >= 8, rq:'連射速度 Lv8'},
  {cat:'idle', id:'sp1', name:'大共鳴',           note:'共鳴の威力 ×2',                       ref:['spawn',5],   req:() => L('spawn') >= 5, rq:'共鳴 Lv5'},
  {cat:'idle', id:'bu1', name:'榴弾',             note:'弾の炸裂で飛ぶ破片 ×2',               ref:['drburst',5],   req:() => L('drburst') >= 5, rq:'弾の炸裂 Lv5'},
  {cat:'arms', id:'cn1', name:'徹甲弾',           note:'砲台の威力 ×2・爆発範囲 ×1.2',        ref:['cannonN',3], req:() => L('cannonN') >= 3, rq:'砲台の数 Lv3'},
  {cat:'arms', id:'lz1', name:'十字照射',         note:'レーザーが横と縦の十字に撃つ',        ref:['laserN',3], req:() => L('laserN') >= 3, rq:'レーザーの数 Lv3'},
  {cat:'arms', id:'ms1', name:'多弾頭',           note:'ミサイルが着弾後に子弾を3つばらまく', ref:['missileN',3], req:() => L('missileN') >= 3, rq:'ミサイルの数 Lv3'},
  {cat:'arms', id:'bh1', name:'事象の地平線',     note:'ブラックホールの範囲 ×1.4',           ref:['holeN',2], req:() => L('holeN') >= 2, rq:'ブラックホールの数 Lv2'},
  // 兵器の威力を大きく伸ばす改良（ドローン改良と同じく、後半に兵器が置いていかれないように）
  ...ARMS.flatMap(a => [
    {cat:'arms', id:a.id + 'u1', name:a.name + '改良 I',  note:a.name + 'の威力 ×2', ref:[a.id + 'P', 10], req:() => L(a.id + 'P') >= 10, rq:a.name + 'の威力 Lv10'},
    {cat:'arms', id:a.id + 'u2', name:a.name + '改良 II', note:a.name + 'の威力 ×3', ref:[a.id + 'P', 25], req:() => L(a.id + 'P') >= 25, rq:a.name + 'の威力 Lv25'},
  ]),
  {cat:'tap',  id:'tp1', name:'鉄拳',             note:'タップのボスへの威力と衝撃波 ×2',     ref:['tapburst',5],   req:() => L('tapburst') >= 5, rq:'タップの破片 Lv5'},
  {cat:'tap',  id:'tp2', name:'連打の達人',       note:'長押しの連打が速くなる（毎秒4回→6回）', ref:['tapburst',10], req:() => L('tapburst') >= 10, rq:'タップの破片 Lv10'},
  {cat:'tap',  id:'ht1', name:'発熱体',           note:'タップで溜まる熱量 ×1.5',             ref:['heat',5],   req:() => L('heat') >= 5, rq:'熱量 Lv5'},
  {cat:'tap',  id:'fv1', name:'延長戦',           note:'フィーバー中もタップで熱量が溜まり、時間が延びる', ref:['fever',5], req:() => L('fever') >= 5, rq:'フィーバー Lv5'},
  {cat:'tap',  id:'sw1', name:'衝撃波拡大',       note:'衝撃波の半径 +1',                     ref:['tapboom',4],   req:() => L('tapboom') >= 4, rq:'衝撃波 Lv4'},
  {cat:'core', id:'sh1', name:'破片強化 I',       note:'破片の威力 ×2',                       ref:['power',25],   req:() => L('power') >= 25, rq:'破片の威力 Lv25'},
  {cat:'core', id:'sh2', name:'破片強化 II',      note:'破片の威力 ×2',                       ref:['power',60],   req:() => L('power') >= 60, rq:'破片の威力 Lv60'},
  {cat:'core', id:'sh3', name:'破片強化 III',     note:'破片の威力 ×3',                       ref:['power',120],   req:() => L('power') >= 120, rq:'破片の威力 Lv120'},
  {cat:'core', id:'cr1', name:'致命傷',           note:'クリティカルの倍率 ×4 → ×6',          ref:['crit',5],   req:() => L('crit') >= 5, rq:'クリティカル Lv5'},
  {cat:'core', id:'cr2', name:'超致命傷',         note:'クリティカルの倍率 → ×8',             ref:['crit',10],   req:() => L('crit') >= 10, rq:'クリティカル Lv10'},
  {cat:'core', id:'cb1', name:'コンボ維持',       note:'コンボの減衰が半分になる',           ref:['chain',20],   req:() => L('chain') >= 20, rq:'コンボ係数 Lv20'},
  {cat:'core', id:'cb2', name:'コンボ記憶',       note:'コンボの減衰がさらに半分になる',     ref:['chain',60],   req:() => L('chain') >= 60, rq:'コンボ係数 Lv60'},
  {cat:'core', id:'go1', name:'金塊',             note:'金ブロックの価値 ×2',                 ref:['gold',5],   req:() => L('gold') >= 5, rq:'金ブロック Lv5'},
  {cat:'core', id:'bm1', name:'大爆発',           note:'爆弾の半径 ×1.3・威力 ×2',            ref:['bomb',5],   req:() => L('bomb') >= 5, rq:'爆弾ブロック Lv5'},
  {cat:'core', id:'lk1', name:'幸運の星 I',       note:'幸運ブロックの出現間隔 −25%',        cost:2e5,   req:() => save.st.destroyed >= 2000, rq:'累計2,000個破壊'},
  {cat:'core', id:'lk2', name:'幸運の星 II',      note:'幸運ブロックの出現間隔 さらに −25%', cost:1e7,   req:() => save.st.lucky >= 10, rq:'幸運ブロック10回'},
  {cat:'core', id:'lk3', name:'幸運の持続',       note:'幸運ブロックの効果時間 ×1.5',        cost:1e8,   req:() => save.st.lucky >= 25, rq:'幸運ブロック25回'},
  {cat:'core', id:'lk4', name:'幸運の連鎖',       note:'幸運ブロックを叩くと破片が100個飛ぶ', cost:5e6, req:() => save.st.lucky >= 5, rq:'幸運ブロック5回'},
];
// ===== 遺物：ひびが満タンで砕けたとき（と幸運ブロックからたまに）落ちる。集めた遺物は全部効き、宇宙を砕いても消えない =====
// rar：0 コモン / 1 レア / 2 エピック / 3 レジェンド（名前・色・出る重み）。同じ遺物がまた出たらLvが上がる
const RARITY = [['コモン', '#b9c2cc', 62], ['レア', '#4cc9ff', 27], ['エピック', '#c38bff', 9], ['レジェンド', '#ffd84d', 2]];
const RELICS = [
  {id:'hammer',   name:'古代の槌',         rar:0, max:10, v:l => `破片の威力 +${10*l}%`},
  {id:'prop',     name:'錆びたプロペラ',   rar:0, max:10, v:l => `ドローンの威力 +${15*l}%`},
  {id:'cat',      name:'招き猫の欠片',     rar:0, max:10, v:l => `全部の報酬 +${10*l}%`},
  {id:'fist',     name:'鉄の拳',           rar:0, max:10, v:l => `タップの威力 +${20*l}%`},
  {id:'lens',     name:'拡大鏡',           rar:0, max:10, v:l => `クリティカル率 +${l}%`},
  {id:'powder',   name:'黒色火薬',         rar:0, max:10, v:l => `砲台の威力 +${20*l}%`},
  {id:'prism',    name:'プリズム',         rar:0, max:10, v:l => `レーザーの威力 +${20*l}%`},
  {id:'fuse',     name:'導火線',           rar:1, max:8,  v:l => `ミサイルの威力 +${25*l}%`},
  {id:'graviton', name:'重力子',           rar:1, max:8,  v:l => `ブラックホールの威力 +${25*l}%`},
  {id:'ember',    name:'消えない種火',     rar:1, max:8,  v:l => `フィーバーの時間 +${(.5*l).toFixed(1)}秒`},
  {id:'clover',   name:'四つ葉',           rar:1, max:8,  v:l => `幸運ブロックの出現間隔 −${Math.round((1-Math.pow(.95,l))*100)}%`},
  {id:'fork',     name:'音叉',             rar:1, max:8,  v:l => `共鳴 +${(.3*l).toFixed(1)}%`},
  {id:'blade',    name:'研がれた刃',       rar:1, max:8,  v:l => `クリティカルの倍率 +${(.5*l).toFixed(1)}`},
  {id:'comet',    name:'彗星の欠片',       rar:1, max:8,  v:l => `幸運ブロックの効果時間 +${10*l}%`},
  {id:'core',     name:'連鎖の核',         rar:2, max:5,  v:l => `爆発するかけらの確率 +${2*l}%`},
  {id:'hourglass',name:'止まった砂時計',   rar:2, max:5,  v:l => `放置ボーナスが溜まる時間 −${10*l}%`},
  {id:'gear',     name:'永久機関',         rar:2, max:5,  v:l => `兵器の連射 +${10*l}%`},
  {id:'crown',    name:'王冠',             rar:2, max:5,  v:l => `全部の報酬 ×${Math.pow(1.25,l).toFixed(2)}`},
  {id:'seed',     name:'ビッグバンの種',   rar:3, max:3,  v:l => `すべてのダメージ +${50*l}%`},
  {id:'tear',     name:'星屑の涙',         rar:3, max:3,  v:l => `星屑の獲得 +${25*l}%`},
  {id:'eye',      name:'創造主の眼',       rar:3, max:3,  v:l => `金のかけらの確率 +${3*l}%`},
];
const RL = id => save.relics[id] || 0;
const relicKinds = () => RELICS.filter(r => RL(r.id) > 0).length;
// 出す遺物を選ぶ：まずレア度を重みで決め、そのレア度で最大Lvでないものから1つ。全部最大ならほかのレア度から
function dropRelic(){
  let x = Math.random() * 100, rar = 0;
  for (let k = RARITY.length - 1; k >= 0; k--){ x -= RARITY[k][2]; if (x < 0){ rar = k; break; } }
  let pool = RELICS.filter(r => r.rar === rar && RL(r.id) < r.max);
  if (!pool.length) pool = RELICS.filter(r => RL(r.id) < r.max);
  if (!pool.length) return null;
  const r = pool[Math.floor(Math.random() * pool.length)];
  save.relics[r.id] = RL(r.id) + 1; save.st.relics++;
  fx.relic(r, RL(r.id));
  return r;
}

// ===== 兵器の進化：威力のLvが一定に届くと、名前と見た目が変わって威力 ×4 =====
// 1段目は「宇宙」、2段目は「終焉」に一度でも届いていることも条件（到達記録は砕いても残るので、周回の目標になる）
const EVO = {
  drone:   {base:'ドローン', up:'dronedmg', upName:'弾の威力', at:[50, 120], names:['戦闘機', '宇宙戦艦'], cols:['#ff4c88', '#ffd84d']},
  cannon:  {base:'砲台', up:'cannonP', upName:'砲台の威力', at:[40, 80], names:['レールガン', '反物質砲'], cols:['#4cc9ff', '#ff4cf0']},
  laser:   {base:'レーザー', up:'laserP', upName:'レーザーの威力', at:[40, 80], names:['プラズマ砲', '光子砲'], cols:['#4c9bff', '#fff3b0']},
  missile: {base:'ミサイル', up:'missileP', upName:'ミサイルの威力', at:[40, 80], names:['核ミサイル', '恒星爆弾'], cols:['#b6ff3b', '#ffffff']},
  hole:    {base:'ブラックホール', up:'holeP', upName:'ブラックホールの威力', at:[40, 80], names:['特異点', 'ビッグクランチ'], cols:['#ff4c88', '#ffd84d']},
};
const EVO_AT = [UNIVERSE, UNIVERSE + 5];
const evo = id => (SP(id + 'e1') ? 1 : 0) + (SP(id + 'e2') ? 1 : 0);
const armName = id => evo(id) ? EVO[id].names[evo(id) - 1] : EVO[id].base;
const evoCol = (id, def) => evo(id) ? EVO[id].cols[evo(id) - 1] : def;
for (const [id, e] of Object.entries(EVO)) for (let k = 0; k < 2; k++){
  SPECIALS.push({cat:id === 'drone' ? 'idle' : 'arms', id:`${id}e${k + 1}`, evo:true, name:`進化：${e.names[k]}`, note:`${k ? e.names[0] : e.base}が${e.names[k]}に進化する。威力 ×4・見た目が変わる`,
    ref:[e.up, e.at[k]], req:() => L(e.up) >= e.at[k] && save.st.deepest >= EVO_AT[k] && (k === 0 || SP(id + 'e1')), rq:`${e.upName} Lv${e.at[k]}・${STAGES[EVO_AT[k]].name}に到達`});
}
// ===== シナジー：別々の系統どうしを掛け合わせて火力を伸ばす特殊強化 =====
const ARM_RELIC = {cannon:['powder', .2], laser:['prism', .2], missile:['fuse', .25], hole:['graviton', .25]};
const armCount = () => ARMS.reduce((a, x) => a + L(x.id + 'N'), 0);
// 遺物・進化・シナジーの火力の倍率。これらは「ひびの進み」だけを速くし、コインには効かせない
// （コインはダメージに比例するので、効かせると ダメージ→コイン→強化→ダメージ の雪だるまで1周が数分で終わってしまう）
const coreX = () => (1 + .1 * RL('hammer')) * (SP('sy3') ? 1 + .005 * Object.keys(save.ach).length : 1) * (SP('sy7') ? 1 + .005 * modTotal() : 1);
const droneX = () => (1 + .15 * RL('prop')) * Math.pow(4, evo('drone')) * (SP('sy1') ? 1 + .03 * armCount() : 1);
const armX = id => (1 + ARM_RELIC[id][1] * RL(ARM_RELIC[id][0])) * Math.pow(4, evo(id)) * (SP('sy2') ? 1 + .03 * stat.drones() : 1);
const modTotal = () => MODS.reduce((a, m) => a + ML(m.id), 0);
SPECIALS.push(
  {cat:'idle', id:'sy1', name:'兵器連動',     note:'兵器の台数の合計1台ごとに、ドローンの威力 +3%',        cost:5e6, req:() => armCount() >= 12, rq:'兵器の台数 合計12台'},
  {cat:'arms', id:'sy2', name:'編隊射撃',     note:'ドローン1台ごとに、兵器の威力 +3%',                    cost:5e6, req:() => L('drones') >= 10, rq:'ドローンの台数 Lv10'},
  {cat:'core', id:'sy3', name:'実績の力',     note:'実績1個ごとに、破片の威力 +0.5%',                      cost:1e7, req:() => Object.keys(save.ach).length >= 35, rq:'実績35個'},
  {cat:'tap',  id:'sy4', name:'コンボ火力',   note:'コンボ200ごとに、すべてのダメージ +5%（最大 +50%）',   cost:1e7, req:() => save.best >= 1000, rq:'最高コンボ1,000'},
  {cat:'tap',  id:'sy5', name:'熱暴走',       note:'フィーバー中、ドローンと兵器の連射 ×1.5',              cost:1e7, req:() => save.st.fevers >= 20, rq:'フィーバー20回'},
  {cat:'core', id:'sy6', name:'遺物共鳴',     note:'遺物1種類ごとに、すべてのダメージ +2%',                cost:2e7, req:() => relicKinds() >= 8, rq:'遺物8種類'},
  {cat:'core', id:'sy7', name:'モジュール共鳴', note:'モジュールのLv合計1ごとに、破片の威力 +0.5%',       cost:2e7, req:() => modTotal() >= 40, rq:'モジュールLv合計40'},
  {cat:'idle', id:'sy8', name:'共鳴増幅',     note:'共鳴 +5%',                                             cost:2e7, req:() => L('spawn') >= 15, rq:'共鳴 Lv15'},
);

// 星屑で買う永続強化（砕いても残る）
const PERM = [
  {id:'pmult',  name:'星屑の輝き',     note:'全部の報酬 +10%',                       cost:4,  g:1.6, max:20, v:l => `+${l*10}%`},
  {id:'pdrone', name:'初期ドローン',   note:'最初からドローンが多い',                cost:8,  g:1.8, max:5,  v:l => `+${l}台`},
  {id:'pstage', name:'先の素材から',   note:'砕いたあと、先の素材から始まる',        cost:10, g:1.8, max:7,  v:l => l ? `${STAGES[l].name}から` : '木箱から'},
  {id:'plucky', name:'幸運の軌道',     note:'幸運ブロックの出現間隔 −15%',           cost:12, g:1.7, max:5,  v:l => `−${Math.round((1-Math.pow(.85,l))*100)}%`},
  {id:'pgauge', name:'因果の短縮',     note:'ボス出現に必要な稼ぎ −8%',              cost:6,  g:1.9, max:5,  v:l => `−${Math.round((1-Math.pow(.92,l))*100)}%`},
  {id:'pauto',  name:'自動タップ',     note:'毎秒勝手にタップする（熱量は半分。幸運ブロックは叩かない）', cost:40, g:2.2, max:3, v:l => `毎秒${l}回`},
  {id:'poff',   name:'長期休暇',       note:'オフライン収入の上限時間 +4時間',      cost:10, g:1.7, max:4,  v:l => `${8+4*l}時間`},
  {id:'pmodc',  name:'モジュール工房', note:'モジュールの値段 −30%',                 cost:30, g:2.5, max:2,  v:l => `−${Math.round((1-Math.pow(.7,l))*100)}%`},
  {id:'pkeep',  name:'モジュール記憶', note:'砕いてもモジュールのLvが残る',          cost:80, g:1,   max:1,  v:l => l ? '有効' : '無効'},
  {id:'pcrit',  name:'星の眼',         note:'クリティカル率 +5%',                    cost:15, g:1.8, max:4,  v:l => `+${5*l}%`},
];
const upG = u => u.inf ? u.g : Math.pow(TUNE.valStage, u.span / u.max);
const upCost  = (u, l = L(u.id)) => Math.ceil(u.cost * TUNE.costX * Math.pow(upG(u), l));
const upCostN = (u, n) => { let s = 0; for (let k = 0; k < n; k++) s += upCost(u, L(u.id) + k); return s; };
const upMaxN  = u => { let n = 0, s = 0; while (L(u.id) + n < u.max){ const c = upCost(u, L(u.id) + n); if (s + c > save.coins) break; s += c; n++; } return n; };
// モジュールは st 段目あたりで解放できる値段。Lvは modSpan 段かけて上限へ
const modCost = m => Math.ceil((ML(m.id) ? m.cost * Math.pow(TUNE.valStage, TUNE.modSpan * (ML(m.id) - 1) / m.max) : m.unlock) * TUNE.costX * sv(m.st) * Math.pow(.7, P('pmodc')));
// Lv条件の特殊強化は、条件になったLvの値段の4倍。記録条件のものは今の素材の価値に合わせる
const spCost = s => Math.ceil(s.ref ? 4 * upCost(UPG.find(u => u.id === s.ref[0]), s.ref[1]) : s.cost * TUNE.costX * sv(save.stage) / 10);
const permCost = p => Math.ceil(p.cost * Math.pow(p.g, P(p.id)));

// 幸運ブロックの効果（バフ）
const buffs = {frenzy:0, barrage:0, awaken:0, storm:0};
const BUFF_INFO = {frenzy:['フレンジー 報酬×7', '#ffd84d'], barrage:['弾幕 連射×8', '#4cc9ff'], awaken:['覚醒 クリティカル100%', '#ffe14d'], storm:['破片嵐', '#ff4c88']};
const achCount = () => Object.keys(save.ach).length;
// ずっと残る倍率（実績・星屑）。ボスゲージの進みからは除く（周回で極端に速くならないように）
const permMult = () => (1 + .01 * achCount()) * (1 + TUNE.pmultBonus * P('pmult')) * (1 + TUNE.dustBonus * save.st.bestDust);
// 放置ボーナス：最後に手でタップしてから idleRamp 秒かけて、報酬が最大 idleBonus 倍まで上がる
const idleMult = () => 1 + (TUNE.idleBonus - 1) * Math.min(1, lastTap / (TUNE.idleRamp * (1 - .1 * RL('hourglass'))));
const idleDmg = () => 1 + (idleMult() - 1) * TUNE.idleDmgK;
const rewardMult = () => permMult() * idleMult() * (buffs.frenzy > 0 ? 7 : 1) * (fever > 0 ? TUNE.feverReward : 1) * (1 + .1 * RL('cat')) * Math.pow(1.25, RL('crown'));
// 相場はその周だけの倍率なので、ボスゲージにも効く
// 強化ボーナス：どの強化でも1Lv買うごとに稼ぎ（とボスゲージの進み）が +lvBonus。特定の強化を買わなくても詰まらないように
const lvTotal = () => { let n = 0; for (const k in save.lv) n += save.lv[k]; return n; };
const lvMult = () => 1 + TUNE.lvBonus * lvTotal();
const comboMult = () => (1 + Math.sqrt(combo) * stat.chain()) * stat.market() * lvMult();
const luckyInterval = () => 110 * (SP('lk1') ? .75 : 1) * (SP('lk2') ? .75 : 1) * Math.pow(.85, P('plucky')) * Math.pow(.95, RL('clover'));

const stat = {
  shards:   () => 3 + L('shards'),
  dmg:      () => 100 * Math.pow(TUNE.fdmg, save.stage) * (1 + .2 * L('power')) * (SP('sh1') ? 2 : 1) * (SP('sh2') ? 2 : 1) * (SP('sh3') ? 3 : 1)
              * coreX(),
  drones:   () => Math.min(12, 1 + L('drones') + P('pdrone')),
  droneInt: () => TUNE.droneInt * Math.pow(.85, L('droneint')) * (SP('rl1') ? .8 : 1) * (buffs.barrage > 0 ? .125 : 1) * (SP('sy5') && fever > 0 ? 2 / 3 : 1),
  droneDmg: () => TUNE.droneDmg * (1 + .25 * L('dronedmg')) * (SP('dr1') ? 1.5 : 1) * (SP('dr2') ? 1.5 : 1) * (SP('dr3') ? 2 : 1) * (SP('dr4') ? 2 : 1)
              * droneX(),
  reso:     (l = L('spawn')) => TUNE.reso * l * (SP('sp1') ? 2 : 1) + .003 * RL('fork') + (SP('sy8') ? .05 : 0),
  drburst:  () => L('drburst') * 2 * (SP('bu1') ? 2 : 1),
  tapburst: () => 2 + L('tapburst'),
  tapPow:   () => (SP('tp1') ? 2 : 1) * (1 + .2 * RL('fist')),
  heat:     () => (8 + 2 * L('heat')) * (SP('ht1') ? 1.5 : 1),
  fever:    () => 5 + L('fever') + .5 * RL('ember'),
  tapboom:  () => L('tapboom'),
  chain:    () => 0.1 + 0.05 * L('chain'),
  market:   () => 1 + .1 * L('market'),
  crit:     () => buffs.awaken > 0 ? 1 : 0.05 + 0.03 * L('crit') + .05 * P('pcrit') + .01 * RL('lens'),
  critX:    () => (SP('cr2') ? 8 : SP('cr1') ? 6 : 4) + .5 * RL('blade'),
  bomb:     () => Math.min(.25, .02 + .015 * L('bomb')) + .02 * RL('core'),
  gold:     () => Math.min(.2, .01 + .01 * L('gold')) + .03 * RL('eye'),
  keep:     () => .65 + .025 * L('keep'),
  decay:    () => TUNE.comboDecay * (SP('cb1') ? .5 : 1) * (SP('cb2') ? .5 : 1),
  holdMs:   () => SP('tp2') ? 170 : 250,
};
// 暗黒物質以降はHPの伸びをダメージと揃える（差が積み重なって終盤だけ詰まるのを防ぐ）
// HPは威力と同じ伸び（×4000/段）に加えて、強化で積み上がる火力に見合うよう (1+段階)^hpPow 倍を上乗せする（掘る速さ＝威力÷HP）
const blockHp = s => 300 * TUNE.hpMul * Math.pow(TUNE.fhp, s) * Math.pow(1 + s, TUNE.hpPow);
// 何体目か：先の素材から始めても軽くならないよう、素材の段階と撃破数の大きいほう
const bossK = () => Math.max(save.stage, save.kills);
// 稼ぎの倍率は「相場」×「コンボ係数」で、どちらもボス撃破のたびに買えるLvに比例して伸びる（段階の2乗ほど）。
// ゲージはそれに合わせて (1 + gaugeA×段階)² で伸ばし、さらに (1 + 段階)^gaugePow で後半ほど少し長くする
// 巨大ブロックが砕けるまでに必要なダメージ（ブロック1個ぶんのHPの何個分か × (1+段階)^reqPow）
const gaugeNeed = () => blockHp(save.stage) * TUNE.reqBase * Math.pow(1 + bossK(), TUNE.reqPow) * Math.pow(.92, P('pgauge'));
const bossHp = () => blockHp(save.stage) * TUNE.bossHp * Math.pow(TUNE.bossGrow, bossK());
const dustGain = () => { if (save.stage < PRESTIGE_STAGE) return 0; const lv = Math.log10(TUNE.valStage) / 5; return Math.floor(TUNE.dustBase * Math.pow(2, (Math.log10(Math.max(1, save.st.earnedRun)) - 37 * lv) / (TUNE.dustDiv * lv)) * (1 + .25 * RL('tear'))); };

let W = 390, H = 560, cell = 55.7, ucell = 55.7, topBand = 0, botBand = 0;
let BX = 195, BY = 300, BS = 240, big = {flash:0, wob:0, wx:0, wy:0, spawn:1, burn:0, burnDps:0, burnAcc:0, bd:0};
// blocks と boss は旧方式の名残（常に空）。表示側の互換のために残している
let blocks = [], boss = null, shards = [], booms = [], zaps = [], bullets = [], drones = [], lucky = null;
// 連鎖で爆発・雷が増えすぎると重くなるので、保留できる数に上限を付ける。あふれた分はダメージだけまとめて次のフレームで与える
const MAXB = 48, MAXZ = 16;
let overflow = {};
function queueBoom(e){ if (booms.length < MAXB) booms.push(e); else overflow[e.src] = (overflow[e.src] || 0) + e.dmg; }
let shells = [], beams = [], missiles = [], holes = [], armT = {}, armK = 0;
let combo = 0, fever = 0, heat = 0, state = 'title', lastTap = 0, earnedTick = 0, luckyT = 60, autoT = 0;
let MAXS = 900;   // 破片の上限（自動画質で変わる）
const fx = {dig(){}, arm(){}, beam(){}, hole(){}, hit(){}, brk(){}, boom(){}, bolt(){}, fever(){}, milestone(){}, tap(){}, split(){}, bossHit(){}, bossSpawn(){}, bossDie(){}, shoot(){}, land(){}, lucky(){}, luckyHit(){}, ach(){}, relic(){}};
const TIERS = [[25, 'いいぞ', '#ffe14d'], [50, 'ナイス！', '#ffe14d'], [100, 'スゴい！', '#ff9a3c'], [250, 'ヤバい！', '#ff4c88'], [500, '狂気', '#c38bff'], [1000, '神', '#4cc9ff'], [2500, '宇宙', '#ffffff'], [5000, '無量大数', '#ffffff']];
let milestoneSeen = 0;

// ===== 巨大ブロック =====
// 画面中央に大きなブロックが1つ。何度叩いても壊れず、与えたダメージがひびとして溜まる。
// ひびが満タン（ダメージがノルマに届く）になると砕け、次の素材のブロックが降ってくる。
function layout(w, h){
  W = w; H = h;
  // ucell：文字やドローンの大きさの基準。cell：演出（かけら・爆発）の大きさの基準
  ucell = Math.max(40, Math.min(90, Math.min(W, H) / 7));
  topBand = ucell * .9; botBand = ucell * .8;
  BS = Math.min(W * .62, (H - topBand - botBand) * .62);
  BX = W / 2; BY = topBand + (H - topBand - botBand) / 2;
  cell = BS / 6;
  drones = []; for (let k = 0; k < 12; k++) drones.push({x:W * (k + .5) / 12, y:topBand * .5, t:Math.random() * 3, ph:Math.random() * 6});
}
const freshBig = () => ({flash:0, wob:0, wx:0, wy:0, spawn:0, burn:0, burnDps:0, burnAcc:0, bd:0});
function buildGrid(){ big = freshBig(); big.spawn = 1; }
const rnd = (a, b) => a + Math.random() * (b - a);
const inBig = (x, y, pad = 0) => Math.abs(x - BX) <= BS / 2 + pad && Math.abs(y - BY) <= BS / 2 + pad;
// 巨大ブロックの表面のどこか
const bigPoint = () => [BX + rnd(-.42, .42) * BS, BY + rnd(-.42, .42) * BS];
function earn(gain){ save.coins += gain; earnedTick += gain; save.st.earnedRun += gain; save.st.earnedAll += gain; return gain; }
// ひびが満タンになったら砕けて次の素材へ
function shatter(){
  const gain = earn(100 * sv(save.stage) * TUNE.bossReward * comboMult() * rewardMult());
  save.kills++; save.st.bosses++; save.prog = 0;
  const prevStage = save.stage;
  // 宇宙を初めて砕いたらエンディング。そのあとも「宇宙の先」へ進める
  if (save.stage === UNIVERSE) save.ended = true;
  if (save.stage < STAGES.length - 1) save.stage++;
  save.st.deepest = Math.max(save.st.deepest, save.stage);
  dropRelic();
  big = freshBig();
  shards = []; holes = [];
  fx.bossDie(prevStage, gain);
}

function spawnLucky(){
  const side = Math.random() < .5 ? -1 : 1, y = topBand + (H - topBand - botBand) * rnd(.1, .9);
  lucky = {x:side < 0 ? -cell : W + cell, y, vx:-side * cell * .55, vy:0, life:14 + (SP('lk3') ? 4 : 0), ph:Math.random() * 6, r:ucell * .42};
  fx.lucky(lucky);
}
function hitLucky(){
  const lk = lucky; lucky = null; save.st.lucky++;
  const dur = (SP('lk3') ? 1.5 : 1) * (1 + .1 * RL('comet'));
  const roll = Math.random(); let kind, text;
  if (roll < .36){ kind = 'frenzy'; buffs.frenzy = 60 * dur; text = 'フレンジー！　報酬 ×7'; }
  else if (roll < .58){ kind = 'barrage'; buffs.barrage = 25 * dur; text = '弾幕！　ドローン連射 ×8'; }
  else if (roll < .76){ kind = 'rain'; const g = earn(Math.max(100 * sv(save.stage) * 200, save.idleRate * 900) * rewardMult()); text = 'コイン雨！　+' + fmt(g); }
  else if (roll < .92){ kind = 'awaken'; buffs.awaken = 20 * dur; text = '覚醒！　クリティカル100%'; }
  else { kind = 'storm'; buffs.storm = 1; text = 'かけら嵐！'; spawnShards(lk.x, lk.y, 300, 0); }
  if (SP('lk4')) spawnShards(lk.x, lk.y, 100, 0);
  if (Math.random() < .15) dropRelic();
  heat = Math.min(100, heat + 30);
  fx.luckyHit(lk, text, kind);
}

function tap(x, y, auto){
  if (state !== 'play') return false;
  if (!auto){ lastTap = 0; save.st.taps++; }
  if (!auto && lucky && Math.hypot(lucky.x - x, lucky.y - y) < lucky.r * 1.6){ hitLucky(); fx.tap(x, y); return true; }
  if (!inBig(x, y, cell * .4)) return false;
  const fv = stat.fever();
  if (fever > 0){ if (SP('fv1')) fever = Math.min(fv * 2, fever + stat.heat() / 100 * fv * .5); }
  else { heat += stat.heat() * (auto ? .5 : 1); if (heat >= 100){ heat = 0; fever = fv; save.st.fevers++; fx.fever(); } }
  hit(stat.dmg() * 3 * stat.tapPow(), auto ? 'auto' : 'tap', x, y, 0, stat.shards() * stat.tapburst());
  const tb = stat.tapboom();
  if (tb) queueBoom({x, y, R:cell * (1 + .3 * tb + (SP('sw1') ? 1 : 0)), dmg:stat.dmg() * tb * 2 * stat.tapPow(), t:.04, big:false, quiet:true, d:1, src:'tapboom'});
  fx.tap(x, y);
  return true;
}
// かけら：当たった所から外へ飛び出し、ブロックに引き寄せられて弧を描いて戻り、もう一度当たる。
// d：連鎖の深さ。深いほど威力が stat.keep() 倍ずつ落ちる
function spawnShards(x, y, n, d = 0, gen = 0){
  const ric = M('ricochet'), b = ric ? 1 + ric : 0, p = M('pierce');
  const out = inBig(x, y) ? Math.atan2(y - BY, x - BX) : Math.random() * 6.283;
  for (let k = 0; k < n; k++){
    if (shards.length >= MAXS) break;
    const a = out + rnd(-1.3, 1.3), v = cell * rnd(5, 9);
    shards.push({x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:2, b, p, nb:0, gen, d, out:!inBig(x, y)});
  }
}
let resoWin = 0, resoT = 1, shatterPending = false;
const BIG_KICK = new Set(['boom', 'laser', 'cannon', 'missile', 'bomb', 'blast', 'tapboom']);
// 火力の内訳：出どころごとのダメージを集計し、1秒ごとに直近10秒ほどの移動平均（毎秒あたり）にする
const DPS_GROUP = {tap:'tap', auto:'tap', tapboom:'tap'};
let dpsAcc = {}, dps = {}, dpsT = 0;
function trackDps(dt){
  dpsT += dt; if (dpsT < 1) return;
  const keys = new Set([...Object.keys(dps), ...Object.keys(dpsAcc)]);
  for (const k of keys){ dps[k] = (dps[k] || 0) * .9 + (dpsAcc[k] || 0) / dpsT * .1; if (dps[k] < 1e-300) delete dps[k]; }
  dpsAcc = {}; dpsT = 0;
}
// 兵器のON/OFF（save.off[id] が 1 なら撃たない）
const armOn = id => !(save.off && save.off[id]);
// すべてのダメージに効く倍率（遺物「ビッグバンの種」、シナジー）
const allDmg = () => (1 + .5 * RL('seed')) * (SP('sy4') ? 1 + Math.min(.5, combo / 4000) : 1) * (SP('sy6') ? 1 + .02 * relicKinds() : 1);
function hit(dmg, src, x, y, d = 0, burst = 0){
  let crit = false;
  if (src !== 'burn' && src !== 'reso' && Math.random() < stat.crit()){ dmg *= stat.critX(); crit = true; }
  // 共鳴は「すでに倍率がかかったダメージ」を元にするので、フィーバー・放置ボーナスをかけ直さない。
  // 炎上のフィーバー分は burnAcc でかけ済み
  if (fever > 0 && src !== 'burn' && src !== 'reso') dmg *= 2;
  // 放置ボーナスはダメージにも約1/3の強さで効く（最大×3.1）（放置でもひびが進むように）
  if (src !== 'reso') dmg *= idleDmg() * allDmg();
  // 進み（ひび）は与えたダメージ。直接タップは tapProg 倍
  save.prog += dmg * (src === 'tap' ? TUNE.tapProg : 1);
  { const D = globalThis.__dmg = globalThis.__dmg || {}; D[src] = (D[src] || 0) + dmg; }
  { const g = DPS_GROUP[src] || src; dpsAcc[g] = (dpsAcc[g] || 0) + dmg; }
  combo += src === 'burn' || src === 'reso' ? .2 : 1; save.st.destroyed++;
  // コインは与えたダメージに比例（ブロック1個ぶんのHPで、その素材のブロック1個ぶんの価値）
  const nx = allDmg() * coreX() * (src === 'drone' ? droneX() : ARM_RELIC[src] ? armX(src) : 1);
  let gain = 100 * sv(save.stage) * dmg / nx / blockHp(save.stage) * comboMult() * rewardMult(), gold = false;
  if (src !== 'burn' && src !== 'reso' && Math.random() < stat.gold()){ gain *= 15 * (SP('go1') ? 2 : 1); gold = true; }
  earn(gain);
  if (src !== 'reso') resoWin += dmg;
  big.flash = 1;
  const kick = src === 'tap' || src === 'auto' ? .45 : BIG_KICK.has(src) ? .25 : .06;
  big.wob = Math.min(1, big.wob + kick); big.wx = (x - BX) / BS; big.wy = (y - BY) / BS;
  fx.hit(x, y, dmg, crit, gain, gold, src);
  const nd = d + 1, kp = Math.pow(stat.keep(), nd);
  if (burst) spawnShards(x, y, burst, nd);
  if (src !== 'burn' && src !== 'reso'){
    if (Math.random() < stat.bomb() * .3) queueBoom({x, y, R:cell * 1.7 * (SP('bm1') ? 1.3 : 1), dmg:stat.dmg() * 5 * (SP('bm1') ? 2 : 1) * kp, t:.08, big:true, d:nd, src:'bomb'});
    const bl = M('blast');
    if (bl && Math.random() < Math.min(.5, .08 + .04 * (bl - 1)) * .3) queueBoom({x, y, R:cell * 1.25, dmg:stat.dmg() * 2 * kp, t:.08, big:false, d:nd, src:'blast'});
    const bo = M('bolt');
    if (bo && Math.random() < Math.min(.6, .15 + .05 * (bo - 1)) * .3){
      const n = 2 + Math.floor((bo - 1) / 2);
      if (zaps.length < MAXZ) zaps.push({x, y, n, t:.05, d:nd}); else overflow.bolt = (overflow.bolt || 0) + stat.dmg() * 3 * Math.pow(stat.keep(), nd) * n;
    }
    if (src === 'shard' && M('burn')){ big.burn = 2; big.burnDps = Math.max(big.burnDps * .9, stat.dmg() * .8 * (1 + .3 * (M('burn') - 1))); big.bd = d; }
  }
  const cm = Math.floor(combo);
  if (cm > save.best) save.best = cm;
  for (const [n, name] of TIERS) if (cm === n && cm > milestoneSeen){ milestoneSeen = cm; fx.milestone(cm, name); }
  // 砕けるのはフレームの最後（かけらなどの処理中に一覧を空にしないため）
  if (save.prog >= gaugeNeed()) shatterPending = true;
}
function fireDrone(dr){
  const [tx, ty] = bigPoint();
  const dx = tx - dr.x, dy = ty - dr.y, len = Math.hypot(dx, dy) || 1, v = cell * 16;
  bullets.push({x:dr.x, y:dr.y, vx:dx / len * v, vy:dy / len * v, tx, ty, life:len / v + .05});
  fx.shoot(dr, tx, ty);
}
const armRate = () => (1 + TUNE.armIdle * (idleMult() - 1) / (TUNE.idleBonus - 1)) * (1 + .1 * RL('gear')) * (SP('sy5') && fever > 0 ? 1.5 : 1);
const armPow = id => (1 + .25 * L(id + 'P')) * (id === 'cannon' && SP('cn1') ? 2 : 1) * (SP(id + 'u1') ? 2 : 1) * (SP(id + 'u2') ? 3 : 1)
  * armX(id);
// 兵器1発の威力（破片1つの何倍か）。ブラックホールは1回の吸い込みぶん（最後の爆発はその5倍）
const ARM_BY = Object.fromEntries(ARMS.map(a => [a.id, a]));
const armDmg = id => ARM_BY[id].dmg * TUNE.armMul * armPow(id);
function fireArm(a, n){
  const [tx, ty] = bigPoint();
  if (a.id === 'cannon'){
    armK = (armK + 1) % n;
    const x0 = W * (armK + .5) / n, y0 = H - ucell * .2, d = Math.hypot(tx - x0, ty - y0);
    shells.push({x0, y0, tx, ty, t:0, dur:.45 + d / (cell * 18)});
    fx.arm('cannon', x0, y0);
  } else if (a.id === 'laser'){
    beams.push({kind:'row', y:ty, t:.55, fireAt:.25, fired:false});
    if (SP('lz1')) beams.push({kind:'col', x:tx, t:.55, fireAt:.25, fired:false});
    fx.arm('laser', 0, ty);
  } else if (a.id === 'missile'){
    const x = W * (.1 + Math.random() * .8), y = H + cell * .3;
    missiles.push({x, y, vx:(Math.random() - .5) * cell * 4, vy:-cell * 7, tx, ty, life:4});
    fx.arm('missile', x, y);
  } else if (a.id === 'hole'){
    const R = cell * 1.6 * (SP('bh1') ? 1.4 : 1) * (1 + .3 * evo('hole'));
    holes.push({x:tx, y:ty, life:3, max:3, tick:0, R});
    fx.hole(tx, ty, R);
  }
}
function stepArms(dt){
  for (const a of ARMS){
    const n = L(a.id + 'N'); if (!n || !armOn(a.id)) continue;
    // 放置ボーナスで連射を上げる場合は TUNE.armIdle（今は0：兵器は威力が強いぶん、連射は上げない）
    armT[a.id] = (armT[a.id] || Math.random()) + dt * n / a.every * armRate();
    while (armT[a.id] >= 1){ armT[a.id] -= 1; fireArm(a, n); }
  }
  const base = stat.dmg();
  for (let k = shells.length - 1; k >= 0; k--){
    const o = shells[k]; o.t += dt;
    if (o.t >= o.dur){ shells.splice(k, 1); booms.push({x:o.tx, y:o.ty, dmg:base * armDmg('cannon'), t:0, big:false, arm:true, d:0, burst:3 + 2 * evo('cannon'), src:'cannon', R:cell * 1.4 * (SP('cn1') ? 1.2 : 1) * (1 + .3 * evo('cannon'))}); }
  }
  for (let k = beams.length - 1; k >= 0; k--){
    const b = beams[k]; b.t -= dt;
    if (!b.fired && b.t <= b.fireAt){
      b.fired = true;
      hit(base * armDmg('laser'), 'laser', b.kind === 'row' ? BX : b.x, b.kind === 'row' ? b.y : BY, 0, 2);
      fx.beam(b);
    }
    if (b.t <= 0) beams.splice(k, 1);
  }
  for (let k = missiles.length - 1; k >= 0; k--){
    const m = missiles[k], dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy) || 1, sp = cell * 10;
    const f = Math.min(1, dt * 3.5); m.vx += (dx / d * sp - m.vx) * f; m.vy += (dy / d * sp - m.vy) * f;
    m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt;
    if (d < cell * .4 || m.life <= 0){
      missiles.splice(k, 1);
      const p = armDmg('missile');
      booms.push({x:m.x, y:m.y, R:cell * 2.2 * (1 + .4 * evo('missile')), dmg:base * p, t:0, big:false, arm:true, missile:true, d:0, burst:8, src:'missile'});
      if (SP('ms1')) for (let q = 0; q < 3; q++){ const [sx, sy] = bigPoint(); booms.push({x:sx, y:sy, R:cell * 1.2, dmg:base * .4 * p, t:.12 + q * .06, big:false, arm:true, d:0, src:'missile'}); }
    }
  }
  for (let k = holes.length - 1; k >= 0; k--){
    const h = holes[k]; h.life -= dt; h.tick -= dt;
    if (h.tick <= 0){ h.tick = .25; hit(base * armDmg('hole'), 'hole', h.x, h.y, 0); }
    if (h.life <= 0){ holes.splice(k, 1); booms.push({x:h.x, y:h.y, R:h.R * 1.4, dmg:base * 5 * armDmg('hole'), t:0, big:true, d:0, burst:10, src:'hole'}); }
  }
}
function step(dt){
  if (state !== 'play') return;
  lastTap += dt; save.st.time += dt;
  if (big.flash > 0) big.flash = Math.max(0, big.flash - dt * 8);
  if (big.wob > 0) big.wob = Math.max(0, big.wob - dt * 4);
  if (big.spawn < 1) big.spawn = Math.min(1, big.spawn + dt * 1.6);
  // 炎上：燃えている間、少しずつダメージ
  if (big.burn > 0){
    big.burn -= dt; big.burnAcc += big.burnDps * dt * (fever > 0 ? 2 : 1);
    if (big.burnAcc > 0 && Math.random() < dt * 4){ const [x, y] = bigPoint(); hit(big.burnAcc, 'burn', x, y, big.bd); big.burnAcc = 0; }
  }
  // 共鳴：直前1秒に与えたダメージの一部を、もう一度与える
  resoT -= dt;
  if (resoT <= 0){ resoT = 1; const r = stat.reso(); if (r && resoWin > 0){ const [x, y] = bigPoint(); hit(resoWin * r, 'reso', x, y); } resoWin = 0; }
  // 幸運ブロック
  luckyT -= dt;
  if (!lucky && luckyT <= 0){ spawnLucky(); luckyT = luckyInterval() * (.7 + Math.random() * .6); }
  if (lucky){
    lucky.ph += dt; lucky.x += lucky.vx * dt; lucky.y += Math.sin(lucky.ph * 1.3) * cell * .6 * dt; lucky.life -= dt;
    if (lucky.life <= 0 || lucky.x < -cell * 1.5 || lucky.x > W + cell * 1.5) lucky = null;
  }
  // 自動タップ（星屑）
  if (P('pauto')){
    autoT += dt;
    if (autoT >= 1 / P('pauto')){ autoT = 0; const [x, y] = bigPoint(); tap(x, y, true); }
  }
  // ドローン
  const nd = armOn('drone') ? stat.drones() : 0, di = stat.droneInt() * (fever > 0 ? .5 : 1);
  for (let k = 0; k < nd; k++){
    const dr = drones[k]; dr.ph += dt; dr.t -= dt;
    if (dr.t <= 0){ dr.t = di * (.8 + Math.random() * .4); fireDrone(dr); if (SP('rl2')) fireDrone(dr); }
  }
  stepArms(dt);
  for (let k = bullets.length - 1; k >= 0; k--){
    const u = bullets[k]; u.x += u.vx * dt; u.y += u.vy * dt; u.life -= dt;
    if (u.life <= 0){ bullets.splice(k, 1); hit(stat.dmg() * stat.droneDmg(), 'drone', u.tx, u.ty, 0, stat.drburst()); }
  }
  // かけら
  const dmg = stat.dmg(), hom = M('homing'), sp = M('split');
  const ricBonus = M('ricochet') ? .25 + .05 * (M('ricochet') - 1) : 0;
  const splitP = sp ? Math.min(.8, .2 + .07 * (sp - 1)) : 0;
  const pull = cell * (16 + 6 * hom);
  for (let s = shards.length - 1; s >= 0; s--){
    const o = shards[s]; let dead = false;
    const dx = BX - o.x, dy = BY - o.y, dd = Math.hypot(dx, dy) || 1;
    o.vx += dx / dd * pull * dt; o.vy += dy / dd * pull * dt;
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.x < 0 || o.x > W){ if (o.b > 0){ o.x = Math.max(0, Math.min(W, o.x)); o.vx = -o.vx; o.b--; o.nb++; } else dead = true; }
    if (o.y < 0 || o.y > H){ if (o.b > 0){ o.y = Math.max(0, Math.min(H, o.y)); o.vy = -o.vy; o.b--; o.nb++; } else dead = true; }
    const inside = inBig(o.x, o.y);
    if (!inside) o.out = true;
    else if (o.out && !dead){
      hit(dmg * (1 + o.nb * ricBonus) * Math.pow(stat.keep(), o.d), 'shard', o.x, o.y, o.d);
      if (splitP && o.gen === 0 && Math.random() < splitP){ spawnShards(o.x, o.y, 2, o.d, 1); fx.split(o.x, o.y); }
      if (o.p > 0){ o.p--; o.out = false; const a = Math.atan2(o.vy, o.vx); o.vx = Math.cos(a) * cell * 7; o.vy = Math.sin(a) * cell * 7; }
      else dead = true;
    }
    o.life -= dt; if (o.life <= 0) dead = true;
    if (dead){ shards[s] = shards[shards.length - 1]; shards.pop(); }
  }
  for (let k = booms.length - 1; k >= 0; k--){
    const e = booms[k]; e.t -= dt; if (e.t > 0) continue;
    booms.splice(k, 1);
    if (inBig(e.x, e.y, e.R * .5)) hit(e.dmg, e.src || 'boom', e.x, e.y, e.d || 0, e.burst || 0);
    fx.boom(e);
  }
  for (let k = zaps.length - 1; k >= 0; k--){
    const z = zaps[k]; z.t -= dt; if (z.t > 0) continue;
    zaps.splice(k, 1);
    const pts = [[z.x, z.y]];
    for (let m = 0; m < z.n; m++){ const [px, py] = bigPoint(); pts.push([px, py]); hit(stat.dmg() * 3 * Math.pow(stat.keep(), z.d), 'bolt', px, py, z.d); }
    fx.bolt(pts);
  }
  for (const src in overflow){ const [ox, oy] = bigPoint(); hit(overflow[src], src, ox, oy, 6); }
  overflow = {};
  if (fever > 0) fever = Math.max(0, fever - dt); else heat = Math.max(0, heat - 6 * dt);
  for (const k in buffs) if (buffs[k] > 0) buffs[k] = Math.max(0, buffs[k] - dt);
  combo = Math.max(0, combo - combo * stat.decay() * dt);
  if (combo < 1) milestoneSeen = 0;
  if (shatterPending){ shatterPending = false; if (save.prog >= gaugeNeed()) shatter(); }
  trackDps(dt);
}

/* ---- 実績 ---- */
const ACH = [];
function achSet(key, label, thresholds, names, get, fmtv = fmt){
  thresholds.forEach((t, k) => ACH.push({id:`${key}${k}`, name:names[k], desc:`${label} ${fmtv(t)}`, ok:() => get() >= t}));
}
achSet('d', '累計ヒット', [100, 1000, 1e4, 1e5, 1e6, 1e7], ['はじめの一撃', '壊し屋', '解体業者', '破壊神見習い', '破壊神', '粉砕機'], () => save.st.destroyed);
achSet('c', '累計コイン', [1e4, 1e6, 1e8, 1e12, 1e16, 1e20, 1e24, 1e32, 1e40, 1e48, 1e56, 1e64], ['小銭', '札束', '億り人', '兆の壁', '京', '垓', '秭', '溝', '正', '極', '恒河沙', '無量大数'], () => save.st.earnedAll);
achSet('k', 'コンボ', [25, 50, 100, 250, 500, 1000, 2500, 5000], ['つながった', 'ナイスコンボ', '百連', 'ゾーン', '狂気の沙汰', '神の領域', '宇宙規模', '無量大数コンボ'], () => save.best, n => n.toLocaleString('ja-JP'));
achSet('b', 'ボス撃破', [1, 3, 5, 8, 12, 20, 30, 50], ['初撃破', 'ボスハンター', '常連', '銀河の壁', '宇宙の壁', '輪廻', '殲滅', 'ボスの天敵'], () => save.st.bosses, n => n + '体');
achSet('t', 'タップ', [100, 1000, 5000, 2e4, 1e5], ['指慣らし', '連打', '腱鞘炎', '指が消えた', '指の神'], () => save.st.taps, n => n.toLocaleString('ja-JP') + '回');
achSet('l', '幸運ブロック', [1, 5, 10, 25, 50, 100], ['ラッキー', '幸運体質', '運命の人', '星を掴む', '運を支配', '幸運そのもの'], () => save.st.lucky, n => n + '回');
achSet('f', 'フィーバー', [1, 10, 50, 100, 250], ['熱い', '沸騰', '燃え尽きない', '永久機関', '太陽'], () => save.st.fevers, n => n + '回');
achSet('p', '砕いた回数', [1, 2, 5, 10], ['宇宙、粉砕', '二度目の宇宙', '創造と破壊', '神話'], () => save.runs, n => n + '回');
achSet('u', '強化レベル合計', [10, 100, 300, 1000, 3000], ['初心者', '育成中', '鍛え上げ', '完全体', '極限'], () => UPG.reduce((s, u) => s + L(u.id), 0), n => n);
achSet('h', 'プレイ時間', [600, 3600, 3 * 3600, 10 * 3600, 24 * 3600], ['10分', '1時間', '3時間', '10時間', '丸一日'], () => save.st.time, fmtT);
ACH.push({id:'arms4', name:'兵器工場', desc:'4種類の兵器をすべてそろえる', ok:() => ARMS.every(a => L(a.id + 'N') > 0)});
ACH.push({id:'mall', name:'全モジュール', desc:'7種のモジュールを全部解放', ok:() => MODS.every(m => ML(m.id) > 0)});
ACH.push({id:'slot4', name:'フル装備', desc:'7種のモジュールを全部Lv5以上にする', ok:() => MODS.every(m => ML(m.id) >= 5)});
ACH.push({id:'off1', name:'おかえり', desc:'オフライン収入を受け取る', ok:() => save.st.offline >= 1});
ACH.push({id:'sp10', name:'特殊部隊', desc:'特殊強化を10個買う', ok:() => Object.keys(save.sp).length >= 10});
ACH.push({id:'spall', name:'全部入り', desc:'特殊強化を全部買う', ok:() => SPECIALS.every(s => SP(s.id))});
ACH.push({id:'dust100', name:'星屑の山', desc:'星屑を累計100集める', ok:() => save.st.bestDust >= 100});
achSet('r', '遺物の種類', [1, 5, 10, 15, RELICS.length], ['掘り出し物', '収集家', '博物館', '考古学者', '完全図鑑'], () => relicKinds(), n => n + '種');
ACH.push({id:'rleg', name:'伝説', desc:'レジェンドの遺物を手に入れる', ok:() => RELICS.some(r => r.rar === 3 && RL(r.id) > 0)});
ACH.push({id:'rmax', name:'極めし者', desc:'遺物をどれか1つ最大Lvにする', ok:() => RELICS.some(r => RL(r.id) >= r.max)});
achSet('z', '到達', [UNIVERSE + 1, UNIVERSE + 5, UNIVERSE + 10, UNIVERSE + 20, STAGES.length - 1], ['宇宙の先へ', '終焉を見た', '深淵', '深淵の底', '果て'], () => save.st.deepest, n => STAGES[n].name);
ACH.push({id:'evo1', name:'進化', desc:'兵器をどれか1つ進化させる', ok:() => Object.keys(EVO).some(id => evo(id) > 0)});
ACH.push({id:'evo5', name:'全軍進化', desc:'ドローンと4つの兵器を全部進化させる', ok:() => Object.keys(EVO).every(id => evo(id) > 0)});
ACH.push({id:'evo10', name:'最終形態', desc:'ドローンと4つの兵器を全部2段階進化させる', ok:() => Object.keys(EVO).every(id => evo(id) > 1)});
function checkAch(){
  for (const a of ACH) if (!save.ach[a.id] && a.ok()){ save.ach[a.id] = 1; fx.ach(a); }
}

/* ---- 砕く（転生） ---- */
function prestige(){
  const d = dustGain();
  save.dust += d; save.st.bestDust += d; save.runs++;
  const keepMods = P('pkeep') ? save.mods : {};
  Object.assign(save, {coins:0, stage:Math.min(P('pstage'), STAGES.length - 1), lv:{}, mods:keepMods, ended:false, endSeen:false, prog:0, kills:0, boss:null, sp:{}, idleRate:0});
  save.st.earnedRun = 0;
  for (const k in buffs) buffs[k] = 0;
  combo = 0; fever = 0; heat = 0; boss = null; lucky = null; luckyT = 30;
  shells = []; beams = []; missiles = []; holes = [];
  return d;
}

// 調整用：環境変数 TUNE='{"gaugeLate":1.5}' で数値を差し替えられる
Object.assign(TUNE, JSON.parse(process.env.TUNE || '{}'));
module.exports = { get save(){ return save; }, setSave, DEFAULT, L, ML, M, SP, P, UPG, MODS, SPECIALS, PERM, STAGES, PRESTIGE_STAGE, upCost, modCost, spCost, permCost, stat, layout, buildGrid, step, tap, fmt, get BX(){ return BX; }, get BY(){ return BY; }, get BS(){ return BS; },
  checkAch, prestige, dustGain, ACH, gaugeNeed, comboMult, rewardMult, permMult, blockHp, get blocks(){ return blocks; }, get boss(){ return boss; }, get lucky(){ return lucky; }, get combo(){ return combo; }, get fever(){ return fever; }, setState(s){ state = s; }, fx };
