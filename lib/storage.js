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

// 判断是否运行在 Netlify Functions 运行时（即 AWS Lambda 之上）
//
// 注意：NETLIFY / NETLIFY_FUNCTION 等变量仅在构建/部署时设置，
// 在 Functions 运行时（AWS Lambda 执行环境）中不一定存在！
// 最可靠的信号是：
//   1. handler 传入的 context 参数（Netlify Functions 2.0 始终提供，含 Blobs 认证信息）
//   2. NETLIFY_BLOBS_CONTEXT 环境变量（Netlify 自动注入）
//   3. AWS Lambda 运行时标志（AWS_LAMBDA_FUNCTION_NAME / LAMBDA_TASK_ROOT 等）
function isNetlifyRuntime(context) {
  // context 是 Netlify Functions 2.0 handler 的第二个参数，始终包含 Blobs 认证信息
  if (context && typeof context === 'object') {
    return true;
  }
  return !!(
    process.env.NETLIFY ||
    process.env.NETLIFY_FUNCTION ||
    process.env.NETLIFY_BLOBS_CONTEXT ||
    process.env.NETLIFY_LOCAL ||
    // AWS Lambda 运行时标志（Netlify Functions 运行在 AWS Lambda 上）
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_LAMBDA_FUNCTION_VERSION ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV
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

function ensureBlobsModule() {
  if (!blobs) {
    // 兜底：部分打包场景下首次 require 可能失败，这里再尝试一次
    try {
      blobs = require('@netlify/blobs');
    } catch (e) {
      blobs = null;
    }
  }
}

// 获取 Blobs Store（Netlify 运行时自动注入 NETLIFY_BLOBS_CONTEXT，也可手动设置）
function getStore(context) {
  ensureBlobsModule();
  if (!blobs) {
    throw new Error('@netlify/blobs 模块加载失败');
  }
  setBlobsContext(context);
  return blobs.getStore({ name: BLOB_STORE_NAME });
}

// 判断是否因只读文件系统导致的写入失败（如 AWS Lambda 的 /var/task 目录）
function isReadOnlyFsError(err) {
  if (!err) return false;
  return err.code === 'EROFS' || err.code === 'EACCES' || err.code === 'ENOSPC';
}

// 读取数据（Netlify 环境用 Blobs，本地用 JSON 文件）
async function readData(context) {
  if (isNetlifyRuntime(context)) {
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
    // 防御性兜底：运行时判断漏检导致走到本地文件路径，
    // 但文件系统只读（如 AWS Lambda 的 /var/task）时，回退到 Netlify Blobs。
    if (isReadOnlyFsError(err)) {
      const store = await getStore(context);
      const raw = await store.get(BLOB_KEY, { type: 'text' });
      if (!raw) return { records: [] };
      try {
        return normalize(JSON.parse(raw));
      } catch (e) {
        return { records: [] };
      }
    }
    return { records: [] };
  }
}

// 写入数据
async function writeData(data, context) {
  const normalized = normalize(data);

  if (isNetlifyRuntime(context)) {
    const store = await getStore(context);
    await store.set(BLOB_KEY, JSON.stringify(normalized));
    return;
  }

  ensureLocalDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  } catch (err) {
    // 防御性兜底：运行时判断漏检导致走到本地文件路径，
    // 但文件系统只读（如 AWS Lambda 的 /var/task）时，回退到 Netlify Blobs。
    // EROFS 本身就证明当前处于只读文件系统（本地开发环境不会出现）。
    if (isReadOnlyFsError(err)) {
      const store = await getStore(context);
      await store.set(BLOB_KEY, JSON.stringify(normalized));
      return;
    }
    throw err;
  }
}

module.exports = { readData, writeData };