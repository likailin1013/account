'use strict';

const fs = require('fs');
const path = require('path');
const { getStore } = require('@netlify/blobs');

const BLOB_STORE_NAME = 'account-data';
const BLOB_KEY = 'records';

// 一次性迁移数据：将仓库中的 data/records.json 导入 Netlify Blobs
// 用法：部署后访问 https://你的站点网址/.netlify/functions/migrate
exports.handler = async (request) => {
  try {
    // Netlify Functions 2.0 中，context 对象用于 Blobs 认证
    const context = request && request.context;
    const store = getStore(context ? { name: BLOB_STORE_NAME, context } : { name: BLOB_STORE_NAME });

    // 如果 Blobs 中已有数据，跳过迁移，避免覆盖线上真实数据
    const existing = await store.get(BLOB_KEY, { type: 'text' });
    if (existing) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Blobs 中已存在数据，跳过迁移', migrated: false })
      };
    }

    const filePath = path.join(__dirname, '..', '..', 'data', 'records.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    const records = Array.isArray(data.records) ? data.records : [];
    await store.set(BLOB_KEY, JSON.stringify({ records }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `迁移成功，共导入 ${records.length} 条记录`, migrated: true })
    };
  } catch (err) {
    console.error('迁移失败：', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '迁移失败：' + err.message })
    };
  }
};