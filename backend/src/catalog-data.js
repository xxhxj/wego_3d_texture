export const CATEGORIES = [
  { id: 'box', name: '盒子' },
  { id: 'bottle', name: '瓶子' },
  { id: 'food', name: '食品包装' },
  { id: 'bag', name: '袋子' },
];

export const MODELS = [
  { id: 'tall', category: 'box', name: '立式盒', w: 120, d: 60, h: 160, fold: 1, tint: '#f7f4ee' },
  { id: 'cube', category: 'box', name: '正方盒', w: 140, d: 140, h: 140, fold: 1, tint: '#ffffff' },
  { id: 'kraft', category: 'box', name: '牛皮方盒', w: 130, d: 130, h: 130, fold: 1, tint: '#c6a36a', paper: 'kraft' },
  { id: 'grey', category: 'box', name: '灰板盒', w: 150, d: 110, h: 90, fold: 1, tint: '#d7d7d7', paper: 'grey' },
  { id: 'flat', category: 'box', name: '扁平盒', w: 240, d: 180, h: 48, fold: 1, tint: '#f4ecdc' },
  { id: 'lid', category: 'box', name: '翻盖盒', w: 180, d: 140, h: 70, fold: 0.62, tint: '#efe8ff' },
  { id: 'mailer', category: 'box', name: '邮寄盒', w: 260, d: 180, h: 40, fold: 0.42, tint: '#f6efe4' },
  { id: 'tube', category: 'box', name: '长条盒', w: 70, d: 45, h: 240, fold: 1, tint: '#f6f1e7' },

  { id: 'bottle', category: 'bottle', kind: 'bottle', name: '圆瓶', w: 70, d: 70, h: 220, fold: 1, tint: '#e7f2f6', profile: 'standard' },
  { id: 'slim', category: 'bottle', kind: 'bottle', name: '细颈瓶', w: 52, d: 52, h: 280, fold: 1, tint: '#d9ebf2', profile: 'slim' },
  { id: 'jar', category: 'bottle', kind: 'bottle', name: '广口瓶', w: 96, d: 96, h: 150, fold: 0.72, tint: '#f3f7f4', profile: 'jar' },
  { id: 'vial', category: 'bottle', kind: 'bottle', name: '小药瓶', w: 42, d: 42, h: 110, fold: 1, tint: '#eef6f8', profile: 'slim' },

  { id: 'can', category: 'food', kind: 'can', name: '易拉罐', w: 66, d: 66, h: 123, fold: 1, tint: '#e6e8ee' },
  { id: 'cup', category: 'food', kind: 'cup', name: '纸杯', w: 90, d: 80, h: 120, fold: 1, tint: '#fff7ef' },
  { id: 'lunch', category: 'food', kind: 'box', name: '餐盒', w: 190, d: 140, h: 55, fold: 0.58, tint: '#fff4e8' },
  { id: 'pizza', category: 'food', kind: 'box', name: '披萨盒', w: 240, d: 240, h: 36, fold: 0.5, tint: '#f8efe4', paper: 'kraft' },

  { id: 'shopper', category: 'bag', kind: 'pouch', name: '手提袋', w: 180, d: 80, h: 220, fold: 0.82, tint: '#f4ecdc', paper: 'kraft', handle: true },
  { id: 'paper-bag', category: 'bag', kind: 'pouch', name: '纸袋', w: 140, d: 70, h: 200, fold: 1, tint: '#f7f1e6', paper: 'kraft' },
  { id: 'stand', category: 'bag', kind: 'pouch', name: '自立袋', w: 120, d: 60, h: 180, fold: 0.7, tint: '#efe8ff' },
  { id: 'mailer-bag', category: 'bag', kind: 'pouch', name: '快递袋', w: 260, d: 28, h: 340, fold: 1, tint: '#f3f3f5', paper: 'grey' },
];
