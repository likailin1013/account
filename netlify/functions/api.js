'use strict';

const {
  getRecords,
  createRecord,
  deleteRecord,
  batchDelete,
  getStats
} = require('../../lib/handler');

// 兼容 Netlify Functions v1（event, context）和 v2（request, context）两种调用格式
function normalizeRequest(input) {
  // v1 格式：event.httpMethod 存在
  const isV1 = typeof input.httpMethod === 'string';

  const method = (isV1 ? input.httpMethod : input.method || 'GET').toUpperCase();

  // path：v1/v2 均有 path（例如 /api/records/xxx）
  const path = input.path || '';

  // 查询参数：v1 用 queryStringParameters，v2 用 query 或 url
  let query = isV1
    ? (input.queryStringParameters || {})
    : (input.query || {});

  // body：v1 是 JSON 字符串，v2 需手动解析（也可能已由平台解析好）
  let body = input.body || {};
  if (typeof body === 'string') {
    try {
      body = body ? JSON.parse(body) : {};
    } catch (e) {
      body = {};
    }
  } else if (typeof body === 'object' && typeof body.getReader === 'function') {
    // v2 的 ReadableStream：尝试读取并解析
    body = {}; // 交给调用方处理失败，这里给空对象
  }

  return { method, path, query, body };
}

// Netlify Functions 2.0 格式（Express 风格），自动支持 /api/* 路径透传
// request.query 包含 URL 查询参数，request.params 包含路径参数
// context 是 handler 的第二个参数，用于 Blobs 认证
exports.handler = async (request, context) => {
  try {
    const { method, path, query, body } = normalizeRequest(request);
    const pathParts = path.split('/').filter(Boolean); // ['api', 'records', 'xxx']

    // 路由：/api/records
    if (pathParts[1] === 'records') {
      const id = pathParts[2];

      // GET /api/records
      if (!id && method === 'GET') {
        const result = await getRecords(query, context);
        return { statusCode: result.status, body: JSON.stringify(result.body) };
      }

      // POST /api/records
      if (!id && method === 'POST') {
        const result = await createRecord(body, context);
        return { statusCode: result.status, body: JSON.stringify(result.body) };
      }

      // POST /api/records/batch-delete
      if (id === 'batch-delete' && method === 'POST') {
        const result = await batchDelete(body, context);
        return { statusCode: result.status, body: JSON.stringify(result.body) };
      }

      // DELETE /api/records/:id
      if (id && method === 'DELETE') {
        const result = await deleteRecord(id, context);
        return { statusCode: result.status, body: JSON.stringify(result.body) };
      }

      return { statusCode: 404, body: JSON.stringify({ error: '接口不存在' }) };
    }

    // GET /api/stats
    if (pathParts[1] === 'stats' && method === 'GET') {
      const result = await getStats(query, context);
      return { statusCode: result.status, body: JSON.stringify(result.body) };
    }

    return { statusCode: 404, body: JSON.stringify({ error: '接口不存在' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: '服务器内部错误：' + err.message }) };
  }
};