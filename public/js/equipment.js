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

const PREFIXES = {
  common: ['破旧', '普通', '简陋'],
  uncommon: ['精良', '锋利', '坚固'],
  rare: ['闪光', '附魔', '秘制'],
  epic: ['远古', '不朽', '混沌'],
  legendary: ['传说', '神罚', '龙魂'],
  red: ['龙神', '灭世', '至高'],
};

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

function generateEquipment(monsterLevel, zoneLevel = 0, forceType = null) {
  const type = forceType || pickRandom(EQUIP_TYPES);
  const rarity = pickRarityForZone(zoneLevel);
  const rarityIdx = RARITIES.indexOf(rarity);
  const prefixList = Object.values(PREFIXES)[rarityIdx] || PREFIXES.common;
  const prefix = pickRandom(prefixList);

  let namePool, mainStat, subStat;
  switch (type) {
    case 'weapon':
      namePool = WEAPON_NAMES;
      mainStat = 'atk';
      subStat = Math.random() < 0.3 ? 'def' : null;
      break;
    case 'armor':
      namePool = ARMOR_NAMES;
      mainStat = 'def';
      subStat = Math.random() < 0.3 ? 'hp' : null;
      break;
    case 'accessory':
      namePool = ACCESSORY_NAMES;
      mainStat = Math.random() < 0.5 ? 'atk' : 'def';
      subStat = 'hp';
      break;
    case 'helmet':
      namePool = HELMET_NAMES;
      mainStat = 'def';
      subStat = Math.random() < 0.4 ? 'hp' : null;
      break;
    case 'boots':
      namePool = BOOTS_NAMES;
      mainStat = 'def';
      subStat = Math.random() < 0.3 ? 'atk' : null;
      break;
  }

  const baseName = pickRandom(namePool);
  const name = `${prefix}${baseName}`;

  const mainValue = Math.floor((10 + monsterLevel * 4) * rarity.multiplier);
  const hpValue = Math.floor((8 + monsterLevel * 2) * rarity.multiplier);
  const item = {
    name,
    type,
    rarity: rarity.name,
    color: rarity.color,
    level: monsterLevel,
    atk: 0,
    def: 0,
    hp: hpValue,
  };

  item[mainStat] = mainValue;
  if (subStat) {
    const subValue = Math.floor((4 + monsterLevel * 2) * rarity.multiplier);
    item[subStat] = subValue;
  }

  // Legendary gets all stats
  if (rarity.name === '传说') {
    if (!item.atk) item.atk = Math.floor((10 + monsterLevel * 3) * rarity.multiplier);
    if (!item.def) item.def = Math.floor((10 + monsterLevel * 3) * rarity.multiplier);
  }

  return item;
}

function getEquipmentStatsText(item) {
  const parts = [];
  if (item.atk > 0) parts.push(`⚔ +${item.atk} ATK`);
  if (item.def > 0) parts.push(`🛡 +${item.def} DEF`);
  if (item.hp > 0) parts.push(`❤ +${item.hp} HP`);
  return parts.join(' ');
}

/** Create a piece of red equipment for the shop */
function createRedEquipment(monsterLevel, type) {
  const rarity = RARITIES[5]; // 红装
  const prefix = pickRandom(PREFIXES.red);

  let namePool, mainStat, subStat;
  switch (type) {
    case 'weapon':
      namePool = ['圣剑', '魔剑', '龙牙', '裂天', '断罪'];
      mainStat = 'atk';
      subStat = 'def';
      break;
    case 'armor':
      namePool = ['神甲', '龙铠', '不灭', '天盾', '原初'];
      mainStat = 'def';
      subStat = 'hp';
      break;
    case 'accessory':
      namePool = ['神戒', '龙玉', '永恒', '创世', '轮回'];
      mainStat = 'atk';
      subStat = 'hp';
      break;
    case 'helmet':
      namePool = ['龙冠', '神冕', '天盔', '不朽面罩', '至高王冠'];
      mainStat = 'def';
      subStat = 'hp';
      break;
    case 'boots':
      namePool = ['龙鳞靴', '神行靴', '天踏', '不灭战靴', '至高之靴'];
      mainStat = 'def';
      subStat = 'atk';
      break;
  }

  const baseName = pickRandom(namePool);
  const name = `${prefix}${baseName}`;

  const mainValue = Math.floor((10 + monsterLevel * 4) * rarity.multiplier);
  const hpValue = Math.floor((8 + monsterLevel * 2) * rarity.multiplier);

  const item = {
    name,
    type,
    rarity: rarity.name,
    color: rarity.color,
    level: monsterLevel,
    atk: 0,
    def: 0,
    hp: hpValue,
  };

  item[mainStat] = mainValue;
  if (subStat) {
    const subValue = Math.floor((4 + monsterLevel * 2) * rarity.multiplier);
    item[subStat] = subValue;
  }

  // Red gets all stats
  item.atk = item.atk || Math.floor((10 + monsterLevel * 3) * rarity.multiplier);
  item.def = item.def || Math.floor((10 + monsterLevel * 3) * rarity.multiplier);

  return item;
}

/** Get gold price for an equipment item */
function getEquipmentPrice(item) {
  if (item.rarity === '红装') {
    const prices = { weapon: 9000, armor: 6000, accessory: 4500, helmet: 6000, boots: 4500 };
    return prices[item.type] || 6000;
  }
  // Other rarities not sold
  return 0;
}
