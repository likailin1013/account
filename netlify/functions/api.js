'use strict';

const {
  getRecords,
  createRecord,
  deleteRecord,
  batchDelete,
  getStats
} = require('../../lib/handler');

// Netlify Functions 2.0 格式（Express 风格），自动支持 /api/* 路径透传
// request.query 包含 URL 查询参数，request.params 包含路径参数
exports.handler = async (request) => {
  try {
    const method = request.method.toUpperCase();
    const { path } = request; // 例如 /api/records/xxx
    const pathParts = path.split('/').filter(Boolean); // ['api', 'records', 'xxx']

    // Netlify Functions 2.0 中，context 对象用于 Blobs 认证
    const context = request.context;

    // 路由：/api/records
    if (pathParts[1] === 'records') {
      const id = pathParts[2];

      // GET /api/records
      if (!id && method === 'GET') {
        const result = await getRecords(request.query || {}, context);
        return { statusCode: result.status, body: JSON.stringify(result.body) };
      }

      // POST /api/records
      if (!id && method === 'POST') {
        const result = await createRecord(request.body || {}, context);
        return { statusCode: result.status, body: JSON.stringify(result.body) };
      }

      // POST /api/records/batch-delete
      if (id === 'batch-delete' && method === 'POST') {
        const result = await batchDelete(request.body || {}, context);
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
      const result = await getStats(request.query || {}, context);
      return { statusCode: result.status, body: JSON.stringify(result.body) };
    }

    return { statusCode: 404, body: JSON.stringify({ error: '接口不存在' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: '服务器内部错误' }) };
  }
};