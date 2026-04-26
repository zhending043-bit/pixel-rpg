const ZONES = [
  {
    id: 1,
    name: '🌿 新手草原',
    minLevel: 1,
    monsters: [
      { name: '史莱姆', level: 1, hp: 40, atk: 9, def: 3, dropSlot: 'weapon', sprite: 'slime', expReward: 15, goldReward: 8 },
      { name: '野狼', level: 2, hp: 80, atk: 16, def: 7, dropSlot: 'armor', sprite: 'wolf', expReward: 25, goldReward: 12 },
      { name: '哥布林', level: 3, hp: 100, atk: 18, def: 10, dropSlot: 'accessory', sprite: 'goblin', expReward: 40, goldReward: 18 },
    ],
  },
  {
    id: 2,
    name: '🌲 幽暗森林',
    minLevel: 4,
    monsters: [
      { name: '巨蜘蛛', level: 4, hp: 90, atk: 20, def: 8, dropSlot: 'weapon', sprite: 'giant-spider', expReward: 60, goldReward: 30 },
      { name: '骷髅兵', level: 5, hp: 150, atk: 30, def: 14, dropSlot: 'armor', sprite: 'skeleton', expReward: 90, goldReward: 45 },
      { name: '树精', level: 6, hp: 200, atk: 38, def: 18, dropSlot: 'accessory', sprite: 'treant', expReward: 130, goldReward: 60 },
    ],
  },
  {
    id: 3,
    name: '🏜 灼热沙漠',
    minLevel: 8,
    monsters: [
      { name: '沙虫', level: 8, hp: 180, atk: 35, def: 14, dropSlot: 'weapon', sprite: 'sand-worm', expReward: 160, goldReward: 80 },
      { name: '蝎子王', level: 10, hp: 280, atk: 50, def: 24, dropSlot: 'armor', sprite: 'scorpion-king', expReward: 240, goldReward: 120 },
      { name: '火元素', level: 12, hp: 360, atk: 65, def: 32, dropSlot: 'accessory', sprite: 'elemental', expReward: 320, goldReward: 160 },
    ],
  },
  {
    id: 4,
    name: '🏰 亡灵城堡',
    minLevel: 14,
    monsters: [
      { name: '亡灵骑士', level: 14, hp: 320, atk: 55, def: 24, dropSlot: 'weapon', sprite: 'death-knight', expReward: 380, goldReward: 200 },
      { name: '巫妖', level: 16, hp: 480, atk: 75, def: 38, dropSlot: 'armor', sprite: 'lich', expReward: 500, goldReward: 260 },
      { name: '骨龙', level: 18, hp: 600, atk: 95, def: 48, dropSlot: 'accessory', sprite: 'dragon-skeleton', expReward: 650, goldReward: 330 },
    ],
  },
  {
    id: 5,
    name: '🔥 深渊',
    minLevel: 20,
    monsters: [
      { name: '恶魔', level: 20, hp: 500, atk: 75, def: 35, dropSlot: 'weapon', sprite: 'demon', expReward: 700, goldReward: 350 },
      { name: '深渊领主', level: 22, hp: 700, atk: 105, def: 55, dropSlot: 'armor', sprite: 'abyss-lord', expReward: 900, goldReward: 450 },
      { name: '暗龙', level: 25, hp: 900, atk: 130, def: 70, dropSlot: 'accessory', sprite: 'dark-dragon', expReward: 1200, goldReward: 600 },
    ],
  },
  {
    id: 6,
    name: '👑 魔王之巅',
    minLevel: 30,
    monsters: [
      { name: '魔王', level: 30, hp: 5000, atk: 600, def: 400, dropSlot: null, sprite: 'dark-dragon', expReward: 5000, goldReward: 3000 },
    ],
  },
];
