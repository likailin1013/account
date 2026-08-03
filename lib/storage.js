'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');
const BLOB_STORE_NAME = 'account-data';
const BLOB_KEY = 'records';

// 顶层静态 require，确保 Netlify 打包函数时能正确打包 @netlify/blobs
let blobs;
try {
  blobs = require('@netlify/blobs');
} catch (e) {
  blobs = null;
}

// 判断是否运行在 Netlify Functions 运行时
// 注意：NETLIFY 环境变量仅在构建/部署时设置，Functions 运行时不一定存在！
// NETLIFY_FUNCTION 和 NETLIFY_BLOBS_CONTEXT 是 Functions 运行时更可靠的标志
function isNetlifyRuntime() {
  return !!(
    process.env.NETLIFY ||
    process.env.NETLIFY_FUNCTION ||
    process.env.NETLIFY_BLOBS_CONTEXT ||
    process.env.NETLIFY_LOCAL
  );
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

// 设置 Netlify Blobs 认证上下文（Functions 2.0 的 handler 第二参数）
// getStore 不接受 context 选项，需通过 setEnvironmentContext 注册全局认证信息
function setBlobsContext(context) {
  if (context && blobs) {
    blobs.setEnvironmentContext(context);
  }
}

// 获取 Blobs Store（Netlify 运行时自动注入 NETLIFY_BLOBS_CONTEXT，也可手动设置）
function getStore(context) {
  if (!blobs) {
    throw new Error('@netlify/blobs 模块加载失败');
  }
  setBlobsContext(context);
  return blobs.getStore({ name: BLOB_STORE_NAME });
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