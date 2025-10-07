const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

const TOKEN = '8448996778:AAFrk4QH37fdE7fKkWtuGGXiWfGo3JCCTto'; // o'z tokeningni yoz
const bot = new Telegraf(TOKEN);
const DATA_PATH = path.join(__dirname, 'data.json');

const ALLOWED_IDS = [7341387002, 5931611517];

function isAllowed(userId) {
  return ALLOWED_IDS.includes(userId);
}

// Fayl o'qish / yozish
function readData() {
  try {
    if (!fs.existsSync(DATA_PATH))
      return { templates: {}, users: {} };
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8') || '{}');
    if (!data.templates) data.templates = {};
    if (!data.users) data.users = {};
    return data;
  } catch (e) {
    console.error('readData error', e);
    return { templates: {}, users: {} };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Sessiya
const sessions = {};
function getSession(id) {
  if (!sessions[id]) sessions[id] = { step: null, temp: {} };
  return sessions[id];
}

// /start
bot.start(ctx => {
  if (!isAllowed(ctx.from.id)) return ctx.reply('❌ Sizga ruxsat yo‘q.');
  ctx.reply(
    "👋 Salom! Bu bot orqali:\n\n" +
    "💰 Pul kiritish: /addmoney\n" +
    "📊 Hisobotni ko‘rish: /hisobot\n" +
    "💾 Shablon saqlash: /savetpl\n" +
    "🔄 Reset:\n" +
    "  - /reset_money (faqat pul hisobotlari)\n" +
    "  - /reset_savetpl (faqat shablonlar)\n" +
    "  - /reset_all (hamma maʼlumotlar)\n\n" +
    "Inline rejim: chatda @bot_username deb yozing."
  );
});

// 💰 Pul qo‘shish
bot.command('addmoney', ctx => {
  if (!isAllowed(ctx.from.id)) return ctx.reply('❌ Sizga ruxsat yo‘q.');
  const s = getSession(ctx.from.id);
  s.step = 'await_amount';
  s.temp = {};
  ctx.reply('💵 Summani kiriting:');
});

// 📊 Hisobot
bot.command('hisobot', ctx => {
  if (!isAllowed(ctx.from.id)) return ctx.reply('❌ Sizga ruxsat yo‘q.');
  const data = readData();
  const user = data.users[ctx.from.id];
  if (!user || user.records.length === 0)
    return ctx.reply('📭 Hali hech qanday yozuv yo‘q.');

  let total = 0;
  let text = '📋 Sizning hisobotlaringiz:\n\n';
  user.records.forEach(r => {
    total += r.amount;
    text += `💵 ${r.amount} so'm — ${r.reason}\n🕒 ${r.date}\n\n`;
  });
  text += `💰 Jami: ${total} so'm`;
  ctx.reply(text);
});

// 💾 Shablon saqlash
bot.command('savetpl', ctx => {
  if (!isAllowed(ctx.from.id)) return ctx.reply('❌ Sizga ruxsat yo‘q.');
  const s = getSession(ctx.from.id);
  s.step = 'await_tpl_name';
  s.temp = {};
  ctx.reply('📝 Shablon nomini kiriting (misol: qoqon)');
});

// 🔄 Reset commands
bot.command('reset_money', ctx => {
  if (!isAllowed(ctx.from.id)) return ctx.reply('❌ Sizga ruxsat yo‘q.');
  const data = readData();
  data.users = {};
  writeData(data);
  ctx.reply('✅ Pul hisobotlari reset qilindi.');
});

bot.command('reset_savetpl', ctx => {
  if (!isAllowed(ctx.from.id)) return ctx.reply('❌ Sizga ruxsat yo‘q.');
  const data = readData();
  data.templates = {};
  writeData(data);
  ctx.reply('✅ Shablonlar reset qilindi.');
});

bot.command('reset_all', ctx => {
  if (!isAllowed(ctx.from.id)) return ctx.reply('❌ Sizga ruxsat yo‘q.');
  writeData({ templates: {}, users: {} });
  ctx.reply('✅ Barcha maʼlumotlar reset qilindi.');
});

// 🔤 Foydalanuvchi matn yuborganda
bot.on('text', ctx => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const s = getSession(userId);
  const data = readData();

  // Pul kiritish jarayoni
  if (s.step === 'await_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount)) return ctx.reply('❌ Iltimos, raqam kiriting.');
    s.temp.amount = amount;
    s.step = 'await_reason';
    return ctx.reply('✍️ Pul nimaga ishlatilganini yozing:');
  }

  if (s.step === 'await_reason') {
    const record = {
      amount: s.temp.amount,
      reason: text,
      date: new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
    };
    if (!data.users[userId]) data.users[userId] = { records: [] };
    data.users[userId].records.push(record);
    writeData(data);
    s.step = null;
    s.temp = {};
    return ctx.reply('✅ Maʼlumot saqlandi!');
  }

  // Shablon saqlash jarayoni
  if (s.step === 'await_tpl_name') {
    s.temp.name = text.toLowerCase();
    s.step = 'await_tpl_text';
    return ctx.reply('📨 Endi shablon matnini kiriting:');
  }

  if (s.step === 'await_tpl_text') {
    data.templates[s.temp.name] = text;
    writeData(data);
    s.step = null;
    s.temp = {};
    return ctx.reply('✅ Shablon saqlandi!');
  }
});

// 🔍 Inline qidiruv
bot.on('inline_query', async ctx => {
  const q = ctx.inlineQuery.query.toLowerCase();
  const data = readData();
  const templates = data.templates;

  let results = Object.entries(templates)
    .filter(([name]) => !q || name.includes(q))
    .map(([name, text], i) => ({
      type: 'article',
      id: String(i + 1),
      title: name,
      description: text,
      input_message_content: { message_text: text, parse_mode: 'HTML' }
    }));

  if (results.length === 0) {
    results = [{
      type: 'article',
      id: 'none',
      title: 'Hech narsa topilmadi',
      description: 'Bu nomli shablon yo‘q',
      input_message_content: { message_text: '❌ Shablon topilmadi.' }
    }];
  }

  await ctx.answerInlineQuery(results, { cache_time: 0 });
});

bot.launch().then(() => console.log('✅ Bot ishlayapti (pul + hisobot + shablon + inline)'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
