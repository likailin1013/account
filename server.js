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

const app = express();
const PORT = process.env.PORT || 3000;

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
  console.log(`✅ 记账服务已启动: http://localhost:${PORT}`);
});