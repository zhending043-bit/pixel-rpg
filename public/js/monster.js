const ZONES = [
  {
    id: 1,
    name: '🌿 新手草原',
    minLevel: 1,
    monsters: [
      // 0件本图装备 → 勉强打过史莱姆, 1件 → 野猪, 2件 → 野狼, 3件 → 妖精, 4件 → 哥布林
      { name: '史莱姆', level: 1, hp: 40, atk: 11, def: 2, dropSlot: 'weapon', sprite: 'slime', expReward: 15, goldReward: 8 },
      { name: '野猪', level: 1, hp: 120, atk: 22, def: 12, dropSlot: 'armor', sprite: 'boar', expReward: 22, goldReward: 12 },
      { name: '野狼', level: 2, hp: 140, atk: 26, def: 16, dropSlot: 'helmet', sprite: 'wolf', expReward: 30, goldReward: 15 },
      { name: '妖精', level: 2, hp: 160, atk: 28, def: 20, dropSlot: 'accessory', sprite: 'fairy', expReward: 35, goldReward: 17 },
      { name: '哥布林', level: 3, hp: 170, atk: 32, def: 24, dropSlot: 'boots', sprite: 'goblin', expReward: 45, goldReward: 22 },
    ],
  },
  {
    id: 2,
    name: '🌲 幽暗森林',
    minLevel: 4,
    monsters: [
      // 进入此图时玩家已有一套新手草原装备
      // 0件本图装备 → 巨蜘蛛, 1件 → 毒蘑菇, 2件 → 骷髅兵, 3件 → 暗精灵, 4件 → 树精
      { name: '巨蜘蛛', level: 4, hp: 220, atk: 44, def: 20, dropSlot: 'weapon', sprite: 'giant-spider', expReward: 65, goldReward: 35 },
      { name: '毒蘑菇', level: 4, hp: 330, atk: 54, def: 36, dropSlot: 'armor', sprite: 'mushroom', expReward: 80, goldReward: 40 },
      { name: '骷髅兵', level: 5, hp: 340, atk: 68, def: 36, dropSlot: 'helmet', sprite: 'skeleton', expReward: 100, goldReward: 50 },
      { name: '暗精灵', level: 5, hp: 340, atk: 70, def: 40, dropSlot: 'accessory', sprite: 'dark-elf', expReward: 120, goldReward: 55 },
      { name: '树精', level: 6, hp: 400, atk: 82, def: 44, dropSlot: 'boots', sprite: 'treant', expReward: 140, goldReward: 65 },
    ],
  },
  {
    id: 3,
    name: '🏜 灼热沙漠',
    minLevel: 8,
    monsters: [
      // 进入此图时玩家已有一套幽暗森林装备
      // 0件本图装备 → 沙漠之鹰, 1件 → 石巨人, 2件 → 蝎子王, 3件 → 沙虫, 4件 → 火元素
      { name: '沙漠之鹰', level: 8, hp: 350, atk: 145, def: 20, dropSlot: 'weapon', sprite: 'desert-eagle', expReward: 160, goldReward: 80 },
      { name: '石巨人', level: 9, hp: 490, atk: 155, def: 20, dropSlot: 'armor', sprite: 'stone-golem', expReward: 220, goldReward: 110 },
      { name: '蝎子王', level: 10, hp: 600, atk: 160, def: 25, dropSlot: 'helmet', sprite: 'scorpion-king', expReward: 270, goldReward: 130 },
      { name: '沙虫', level: 11, hp: 600, atk: 210, def: 30, dropSlot: 'accessory', sprite: 'sand-worm', expReward: 300, goldReward: 150 },
      { name: '火元素', level: 12, hp: 530, atk: 380, def: 35, dropSlot: 'boots', sprite: 'elemental', expReward: 350, goldReward: 180 },
    ],
  },
  {
    id: 4,
    name: '🏰 亡灵城堡',
    minLevel: 14,
    monsters: [
      // 进入此图时玩家已有一套灼热沙漠装备
      // 0件本图装备 → 亡灵骑士, 1件 → 幽灵, 2件 → 巫妖, 3件 → 吸血鬼, 4件 → 骨龙
      { name: '亡灵骑士', level: 14, hp: 680, atk: 390, def: 30, dropSlot: 'weapon', sprite: 'death-knight', expReward: 400, goldReward: 210 },
      { name: '幽灵', level: 15, hp: 1020, atk: 440, def: 35, dropSlot: 'armor', sprite: 'ghost', expReward: 460, goldReward: 240 },
      { name: '巫妖', level: 16, hp: 780, atk: 840, def: 40, dropSlot: 'helmet', sprite: 'lich', expReward: 530, goldReward: 280 },
      { name: '吸血鬼', level: 17, hp: 550, atk: 1680, def: 45, dropSlot: 'accessory', sprite: 'vampire', expReward: 600, goldReward: 310 },
      { name: '骨龙', level: 18, hp: 750, atk: 1850, def: 50, dropSlot: 'boots', sprite: 'dragon-skeleton', expReward: 700, goldReward: 360 },
    ],
  },
  {
    id: 5,
    name: '🔥 深渊',
    minLevel: 20,
    monsters: [
      // 进入此图时玩家已有一套亡灵城堡装备
      // 0件本图装备 → 地狱犬, 1件 → 暗影法师, 2件 → 深渊领主, 3件 → 恶魔, 4件 → 暗龙
      { name: '地狱犬', level: 20, hp: 950, atk: 1900, def: 50, dropSlot: 'weapon', sprite: 'hellhound', expReward: 700, goldReward: 350 },
      { name: '暗影法师', level: 21, hp: 2800, atk: 1100, def: 60, dropSlot: 'armor', sprite: 'shadow-mage', expReward: 800, goldReward: 400 },
      { name: '深渊领主', level: 22, hp: 2500, atk: 1640, def: 70, dropSlot: 'helmet', sprite: 'abyss-lord', expReward: 950, goldReward: 480 },
      { name: '恶魔', level: 23, hp: 1450, atk: 4600, def: 80, dropSlot: 'accessory', sprite: 'demon', expReward: 1050, goldReward: 520 },
      { name: '暗龙', level: 25, hp: 2200, atk: 3830, def: 90, dropSlot: 'boots', sprite: 'dark-dragon', expReward: 1300, goldReward: 650 },
    ],
  },
  {
    id: 6,
    name: '👑 魔王之巅',
    minLevel: 30,
    monsters: [
      { name: '魔王', level: 30, hp: 11000, atk: 6500, def: 750, dropSlot: null, sprite: 'dark-dragon', expReward: 8000, goldReward: 5000 },
    ],
  },
];
