<<<<<<< HEAD
'use strict';

const express = require('express');
const path = require('path');
const {
  getRecords,
  createRecord,
  deleteRecord,
  batchDelete,
  getStats
} = require('./lib/handler');
=======
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
>>>>>>> f02dd0f89fbc555803168072de27cb46ea764c25

const app = express();
const PORT = process.env.PORT || 3000;

<<<<<<< HEAD
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 获取记录列表（支持过滤）
app.get('/api/records', async (req, res) => {
  try {
    const result = await getRecords(req.query);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 新增记录
app.post('/api/records', async (req, res) => {
  try {
    const result = await createRecord(req.body);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除记录
app.delete('/api/records/:id', async (req, res) => {
  try {
    const result = await deleteRecord(req.params.id);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 批量删除记录
app.post('/api/records/batch-delete', async (req, res) => {
  try {
    const result = await batchDelete(req.body);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 月度统计
app.get('/api/stats', async (req, res) => {
  try {
    const result = await getStats(req.query);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 非 API 请求回退到前端页面（SPA 场景支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
=======
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');

// 确保数据目录和文件存在
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ records: [] }, null, 2), 'utf8');
  }
}

// 读取数据
function readData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return { records: Array.isArray(data.records) ? data.records : [] };
  } catch (err) {
    return { records: [] };
  }
}

// 写入数据
function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 获取记录列表，支持过滤
app.get('/api/records', (req, res) => {
  const { month, category, type } = req.query;
  let { records } = readData();

  if (month) {
    records = records.filter(r => r.date.startsWith(month));
  }
  if (category && category !== '全部') {
    records = records.filter(r => r.category === category);
  }
  if (type && type !== 'all') {
    records = records.filter(r => r.type === type);
  }

  // 按日期倒序、创建时间倒序排列
  records.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  res.json(records);
});

// 新增记录
app.post('/api/records', (req, res) => {
  const { date, type, category, amount, note } = req.body;

  // 校验
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: '日期格式不正确，应为 YYYY-MM-DD' });
  }
  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: '类型必须为 income 或 expense' });
  }
  if (!category || typeof category !== 'string' || category.trim() === '') {
    return res.status(400).json({ error: '分类不能为空' });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: '金额必须为正数' });
  }

  const record = {
    id: crypto.randomUUID(),
    date,
    type,
    category: category.trim(),
    amount: Math.round(amountNum * 100) / 100, // 保留两位小数
    note: (note || '').trim(),
    createdAt: new Date().toISOString()
  };

  const data = readData();
  data.records.push(record);
  writeData(data);

  res.status(201).json(record);
});

// 删除记录
app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  const before = data.records.length;
  data.records = data.records.filter(r => r.id !== id);

  if (data.records.length === before) {
    return res.status(404).json({ error: '记录不存在' });
  }

  writeData(data);
  res.json({ success: true });
});

// 批量删除记录
app.post('/api/records/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择要删除的记录' });
  }

  const idSet = new Set(ids);
  const data = readData();
  const before = data.records.length;
  data.records = data.records.filter(r => !idSet.has(r.id));

  if (data.records.length === before) {
    return res.status(404).json({ error: '所选记录不存在' });
  }

  writeData(data);
  res.json({ success: true, deleted: before - data.records.length });
});

// 月度统计
app.get('/api/stats', (req, res) => {
  const { month } = req.query;
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { records } = readData();
  const monthRecords = records.filter(r => r.date.startsWith(targetMonth));

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory = {};
  const dailyMap = {};

  monthRecords.forEach(r => {
    const amount = r.amount;
    if (r.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      expenseByCategory[r.category] = (expenseByCategory[r.category] || 0) + amount;
    }

    if (!dailyMap[r.date]) {
      dailyMap[r.date] = { income: 0, expense: 0, items: [] };
    }
    if (r.type === 'income') {
      dailyMap[r.date].income += amount;
    } else {
      dailyMap[r.date].expense += amount;
    }
    dailyMap[r.date].items.push(r);
  });

  // 分类占比（降序）
  const categoryStats = Object.entries(expenseByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  res.json({
    month: targetMonth,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    balance: Math.round((totalIncome - totalExpense) * 100) / 100,
    categoryStats,
    daily: dailyMap
  });
});

app.listen(PORT, () => {
  ensureDataFile();
>>>>>>> f02dd0f89fbc555803168072de27cb46ea764c25
  console.log(`✅ 记账服务已启动: http://localhost:${PORT}`);
});