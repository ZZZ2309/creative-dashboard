// fetch_vika.mjs
// 由 GitHub Actions 在服务器端运行：分页拉取 Vika 维格表 -> 转换为仪表盘 products 结构 -> 写出 data.json
// 环境变量：VIKA_TOKEN（必填）、VIKA_DATASHEET_ID（必填）
import fs from 'fs';

const VIKA_API_BASE = 'https://api.vika.cn/fusion/v1';
const TOKEN = process.env.VIKA_TOKEN;
const DATASHEET_ID = process.env.VIKA_DATASHEET_ID;
const OUT_PATH = process.env.OUT_PATH || 'data.json';
const PAGE_SIZE = 1000;

if (!TOKEN) { console.error('[错误] 缺少环境变量 VIKA_TOKEN'); process.exit(1); }
if (!DATASHEET_ID) { console.error('[错误] 缺少环境变量 VIKA_DATASHEET_ID'); process.exit(1); }

function toNum(v) {
  const s = String(v == null ? '0' : v).replace(/,/g, '').trim();
  return s === '' ? 0 : Number(s);
}

async function fetchAllRecords() {
  const all = [];
  let pageNum = 1;
  let total = Infinity;
  while (all.length < total) {
    const url = `${VIKA_API_BASE}/datasheets/${DATASHEET_ID}/records?pageSize=${PAGE_SIZE}&pageNum=${pageNum}`;
    console.log(`[Vika] 请求第 ${pageNum} 页: ${url}`);
    const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + TOKEN } });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Vika HTTP ${resp.status}: ${txt.substring(0, 200)}`);
    }
    const json = await resp.json();
    const data = json && json.data ? json.data : {};
    const records = Array.isArray(data.records) ? data.records : [];
    if (typeof data.total === 'number') total = data.total;
    console.log(`[Vika] 第 ${pageNum} 页返回 ${records.length} 条 (total=${total})`);
    if (!records.length) break;
    all.push(...records);
    if (records.length < PAGE_SIZE) break;
    pageNum++;
  }
  return all;
}

function buildProducts(records) {
  const products = [];
  const productLookup = {};
  let allCreativeCount = 0;
  let parsedCount = 0;

  records.forEach((rec) => {
    const f = rec.fields || {};
    const productName = String(f['产品'] || '').trim();
    const creativeName = String(f['创意名称'] || '').trim();
    const dateVal = String(f['日期'] || '').trim();
    if (!productName || !creativeName || !dateVal) return;

    const dm = dateVal.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    const date = dm ? `${dm[1]}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}` : dateVal;

    const creativeUrl = String(f['创意网址'] || '').trim();
    const status = String(f['投放状态'] || '投放中').trim();
    const startDate = String(f['投放开始时间'] || '').trim();
    const endDate = String(f['投放结束时间'] || '').trim();
    const impressions = toNum(f['展现量']) || 0;
    const clicks = toNum(f['点击量']) || 0;
    const amount = toNum(f['总成交金额']) || 0;
    const ctrStr = String(f['点击率'] || '').replace('%', '').trim();
    const ctr = ctrStr ? parseFloat(ctrStr) : (impressions > 0 ? parseFloat((clicks / impressions * 100).toFixed(2)) : 0);
    const cvrStr = String(f['点击转化率'] || '').replace('%', '').trim();
    const orders = toNum(f['直接成交笔数']) || 0;
    const cart = toNum(f['总购物车数']) || 0;
    const cvr = cvrStr ? parseFloat(cvrStr) : (clicks > 0 ? parseFloat((orders / clicks * 100).toFixed(2)) : 0);

    let product = productLookup[productName];
    if (!product) {
      product = { id: 'P' + (products.length + 1), name: productName, creatives: [] };
      products.push(product);
      productLookup[productName] = product;
    }

    let creative = product.creatives.find((c) => c.name === creativeName);
    const isImgUrl = creativeUrl && /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(creativeUrl);
    if (!creative) {
      creative = {
        id: 'CR' + String(allCreativeCount + 1).padStart(4, '0'),
        name: creativeName,
        url: creativeUrl,
        img: isImgUrl ? creativeUrl : null,
        status: (status === '已结束' || status === '投放中') ? status : '投放中',
        startDate: startDate || null,
        endDate: endDate || null,
        dailyData: []
      };
      product.creatives.push(creative);
      allCreativeCount++;
    } else {
      if (status === '已结束' || status === '投放中') creative.status = status;
      if (creativeUrl) { creative.url = creativeUrl; if (isImgUrl) creative.img = creativeUrl; }
      if (startDate) creative.startDate = startDate;
      if (endDate) creative.endDate = endDate;
    }

    const dayData = { date, impressions, clicks, ctr, cvr, orders, cart, amount };
    const existing = creative.dailyData.find((d) => d.date === date);
    if (existing) Object.assign(existing, dayData);
    else creative.dailyData.push(dayData);
    parsedCount++;
  });

  return { products, parsedCount };
}

function dedupProductCreatives(p) {
  const seen = {};
  const deduped = [];
  p.creatives.forEach((c) => {
    const key = c.name;
    if (seen[key]) {
      const ex = seen[key];
      if (c.dailyData && c.dailyData.length) {
        const dates = {};
        ex.dailyData.forEach((d) => { dates[d.date] = true; });
        c.dailyData.forEach((d) => { if (!dates[d.date]) { ex.dailyData.push(d); dates[d.date] = true; } });
      }
      if (!ex.url && c.url) ex.url = c.url;
      if (ex.img && ex.img.indexOf('base64') > -1 && c.img && c.img.indexOf('base64') === -1) ex.img = c.img;
    } else {
      seen[key] = c;
      deduped.push(c);
    }
  });
  return deduped;
}

(async () => {
  try {
    const records = await fetchAllRecords();
    console.log(`[Vika] 共获取记录 ${records.length} 条`);
    if (!records.length) throw new Error('Vika 表无数据');

    const { products, parsedCount } = buildProducts(records);
    products.forEach((p) => { p.creatives = dedupProductCreatives(p); });
    if (!products.length) throw new Error(`数据解析后无有效产品(parsed=${parsedCount})`);

    const totalRecords = records.length;
    const out = {
      generatedAt: new Date().toISOString(),
      source: 'Vika',
      totalRecords,
      products
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(out));
    console.log(`[完成] 写出 ${OUT_PATH}: 产品=${products.length}, 创意=${products.reduce((s, p) => s + p.creatives.length, 0)}, 记录=${totalRecords}, 字节=${fs.statSync(OUT_PATH).size}`);
  } catch (e) {
    console.error('[失败]', e.message);
    process.exit(1);
  }
})();
