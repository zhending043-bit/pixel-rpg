const RARITIES = [
  { name: '普通', multiplier: 1.0, color: '#aaaaaa' },
  { name: '优秀', multiplier: 1.5, color: '#4caf50' },
  { name: '稀有', multiplier: 2.0, color: '#2196f3' },
  { name: '史诗', multiplier: 3.0, color: '#9c27b0' },
  { name: '传说', multiplier: 5.0, color: '#ff9800' },
  { name: '红装', multiplier: 8.0, color: '#ff1744' },
];

// Zone rarity weights: [普通, 优秀, 稀有, 史诗, 传说]
// Each zone's signature rarity is most likely, lower zones also drop
const ZONE_RARITY_WEIGHTS = [
  [100,  0,   0,   0,   0],  // 新手草原 → 普通
  [ 30, 70,   0,   0,   0],  // 幽暗森林 → 优秀 + 普通
  [ 10, 25,  65,   0,   0],  // 灼热沙漠 → 稀有 + 优秀 + 普通
  [  5, 10,  25,  60,   0],  // 亡灵城堡 → 史诗 + 稀有 + 优秀 + 普通
  [  2,  5,  10,  33,  50],  // 深渊     → 传说 + 史诗 + 稀有 + 优秀 + 普通
];

const EQUIP_TYPES = ['weapon', 'armor', 'accessory', 'helmet', 'boots'];
const TYPE_NAMES = { weapon: '武器', armor: '防具', accessory: '饰品', helmet: '头盔', boots: '靴子' };

const WEAPON_NAMES = ['短剑', '铁剑', '钢刀', '战斧', '长矛', '巨剑', '龙骨剑', '魔杖', '双刃刀', '流星锤'];
const ARMOR_NAMES = ['布甲', '皮甲', '铁甲', '钢铠', '锁子甲', '龙鳞甲', '板甲', '暗影衣', '法袍', '战铠'];
const ACCESSORY_NAMES = ['戒指', '项链', '手镯', '耳环', '徽章', '护符', '宝石', '腰带', '披风', '王冠'];
const HELMET_NAMES = ['头巾', '铁盔', '钢盔', '兜鍪', '王冠', '龙角盔', '法冠', '面罩', '战盔', '暗影兜帽'];
const BOOTS_NAMES = ['布靴', '皮靴', '铁靴', '钢靴', '龙鳞靴', '速行靴', '战靴', '法靴', '暗影靴', '踏风靴'];

const PREFIXES = [
  ['破旧', '普通', '简陋'],     // 普通
  ['精良', '锋利', '坚固'],     // 优秀
  ['闪光', '附魔', '秘制'],     // 稀有
  ['远古', '不朽', '混沌'],     // 史诗
  ['传说', '神罚', '龙魂'],     // 传说
  ['龙神', '灭世', '至高'],     // 红装
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRarityForZone(zoneLevel) {
  const weights = ZONE_RARITY_WEIGHTS[zoneLevel] || ZONE_RARITY_WEIGHTS[0];
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return RARITIES[i];
  }
  return RARITIES[0];
}

const TYPE_CONFIG = {
  weapon:   { names: WEAPON_NAMES,    main: 'atk', sub: () => Math.random() < 0.3 ? 'def' : null },
  armor:    { names: ARMOR_NAMES,     main: 'def', sub: () => Math.random() < 0.3 ? 'hp' : null },
  accessory:{ names: ACCESSORY_NAMES, main: () => Math.random() < 0.5 ? 'atk' : 'def', sub: () => 'hp' },
  helmet:   { names: HELMET_NAMES,    main: 'def', sub: () => Math.random() < 0.4 ? 'hp' : null },
  boots:    { names: BOOTS_NAMES,     main: 'def', sub: () => Math.random() < 0.3 ? 'atk' : null },
};

function buildEquipmentItem(type, monsterLevel, rarity, namePool, prefix) {
  const cfg = TYPE_CONFIG[type];
  const mainStat = typeof cfg.main === 'function' ? cfg.main() : cfg.main;
  const subStat = cfg.sub();

  const name = `${prefix}${pickRandom(namePool || cfg.names)}`;
  const mainValue = Math.floor((10 + monsterLevel * 4) * rarity.multiplier);
  const hpValue = Math.floor((8 + monsterLevel * 2) * rarity.multiplier);

  const item = { name, type, rarity: rarity.name, color: rarity.color, level: monsterLevel, atk: 0, def: 0, hp: hpValue };
  item[mainStat] = mainValue;
  if (subStat) {
    item[subStat] = Math.floor((4 + monsterLevel * 2) * rarity.multiplier);
  }

  // Legendary and Red fill all missing stats
  if (rarity.name === '传说' || rarity.name === '红装') {
    if (!item.atk) item.atk = Math.floor((10 + monsterLevel * 3) * rarity.multiplier);
    if (!item.def) item.def = Math.floor((10 + monsterLevel * 3) * rarity.multiplier);
  }

  return item;
}

function generateEquipment(monsterLevel, zoneLevel = 0, forceType = null) {
  const type = forceType || pickRandom(EQUIP_TYPES);
  const rarity = pickRarityForZone(zoneLevel);
  const rarityIdx = RARITIES.indexOf(rarity);
  const prefix = pickRandom(PREFIXES[rarityIdx] || PREFIXES[0]);
  return buildEquipmentItem(type, monsterLevel, rarity, null, prefix);
}

function getEquipmentStatsText(item) {
  const parts = [];
  if (item.atk > 0) parts.push(`⚔ +${item.atk} ATK`);
  if (item.def > 0) parts.push(`🛡 +${item.def} DEF`);
  if (item.hp > 0) parts.push(`❤ +${item.hp} HP`);
  return parts.join(' ');
}

const RED_NAME_POOLS = {
  weapon:     ['圣剑', '魔剑', '龙牙', '裂天', '断罪'],
  armor:      ['神甲', '龙铠', '不灭', '天盾', '原初'],
  accessory:  ['神戒', '龙玉', '永恒', '创世', '轮回'],
  helmet:     ['龙冠', '神冕', '天盔', '不朽面罩', '至高王冠'],
  boots:      ['龙鳞靴', '神行靴', '天踏', '不灭战靴', '至高之靴'],
};

/** Create a piece of red equipment for the shop */
function createRedEquipment(monsterLevel, type) {
  const rarity = RARITIES[5];
  const prefix = pickRandom(PREFIXES[5]);
  return buildEquipmentItem(type, monsterLevel, rarity, RED_NAME_POOLS[type], prefix);
}

// ========== Stat Training Costs ==========
const TRAINING_BASE = { atk: 800, def: 600, hp: 400 };
const TRAINING_INC = { atk: 400, def: 300, hp: 200 };

function getTrainingCost(stat, count) {
  const base = TRAINING_BASE[stat] || 600;
  const inc = TRAINING_INC[stat] || 200;
  return base + count * inc;
}

function getTrainingLabel(stat) {
  const labels = { atk: '攻击训练', def: '防御训练', hp: '体能训练' };
  return labels[stat] || stat;
}

function getTrainingEffect(stat) {
  const effects = { atk: '⚔ ATK +1', def: '🛡 DEF +1', hp: '❤ HP +5' };
  return effects[stat] || '';
}

/** Get gold price for an equipment item */
function getEquipmentPrice(item) {
  if (item.rarity === '红装') {
    const prices = { weapon: 20000, armor: 15000, accessory: 12000, helmet: 15000, boots: 12000 };
    return prices[item.type] || 15000;
  }
  // Other rarities not sold
  return 0;
}
