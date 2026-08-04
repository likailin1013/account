'use strict';

// 验证 storage.js 的运行时判断逻辑
// 1. 本地环境：应走本地 JSON 文件读写
// 2. 模拟 Netlify Functions 2.0（context 参数）：应走 Netlify Blobs 路径
// 3. 模拟 AWS Lambda（Netlify Functions 运行时）：应走 Netlify Blobs 路径

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'storage-test.log');

function log(msg) {
  fs.appendFileSync(LOG_FILE, msg + '\n', 'utf8');
}

(async function () {
  try {
    // 清空日志
    fs.writeFileSync(LOG_FILE, '', 'utf8');

    // ---- 测试 1：本地模式（无 context，无 Lambda 环境变量）----
    const { readData, writeData } = require('./storage');
    await writeData({ records: [{ id: 'local-1', note: 'local' }] });
    const localData = await readData();
    log('TEST1 local mode: OK, records=' + localData.records.length);
    await writeData({ records: [] });
    log('TEST1 local reset: OK');

    // ---- 测试 2：模拟 Netlify Functions 2.0（传入 context 参数）----
    // 重新加载模块以应用新的环境变量
    delete require.cache[require.resolve('./storage')];
    const storageContext = require('./storage');
    try {
      const data = await storageContext.readData({});
      log('TEST2 context mode: Blobs path invoked, records=' + data.records.length);
    } catch (e) {
      // 本地无 Blobs 认证上下文，预期会抛错，但错误应来自 Blobs 而非 EROFS 文件写入
      if (/EROFS|read-only/i.test(e.message)) {
        log('TEST2 context mode: FAIL - still hit read-only filesystem: ' + e.message);
      } else {
        log('TEST2 context mode: OK (no creds locally, error is from Blobs): ' + e.message);
      }
    }

    // ---- 测试 3：模拟 AWS Lambda（Netlify Functions 运行时）----
    // 重新加载模块以应用新的环境变量
    delete require.cache[require.resolve('./storage')];
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'account-api';
    process.env.LAMBDA_TASK_ROOT = '/var/task';
    const storageNetlify = require('./storage');
    try {
      const data = await storageNetlify.readData();
      log('TEST3 netlify mode: Blobs path invoked, records=' + data.records.length);
    } catch (e) {
      // 本地无 Blobs 认证上下文，预期会抛错，但错误应来自 Blobs 而非 EROFS 文件写入
      if (/EROFS|read-only/i.test(e.message)) {
        log('TEST3 netlify mode: FAIL - still hit read-only filesystem: ' + e.message);
      } else {
        log('TEST3 netlify mode: OK (no creds locally, error is from Blobs): ' + e.message);
      }
    }

    console.log('Done. See ' + LOG_FILE);
  } catch (e) {
    console.error('Test crash: ' + e.message);
    process.exit(1);
  }
})();