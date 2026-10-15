export const CATEGORIES = [
  { id: 'box', name: '盒子' },
  { id: 'bottle', name: '瓶子' },
  { id: 'food', name: '食品包装' },
  { id: 'bag', name: '袋子 & 小袋' },
  { id: 'more', name: '其他' },
];

function item(partial) {
  return {
    kind: 'box',
    fold: 1,
    tint: '#f7f4ee',
    member: false,
    ...partial,
  };
}

const square = [
  ['cube', '正方盒', { w: 140, d: 140, h: 140, tint: '#ffffff' }],
  ['kraft', '牛皮方盒', { w: 130, d: 130, h: 130, tint: '#c6a36a', paper: 'kraft' }],
  ['grey', '灰板方盒', { w: 150, d: 110, h: 90, tint: '#d7d7d7', paper: 'grey' }],
  ['square-open', '翻盖方盒', { w: 160, d: 160, h: 70, fold: 0.55, tint: '#f4ecdc' }],
  ['square-mail', '扁平方盒', { w: 200, d: 200, h: 48, fold: 0.42, tint: '#fff' }],
  ['square-purple', '紫色方盒', { w: 150, d: 150, h: 60, tint: '#efe8ff', member: true }],
  ['square-pink', '粉色方盒', { w: 170, d: 170, h: 55, fold: 0.62, tint: '#f8d7e3', member: true }],
  ['square-magnet', '磁吸方盒', { w: 160, d: 160, h: 48, fold: 0.7, tint: '#fff', member: true }],
  ['square-window', '开窗方盒', { w: 140, d: 140, h: 80, tint: '#f7f4ee' }],
  ['square-tray', '托盘方盒', { w: 180, d: 180, h: 36, fold: 0.4, tint: '#f6efe4', paper: 'kraft' }],
  ['square-sleeve', '套筒方盒', { w: 150, d: 150, h: 40, tint: '#fff' }],
  ['square-kraft-open', '牛皮开口盒', { w: 160, d: 120, h: 90, fold: 0.5, tint: '#d7b07a', paper: 'kraft' }],
];

const singles = [
  ['lid', 'box', '礼盒', '翻盖礼盒', { w: 180, d: 140, h: 70, fold: 0.62, tint: '#efe8ff' }],
  ['mailer', 'box', '邮寄盒', '邮寄盒', { w: 260, d: 180, h: 40, fold: 0.42, tint: '#f6efe4' }],
  ['crate', 'box', '运输箱', '运输箱', { w: 300, d: 220, h: 180, tint: '#c6a36a', paper: 'kraft', member: true }],
  ['tall', 'box', '产品盒', '立式盒', { w: 120, d: 60, h: 160 }],
  ['lunch', 'box', '食品盒', '食品盒', { w: 190, d: 140, h: 55, fold: 0.58, tint: '#fff4e8' }],
  ['display', 'box', '展示盒', '展示盒', { w: 200, d: 80, h: 220, fold: 0.72, tint: '#fff', member: true }],
  ['flat', 'box', '折叠盒', '扁平盒', { w: 240, d: 180, h: 48, tint: '#f4ecdc' }],
  ['sleeve', 'box', '套筒与托盘盒', '套筒托盘', { w: 220, d: 160, h: 40, fold: 0.48, tint: '#f7f4ee', member: true }],
  ['window-box', 'box', '带窗的盒子', '开窗盒', { w: 160, d: 80, h: 200, tint: '#fff' }],
  ['handle-box', 'box', '带手柄的盒子', '手提盒', { w: 200, d: 100, h: 120, tint: '#f4ecdc', member: true }],
  ['lidbox', 'box', '带盖盒', '天地盖', { w: 180, d: 140, h: 80, fold: 0.8, tint: '#fff' }],
  ['hang', 'box', '挂盒', '挂盒', { w: 90, d: 30, h: 160, tint: '#f7f4ee', member: true }],
  ['tuck', 'box', '插口盒', '插口盒', { w: 140, d: 50, h: 180, fold: 0.86 }],
  ['poly', 'box', '多边形盒', '六角盒', { w: 120, d: 104, h: 80, tint: '#efe8ff', member: true }],
  ['plastic', 'box', '塑料盒', '塑料盒', { w: 160, d: 110, h: 60, tint: '#e7f2f6', member: true }],
  ['misc', 'box', '其他', '通用包装', { w: 160, d: 80, h: 120 }],

  ['bottle', 'bottle', '水瓶', '圆瓶', { kind: 'bottle', profile: 'standard', w: 70, d: 70, h: 220, tint: '#e7f2f6' }],
  ['slim', 'bottle', '饮料瓶', '细颈瓶', { kind: 'bottle', profile: 'slim', w: 52, d: 52, h: 280, tint: '#d9ebf2', member: true }],
  ['wine', 'bottle', '酒瓶', '酒瓶', { kind: 'bottle', profile: 'slim', w: 74, d: 74, h: 300, tint: '#173024', member: true }],
  ['beer', 'bottle', '啤酒瓶', '啤酒瓶', { kind: 'bottle', profile: 'standard', w: 64, d: 64, h: 230, tint: '#c6a36a', member: true }],
  ['vial', 'bottle', '香水瓶', '香水瓶', { kind: 'bottle', profile: 'slim', w: 42, d: 42, h: 110, tint: '#f4ecdc' }],
  ['shampoo', 'bottle', '洗发水瓶', '洗发水瓶', { kind: 'bottle', profile: 'standard', w: 70, d: 46, h: 200, tint: '#efe8ff', member: true }],
  ['cosmetic', 'bottle', '化妆品瓶', '化妆品瓶', { kind: 'bottle', profile: 'jar', w: 48, d: 48, h: 120, tint: '#f8d7e3', member: true }],
  ['oil', 'bottle', '油瓶', '油瓶', { kind: 'bottle', profile: 'standard', w: 80, d: 80, h: 240, tint: '#f4ecdc' }],
  ['jar', 'bottle', '保健品瓶', '广口瓶', { kind: 'bottle', profile: 'jar', w: 96, d: 96, h: 150, fold: 0.72, tint: '#f3f7f4', member: true }],
  ['sauce', 'bottle', '酱汁瓶', '酱汁瓶', { kind: 'bottle', profile: 'jar', w: 70, d: 70, h: 160, tint: '#c6a36a' }],
  ['spray', 'bottle', '喷雾瓶', '喷雾瓶', { kind: 'bottle', profile: 'slim', w: 46, d: 46, h: 180, tint: '#e7f2f6', member: true }],
  ['dropper', 'bottle', '滴管瓶', '滴管瓶', { kind: 'bottle', profile: 'slim', w: 36, d: 36, h: 100, tint: '#efe8ff', member: true }],
  ['pump', 'bottle', '泵瓶', '泵瓶', { kind: 'bottle', profile: 'standard', w: 68, d: 68, h: 190, tint: '#fff', member: true }],
  ['glass', 'bottle', '玻璃瓶', '玻璃瓶', { kind: 'bottle', profile: 'standard', w: 72, d: 72, h: 210, tint: '#f7f7f8' }],
  ['plastic-bottle', 'bottle', '塑料瓶', '塑料瓶', { kind: 'bottle', profile: 'standard', w: 76, d: 76, h: 220, tint: '#d9ebf2', member: true }],
  ['bucket', 'bottle', '油桶', '油桶', { kind: 'cup', w: 160, d: 140, h: 180, tint: '#dfe6ea', member: true }],
  ['thermos', 'bottle', '水瓶', '保温杯', { kind: 'bottle', profile: 'slim', w: 70, d: 70, h: 240, tint: '#d9e4ea', member: true }],
  ['mug', 'bottle', '玻璃瓶', '马克杯', { kind: 'cup', w: 80, d: 80, h: 95, tint: '#f4f7fb', member: true }],
  ['cup', 'bottle', '饮料瓶', '杯子', { kind: 'cup', w: 90, d: 80, h: 120, tint: '#fff7ef' }],
  ['can', 'bottle', '啤酒瓶', '易拉罐', { kind: 'can', w: 66, d: 66, h: 123, tint: '#e6e8ee' }],
  ['bowl', 'bottle', '酱汁瓶', '碗', { kind: 'cup', w: 140, d: 140, h: 70, tint: '#f8f1e8', member: true }],

  ['pizza', 'food', '披萨包装', '披萨盒', { w: 240, d: 240, h: 36, fold: 0.5, tint: '#f8efe4', paper: 'kraft' }],
  ['cake', 'food', '蛋糕盒', '蛋糕盒', { w: 200, d: 200, h: 90, tint: '#fff', member: true }],
  ['cookie', 'food', '饼干盒', '饼干盒', { w: 180, d: 120, h: 50, tint: '#f4ecdc' }],
  ['choco', 'food', '巧克力棒', '巧克力盒', { w: 40, d: 20, h: 160, tint: '#6b3a2a', member: true }],
  ['coffee', 'food', '咖啡袋', '咖啡袋', { kind: 'pouch', w: 120, d: 60, h: 200, fold: 0.7, tint: '#c6a36a' }],
  ['tea', 'food', '茶盒', '茶盒', { w: 90, d: 90, h: 140, tint: '#e7f0ea' }],
  ['ice', 'food', '冰淇淋', '冰淇淋杯', { kind: 'cup', w: 80, d: 80, h: 90, tint: '#f8d7e3', member: true }],

  ['pouch', 'bag', '袋子', '纸袋', { kind: 'pouch', w: 140, d: 70, h: 200, tint: '#f7f1e6', paper: 'kraft' }],
  ['stand', 'bag', '小袋', '自立袋', { kind: 'pouch', w: 120, d: 60, h: 180, fold: 0.7, tint: '#efe8ff' }],
  ['shopper', 'bag', '购物袋', '手提袋', { kind: 'pouch', w: 180, d: 80, h: 220, fold: 0.82, tint: '#f4ecdc', paper: 'kraft', handle: true }],
  ['tote', 'bag', '手提袋', '帆布袋', { kind: 'pouch', w: 200, d: 70, h: 240, tint: '#f7f4ee', handle: true, member: true }],
  ['paper-bag', 'bag', '纸袋', '牛皮纸袋', { kind: 'pouch', w: 150, d: 80, h: 210, tint: '#d7b07a', paper: 'kraft' }],
  ['mailer-bag', 'bag', '塑料袋', '快递袋', { kind: 'pouch', w: 260, d: 28, h: 340, tint: '#f3f3f5', paper: 'grey' }],

  ['tee', 'more', '服装', 'T恤', { kind: 'pouch', w: 180, d: 40, h: 220, fold: 0.9, tint: '#f7f7f8', member: true }],
  ['tee-black', 'more', '服装', '黑色T恤', { kind: 'pouch', w: 180, d: 40, h: 220, fold: 0.9, tint: '#2c2c2e', member: true }],
  ['hoodie', 'more', '服装', '连帽衫', { kind: 'pouch', w: 200, d: 50, h: 240, fold: 0.86, tint: '#ece8f4', member: true }],
  ['iphone', 'more', '设备', 'iPhone', { w: 72, d: 8, h: 148, tint: '#f2f2f4', member: true }],
  ['laptop', 'more', '设备', '笔记本电脑', { w: 320, d: 220, h: 18, fold: 0.55, tint: '#ececec', member: true }],
  ['book', 'more', '印刷品', '书', { w: 150, d: 210, h: 24, tint: '#f4efe6' }],
  ['brochure', 'more', '印刷品', '宣传册', { w: 210, d: 297, h: 6, fold: 0.7 }],
  ['envelope', 'more', '印刷品', '信封', { kind: 'pouch', w: 220, d: 12, h: 110, tint: '#f6f1e7' }],
];

export const MODELS = [
  ...square.map(([id, name, extra]) => item({ id, category: 'box', tag: '方形盒', name, ...extra })),
  ...singles.map(([id, category, tag, name, extra]) => item({ id, category, tag, name, ...extra })),
];
