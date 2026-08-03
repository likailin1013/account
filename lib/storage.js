'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');
const BLOB_STORE_NAME = 'account-data';
const BLOB_KEY = 'records';

// Netlify 构建/函数运行时都会注入 NETLIFY 环境变量，用于区分运行环境
function isNetlifyRuntime() {
  return !!process.env.NETLIFY;
}

function ensureLocalDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ records: [] }, null, 2), 'utf8');
  }
}

function normalize(raw) {
  return { records: Array.isArray(raw && raw.records) ? raw.records : [] };
}

// 在 Netlify Functions 中必须传入 context（Functions 2.0 的 request.context）才能正确认证 Blobs
async function getStore(context) {
  const { getStore } = require('@netlify/blobs');
  return getStore(context ? { name: BLOB_STORE_NAME, context } : { name: BLOB_STORE_NAME });
}

// 读取数据（Netlify 环境用 Blobs，本地用 JSON 文件）
async function readData(context) {
  if (isNetlifyRuntime()) {
    const store = await getStore(context);
    const raw = await store.get(BLOB_KEY, { type: 'text' });
    if (!raw) return { records: [] };
    try {
      return normalize(JSON.parse(raw));
    } catch (err) {
      return { records: [] };
    }
  }

  ensureLocalDataFile();
  try {
    return normalize(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (err) {
    return { records: [] };
  }
}

// 写入数据
async function writeData(data, context) {
  const normalized = normalize(data);

  if (isNetlifyRuntime()) {
    const store = await getStore(context);
    await store.set(BLOB_KEY, JSON.stringify(normalized));
    return;
  }

  ensureLocalDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
}

module.exports = { readData, writeData };