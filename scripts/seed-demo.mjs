// Seed a demo trip with 5 collaborators + realistic content.
// Run: node scripts/seed-demo.mjs
// Assumes backend is running at http://localhost:4000

const API = 'http://localhost:4000';

const USERS = [
  { email: 'alex@vibelog.tw',  name: 'Alex Chen',   password: 'demo1234' },
  { email: 'mia@vibelog.tw',   name: 'Mia Lin',     password: 'demo1234' },
  { email: 'kenji@vibelog.tw', name: 'Kenji Sato',  password: 'demo1234' },
  { email: 'emma@vibelog.tw',  name: 'Emma Wang',   password: 'demo1234' },
  { email: 'raj@vibelog.tw',   name: 'Raj Patel',   password: 'demo1234' },
];

async function api(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function registerOrLogin(u) {
  try {
    const r = await api('POST', '/api/auth/register', null, u);
    return { token: r.data.token, id: r.data.user.id, ...u };
  } catch (e) {
    if (String(e.message).includes('EMAIL_TAKEN')) {
      const r = await api('POST', '/api/auth/login', null, { email: u.email, password: u.password });
      return { token: r.data.token, id: r.data.user.id, ...u };
    }
    throw e;
  }
}

async function main() {
  console.log('▶ Registering 5 users…');
  const accounts = [];
  for (const u of USERS) {
    const acc = await registerOrLogin(u);
    accounts.push(acc);
    console.log(`  ✓ ${acc.name}  (${acc.id})`);
  }
  const [alex, mia, kenji, emma, raj] = accounts;

  console.log('\n▶ Alex creates the trip…');
  const tripRes = await api('POST', '/api/trips', alex.token, {
    title: '京都奈良 5 日小旅行',
    startDate: '2026-05-22',
    endDate: '2026-05-26',
  });
  const trip = tripRes.data;
  const tripId = trip.id;
  console.log(`  ✓ Trip ${tripId}`);

  console.log('\n▶ Alex invites the other 4 (batch)…');
  const inviteeIds = [mia.id, kenji.id, emma.id, raj.id];
  await api('POST', `/api/trips/${tripId}/invitations/batch`, alex.token, { userIds: inviteeIds });
  console.log(`  ✓ ${inviteeIds.length} invitations sent`);

  console.log('\n▶ The other 4 accept their invitations…');
  for (const acc of [mia, kenji, emma, raj]) {
    const list = await api('GET', '/api/users/me/invitations', acc.token);
    const inv = list.find?.((i) => i.tripId === tripId) ?? list[0];
    if (!inv) throw new Error(`No invitation for ${acc.name}`);
    await api('POST', `/api/users/me/invitations/${inv.id}/accept`, acc.token);
    console.log(`  ✓ ${acc.name} joined`);
  }

  console.log('\n▶ Seeding itinerary (5 days)…');
  const itin = [
    { day: 1, startTime: '09:00', durationMinutes: 90,  title: '清水寺',           category: 'attraction', address: '京都市東山区清水 1-294',        note: '木造舞台居高臨下、市景一覽無遺，建議早上去人少。' },
    { day: 1, startTime: '12:30', durationMinutes: 60,  title: '一風堂 拉麵午餐',   category: 'food',       address: '京都市東山區',                  note: '在地人推薦，建議避開中午尖峰排隊。' },
    { day: 1, startTime: '14:30', durationMinutes: 120, title: '祇園散策',         category: 'attraction', address: '京都市東山区祇園',              note: '傍晚 5 點前後在花見小路最有機會遇見藝妓。' },

    { day: 2, startTime: '08:30', durationMinutes: 180, title: '伏見稻荷大社',     category: 'attraction', address: '京都市伏見区深草薮之内町 68',   note: '千本鳥居全程往返約 2 小時，記得帶水。' },
    { day: 2, startTime: '13:00', durationMinutes: 75,  title: '稻荷壽司午餐',     category: 'food',       address: '京都市伏見区',                  note: '伏見稻荷的招牌料理，順便嚐烤糰子。' },
    { day: 2, startTime: '15:30', durationMinutes: 90,  title: '東福寺',           category: 'attraction', address: '京都市東山区本町 15-778',       note: '人潮較少，方丈庭園與通天橋必看。' },

    { day: 3, startTime: '09:00', durationMinutes: 150, title: '嵐山竹林之道',     category: 'attraction', address: '京都市右京区嵯峨天龍寺',        note: '9 點前到達避開人潮，光影最美。' },
    { day: 3, startTime: '12:00', durationMinutes: 90,  title: '渡月橋 + 河畔午餐', category: 'food',       address: '京都市右京区嵐山',              note: '橋頭兩岸都是景觀餐廳，建議先訂位。' },
    { day: 3, startTime: '14:30', durationMinutes: 120, title: '岩田山猴子公園',   category: 'activity',   address: '京都市西京区嵐山',              note: '20 分鐘登山即可俯瞰京都市景，可餵猴子。' },

    { day: 4, startTime: '08:00', durationMinutes: 60,  title: '京都 → 奈良 電車', category: 'transport',  address: 'JR 京都站',                     note: 'JR 奈良線，車程約 45 分鐘。' },
    { day: 4, startTime: '09:30', durationMinutes: 180, title: '奈良公園 餵鹿',    category: 'attraction', address: '奈良縣奈良市奈良公園',          note: '入口處買「鹿仙貝」，記得行禮回謝小鹿。' },
    { day: 4, startTime: '13:00', durationMinutes: 90,  title: '東大寺 大佛殿',    category: 'attraction', address: '奈良市雑司町 406-1',            note: '安置 15 公尺高的大佛，與南大門金剛力士像。' },
    { day: 4, startTime: '16:00', durationMinutes: 60,  title: '返程回京都',       category: 'transport',  address: 'JR 奈良站',                     note: '回程班次班次密集，自由座無壓力。' },

    { day: 5, startTime: '10:00', durationMinutes: 120, title: '錦市場 美食巡禮',  category: 'food',       address: '京都市中京区',                  note: '京野菜、八橋、抹茶甜點都在這。' },
    { day: 5, startTime: '13:00', durationMinutes: 60,  title: '京都駅 午餐',      category: 'food',       address: 'JR 京都站',                     note: '拉麵小路 10F 有 9 家全國名店。' },
    { day: 5, startTime: '15:00', durationMinutes: 90,  title: '伊勢丹採購紀念品', category: 'activity',   address: '京都站伊勢丹',                  note: '伴手禮一站搞定，B1 還有現切壽司。' },

    // Bucket (unscheduled) ideas
    { day: null, title: '金閣寺（鹿苑寺）',  category: 'attraction', address: '京都市北区金閣寺町 1',     note: '若 Day 2 早上有時間可插入。' },
    { day: null, title: '先斗町 居酒屋晚餐', category: 'food',       address: '京都市中京区先斗町',       note: '夜晚河岸氣氛最棒，建議先訂位。' },
  ];
  for (const it of itin) {
    await api('POST', `/api/trips/${tripId}/itinerary`, alex.token, it);
  }
  console.log(`  ✓ ${itin.length} itinerary items`);

  console.log('\n▶ Seeding tasks (cross-assigned)…');
  const tasks = [
    { title: '訂台北→關西來回機票',           category: 'transport',     status: 'done',        assignedUserId: alex.id,  notes: '已確認 JL824/JL823，每人 NT$32,000。' },
    { title: '預訂祇園飯店（4 晚）',          category: 'accommodation', status: 'done',        assignedUserId: mia.id,   notes: 'Hotel Kanra Kyoto，2 間家庭房。' },
    { title: '幫團員買 5 張 eSIM',            category: 'esim',          status: 'in_progress', assignedUserId: kenji.id, notes: 'Airalo 5GB / 7 天，等 QR code 寄到。' },
    { title: '申請 Visit Japan Web QR',       category: 'visa',          status: 'todo',        assignedUserId: emma.id,  notes: '出發前 2 週填完入境表。' },
    { title: '排嵐山半日路線',                category: 'general',       status: 'in_progress', assignedUserId: raj.id,   notes: '竹林→渡月橋→猴子公園，最後留時間吃湯豆腐。' },
    { title: 'Day 5 預訂先斗町居酒屋',        category: 'general',       status: 'todo',        assignedUserId: alex.id,  notes: '5 人位、晚上 7:30，找有窗景的店。' },
  ];
  for (const t of tasks) {
    await api('POST', `/api/trips/${tripId}/tasks`, alex.token, t);
  }
  console.log(`  ✓ ${tasks.length} tasks`);

  console.log('\n▶ Seeding expenses (multi-payer, split equally)…');
  const equalSplit = Object.fromEntries(accounts.map((a) => [a.id, 1]));
  const expenses = [
    { payerId: alex.id,  amount: 160000, currency: 'TWD', description: '來回機票 × 5 人',          splitInfo: equalSplit },
    { payerId: mia.id,   amount: 180000, currency: 'JPY', description: '京都祇園飯店 4 晚（2 房）', splitInfo: equalSplit },
    { payerId: kenji.id, amount: 4500,   currency: 'TWD', description: 'eSIM × 5（Airalo）',      splitInfo: equalSplit },
    { payerId: alex.id,  amount: 7250,   currency: 'JPY', description: 'Day 3 嵐山猴子公園門票',   splitInfo: equalSplit },
    { payerId: emma.id,  amount: 6800,   currency: 'JPY', description: 'Day 4 奈良來回車票 × 5',   splitInfo: equalSplit },
    { payerId: raj.id,   amount: 22400,  currency: 'JPY', description: 'Day 5 先斗町團體晚餐',     splitInfo: equalSplit },
  ];
  for (const ex of expenses) {
    await api('POST', `/api/trips/${tripId}/expenses`, alex.token, ex);
  }
  console.log(`  ✓ ${expenses.length} expenses`);

  console.log('\n▶ Seeding checklists (multi-assignee)…');
  const checklists = [
    { title: '帶護照（效期 > 6 個月）',  notes: '出發前再次確認效期，避免落地被拒。', assigneeIds: accounts.map((a) => a.id) },
    { title: '萬國轉接頭',               notes: '日本是 Type A（兩支扁平腳），帶一個就夠。', assigneeIds: accounts.map((a) => a.id) },
    { title: '現金：每人 JPY 30,000 起',  notes: '小店、神社、地方鐵道很多只收現金。', assigneeIds: accounts.map((a) => a.id) },
    { title: '下載 Google 翻譯離線包',    notes: '日文離線包約 70MB。',                 assigneeIds: [mia.id, emma.id, raj.id] },
    { title: '行動電源（≥ 10000mAh）',    notes: '一整天看地圖拍照很耗電。',           assigneeIds: [alex.id, kenji.id, raj.id] },
    { title: '舒適好走的鞋',              notes: '每天走 15-20 公里，新鞋千萬不要穿。', assigneeIds: accounts.map((a) => a.id) },
  ];
  const createdChecklists = [];
  for (const c of checklists) {
    const r = await api('POST', `/api/trips/${tripId}/checklists`, alex.token, c);
    createdChecklists.push({ item: r.data, assigneeIds: c.assigneeIds });
  }
  console.log(`  ✓ ${checklists.length} checklist items`);

  console.log('\n▶ Marking some checklist items as done (per-person toggle)…');
  // Item 0 (passport): everyone done
  for (const acc of accounts) {
    await api('POST', `/api/trips/${tripId}/checklists/${createdChecklists[0].item.id}/toggle`, acc.token, { completed: true });
  }
  // Item 1 (adapter): alex + mia done
  await api('POST', `/api/trips/${tripId}/checklists/${createdChecklists[1].item.id}/toggle`, alex.token, { completed: true });
  await api('POST', `/api/trips/${tripId}/checklists/${createdChecklists[1].item.id}/toggle`, mia.token, { completed: true });
  // Item 2 (cash): alex done
  await api('POST', `/api/trips/${tripId}/checklists/${createdChecklists[2].item.id}/toggle`, alex.token, { completed: true });
  // Item 5 (shoes): everyone done
  for (const acc of accounts) {
    await api('POST', `/api/trips/${tripId}/checklists/${createdChecklists[5].item.id}/toggle`, acc.token, { completed: true });
  }
  console.log('  ✓ Checklist progress varied');

  console.log('\n▶ Marking 2 expenses as paid back by all members…');
  // Hotel and flights — settle to simulate real progress (not all)
  // First expense (flights, alex paid): mia + kenji marked as paid back
  // Note: togglePaid is per-expense, marks current user. To mark others, we use their tokens.
  // We mimic: mia and kenji have "paid back" alex for flights.
  // (Each user toggling marks themselves as paid back to the payer.)
  const expList = await api('GET', `/api/trips/${tripId}/expenses`, alex.token);
  const exps = expList.data ?? expList;
  // Flights expense (payer = alex)
  const flights = exps.find((e) => e.description.includes('flights × 5'));
  if (flights) {
    await api('POST', `/api/trips/${tripId}/expenses/${flights.id}/toggle-paid`, mia.token,   { paid: true });
    await api('POST', `/api/trips/${tripId}/expenses/${flights.id}/toggle-paid`, kenji.token, { paid: true });
  }
  // eSIM expense (payer = kenji)
  const esim = exps.find((e) => e.description.includes('eSIM'));
  if (esim) {
    await api('POST', `/api/trips/${tripId}/expenses/${esim.id}/toggle-paid`, alex.token, { paid: true });
    await api('POST', `/api/trips/${tripId}/expenses/${esim.id}/toggle-paid`, emma.token, { paid: true });
  }
  console.log('  ✓ Some expenses settled');

  console.log('\n✅ Demo seed complete.');
  console.log(`\nTrip URL:  http://localhost:3000/trips/${tripId}`);
  console.log('\nAccounts (password = demo1234):');
  for (const a of accounts) {
    console.log(`  ${a.email.padEnd(22)} ${a.name}`);
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
