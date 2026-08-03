'use strict';

const crypto = require('crypto');
const { readData, writeData } = require('./storage');

// ---- 数据校验与处理 ----

function buildRecord(data) {
  const { date, type, category, amount, note } = data;
  return {
    id: crypto.randomUUID(),
    date,
    type,
    category: category.trim(),
    amount: Math.round(Number(amount) * 100) / 100,
    note: (note || '').trim(),
    createdAt: new Date().toISOString()
  };
}

// ---- API 处理 ----

// GET /api/records 获取记录列表（支持过滤）
async function getRecords(query) {
  const { month, category, type } = query;
  let { records } = await readData();

  if (month) {
    records = records.filter(r => r.date.startsWith(month));
  }
  if (category && category !== '全部') {
    records = records.filter(r => r.category === category);
  }
  if (type && type !== 'all') {
    records = records.filter(r => r.type === type);
  }

  records.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  return { status: 200, body: records };
}

// POST /api/records 新增记录
async function createRecord(body) {
  const { date, type, category, amount } = body || {};

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: 400, body: { error: '日期格式不正确，应为 YYYY-MM-DD' } };
  }
  if (type !== 'income' && type !== 'expense') {
    return { status: 400, body: { error: '类型必须为 income 或 expense' } };
  }
  if (!category || typeof category !== 'string' || category.trim() === '') {
    return { status: 400, body: { error: '分类不能为空' } };
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return { status: 400, body: { error: '金额必须为正数' } };
  }

  const record = buildRecord(body);
  const data = await readData();
  data.records.push(record);
  await writeData(data);

  return { status: 201, body: record };
}

// DELETE /api/records/:id 删除记录
async function deleteRecord(id) {
  const data = await readData();
  const before = data.records.length;
  data.records = data.records.filter(r => r.id !== id);

  if (data.records.length === before) {
    return { status: 404, body: { error: '记录不存在' } };
  }

  await writeData(data);
  return { status: 200, body: { success: true } };
}

// POST /api/records/batch-delete 批量删除
async function batchDelete(body) {
  const { ids } = body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return { status: 400, body: { error: '请选择要删除的记录' } };
  }

  const idSet = new Set(ids);
  const data = await readData();
  const before = data.records.length;
  data.records = data.records.filter(r => !idSet.has(r.id));

  if (data.records.length === before) {
    return { status: 404, body: { error: '所选记录不存在' } };
  }

  await writeData(data);
  return { status: 200, body: { success: true, deleted: before - data.records.length } };
}

// GET /api/stats 月度统计
async function getStats(query) {
  const { month } = query;
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { records } = await readData();
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

  const categoryStats = Object.entries(expenseByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    status: 200,
    body: {
      month: targetMonth,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      balance: Math.round((totalIncome - totalExpense) * 100) / 100,
      categoryStats,
      daily: dailyMap
    }
  };
}

module.exports = {
  getRecords,
  createRecord,
  deleteRecord,
  batchDelete,
  getStats
};