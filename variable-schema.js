import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

const editableObject = shape => z.unknown().transform((input, ctx) => {
  const parsed = z.object(shape).passthrough().partial().safeParse(input);
  if (!parsed.success) { ctx.issues.push(...parsed.error.issues); return z.NEVER; }
  return Object.fromEntries(Object.keys(input).map(key => [key, parsed.data[key]]));
});

const text = (fallback = '') => z.preprocess(
  value => (value === undefined || value === null ? fallback : String(value)),
  z.string().catch(fallback),
).prefault(fallback);

const safeNumber = (fallback = 0) => z.preprocess(
  value => (value === undefined || value === null || value === '' ? fallback : value),
  z.coerce.number().catch(fallback),
).prefault(fallback);

const boundedNumber = (fallback, minimum, maximum) => safeNumber(fallback)
  .transform(value => _.clamp(value, minimum, maximum));

const nonNegativeInteger = (fallback = 0) => safeNumber(fallback)
  .transform(value => Math.max(0, Math.trunc(value)));

const parseRecord = schema => z.preprocess(value => {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch (_) {
    return value;
  }
}, schema.catch(ctx => ctx.input)).prefault({});

const realmNames = Object.freeze([
  '斗之气', '斗者', '斗师', '大斗师', '斗灵', '斗王',
  '斗皇', '斗宗', '斗尊', '斗圣', '斗帝',
]);
const realmSteps = Object.freeze(['一', '二', '三', '四', '五', '六', '七', '八', '九']);

const normalizeRealm = value => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const major = String(value.境界 || value.大境界 || '').trim();
    const minor = String(value.小境界 || value.星段 || '').trim();
    value = major && minor ? `${major}·${minor}` : major;
  }
  let source = String(value ?? '').trim().replace(/\s+/gu, '').replace(/[・•]/gu, '·');
  if (!source) return '斗之气·一段';
  for (const major of realmNames) {
    if (source === major) return `${major}·${major === '斗之气' ? '一段' : '一星'}`;
    const match = source.match(new RegExp(`^${major}(?:·)?([一二三四五六七八九1-9])(?:段|星)?$`, 'u'));
    if (!match) continue;
    const index = /^[1-9]$/u.test(match[1]) ? Number(match[1]) - 1 : realmSteps.indexOf(match[1]);
    if (index < 0 || index > 8) break;
    return `${major}·${realmSteps[index]}${major === '斗之气' ? '段' : '星'}`;
  }
  return source;
};

const RealmTextSchema = z.preprocess(
  normalizeRealm,
  z.string().refine(value => {
    const match = value.match(/^(.+)·([一二三四五六七八九])(段|星)$/u);
    if (!match || !realmNames.includes(match[1])) return false;
    return match[1] === '斗之气' ? match[3] === '段' : match[3] === '星';
  }),
).catch('斗之气·一段').prefault('斗之气·一段');

const CultivationSchema = editableObject({
  境界: RealmTextSchema,
  境界进度: boundedNumber(0, 0, 100),
  斗气属性: text('无'),
}).transform(value => ({
  ...value,
  ...(Object.hasOwn(value, '斗气属性') ? { 斗气属性: String(value.境界 || '').startsWith('斗之气·') ? '无' : (String(value.斗气属性 || '').trim() || '未定') } : {}),
})).prefault({ 境界: '斗之气·一段', 境界进度: 0, 斗气属性: '无' });

const MethodSchema = editableObject({
  等阶: text('未定'),
  境界: text('未定'),
  属性: text('未定'),
  进度: boundedNumber(0, 0, 100),
  效果: text(''),
}).prefault({});

const SkillSchema = editableObject({
  等阶: text('未定'),
  境界: text('未定'),
  属性: text('未定'),
  熟练度: boundedNumber(0, 0, 100),
  效果: text(''),
}).prefault({});

const MethodsSchema = parseRecord(z.record(z.string().describe('功法名'), MethodSchema));
const SkillsSchema = parseRecord(z.record(z.string().describe('斗技名'), SkillSchema));

const EquipmentSchema = editableObject({
  类别: text(''),
  来源: text(''),
  能力: text(''),
  简介: text(''),
}).prefault({});

const ItemSchema = editableObject({
  类别: text(''),
  等阶: text(''),
  来源: text(''),
  简介: text(''),
  数量: z.preprocess(value => value === null || value === undefined || value === '' ? null : value, z.coerce.number().finite().transform(value => Math.max(0, value)).nullable()).prefault(null),
  单位: text(''),
}).prefault({});

const AlchemyRecordSchema = editableObject({
  丹方ID: text(''),
  丹方版本: text(''),
  操作者: text(''),
  结果: text(''),
  消耗: text(''),
  产出: text(''),
  成功率: boundedNumber(0, 0, 100),
  随机值: safeNumber(0),
  公式版本: text('炼丹-v1'),
  上下文标识: text(''),
  结算时间: text(''),
  已结算: text('否'),
  正文承接状态: text('已承接'),
  正文承接摘要: text(''),
  正文承接消息ID: text(''),
  正文承接消息页: text(''),
  正文承接时间: text(''),
}).prefault({});

const AlchemyStateSchema = editableObject({
  已掌握丹方: parseRecord(z.record(z.string(), editableObject({ 版本: text(''), 来源: text(''), 时间: text('') }).prefault({}))),
  自拟丹方: parseRecord(z.record(z.string(), editableObject({ 版本: text(''), 名称: text(''), 来源性质: text(''), 完整执行丹方: text(''), 确认时间: text('') }).prefault({}))),
  炼制记录: parseRecord(z.record(z.string(), AlchemyRecordSchema)),
}).prefault({});

const CharacterBaseFields = {
  性别: text('未知'),
  年龄: nonNegativeInteger(0),
  所在地: text('未知'),
  在场状态: text('不在场'),
  关系: text('陌生'),
  所属组织: text('无'),
  外貌: text(''),
  穿着: text(''),
  当前状态: text(''),
  好感度: boundedNumber(0, 0, 100),
  境界: CultivationSchema,
  功法: MethodsSchema,
  斗技: SkillsSchema,
  炼药师品级: text('未初始化'),
  灵魂境界: editableObject({ 境界: text('未初始化'), 阶段: text('未定') }).prefault({ 境界: '未初始化', 阶段: '未定' }),
};

const PersonSchema = editableObject(CharacterBaseFields).prefault({});

const PartnerSchema = editableObject({
  ...CharacterBaseFields,
  内心话: text(''),
  NSFW数据: editableObject({
    樱唇: text(''),
    酥胸: text(''),
    小穴: text(''),
    肥臀: text(''),
    后庭: text(''),
    玉足: text(''),
  }).prefault({}),
}).prefault({});

const PetSchema = editableObject({
  性别: text('未知'),
  所在地: text('未知'),
  等级: text('未定'),
  血脉: text('未定'),
  外貌: text(''),
  潜力: text('未定'),
  内心话: text(''),
  境界: CultivationSchema,
}).prefault({});

export const Schema = editableObject({
  主角: editableObject({
    姓名: text('未命名'),
    性别: text('未知'),
    年龄: nonNegativeInteger(0),
    所在地: text('未知'),
    身份: text('未定'),
    所属组织: text('无'),
    外貌: text(''),
    穿着: text(''),
    当前状态: text(''),
    生命: boundedNumber(100, 0, 100),
    斗气: boundedNumber(100, 0, 100),
    境界: CultivationSchema,
    功法: MethodsSchema,
    斗技: SkillsSchema,
    炼药师品级: text('未初始化'),
    灵魂境界: editableObject({ 境界: text('未初始化'), 阶段: text('未定') }).prefault({ 境界: '未初始化', 阶段: '未定' }),
  }).prefault({}),
  装备: parseRecord(z.record(z.string().describe('装备名'), EquipmentSchema)),
  储物空间: parseRecord(z.record(z.string().describe('物品名'), ItemSchema)),
  伴侣: parseRecord(z.record(z.string().describe('名字'), PartnerSchema)),
  人物: parseRecord(z.record(z.string().describe('名字'), PersonSchema)),
  兽宠: parseRecord(z.record(z.string().describe('名称'), PetSchema)),
  炼丹: AlchemyStateSchema,
});

$(() => {
  registerMvuSchema(Schema);
});
