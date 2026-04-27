// ========== Bot AI Players ==========
const BOT_BASE_NAMES = [
  '新手剑圣', '独行刀客', '流浪法神', '暗夜影刺', '战场狂战',
];

let botPlayers = [];

function generateBots() {
  botPlayers = [
    createBot(5, 0),
    createBot(10, 1),
    createBot(15, 2),
    createBot(20, 3),
    createBot(25, 4),
  ];
  return botPlayers;
}

function createBot(level, nameIdx) {
  const baseName = BOT_BASE_NAMES[nameIdx] || '流浪武者';

  const baseHp = 80 + (level - 1) * 10;
  const baseAtk = 6 + (level - 1) * 2;
  const baseDef = 3 + (level - 1) * 2;

  const zoneLevel = Math.min(4, Math.floor(level / 5));

  function makeItem(type) {
    let item;
    do { item = generateEquipment(level, zoneLevel, type); }
    while (item.rarity === '红装');
    return item;
  }

  const weapon = makeItem('weapon');
  const armor = makeItem('armor');
  const accessory = makeItem('accessory');

  const totalAtk = baseAtk + (weapon.atk || 0) + (armor.atk || 0) + (accessory.atk || 0);
  const totalDef = baseDef + (weapon.def || 0) + (armor.def || 0) + (accessory.def || 0);
  const hpBonus = (weapon.hp || 0) + (armor.hp || 0) + (accessory.hp || 0);
  const totalHp = baseHp + hpBonus;

  const inventory = [];
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    let item;
    do { item = generateEquipment(level, zoneLevel); }
    while (item.rarity === '红装');
    inventory.push(item);
  }

  const gold = level * 80 + Math.floor(Math.random() * level * 20);

  return {
    name: baseName,
    fullName: `${baseName}·${level}級`,
    level,
    hp: totalHp,
    maxHp: totalHp,
    atk: totalAtk,
    def: totalDef,
    gold,
    weapon,
    armor,
    accessory,
    inventory,
    isBot: true,
    alive: true,
  };
}

function getAliveBots() {
  return botPlayers.filter(bot => bot.alive);
}

function areAllBotsDead() {
  return botPlayers.length > 0 && botPlayers.every(bot => !bot.alive);
}
