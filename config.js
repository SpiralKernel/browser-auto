const fs = require('fs');
const path = require('path');
const localPath = path.join(__dirname, 'config.local.json');
let local = {};
if (fs.existsSync(localPath)) {
  try { local = JSON.parse(fs.readFileSync(localPath, 'utf8')); }
  catch (error) { throw new Error(`无法读取 config.local.json：${error.message}`); }
}
const COURSE_URL = process.env.COURSE_URL || local.courseUrl || '';
const graphMatch = COURSE_URL.match(/[?&]graphId=(\d+)/);
const config = {
  USERNAME: process.env.COURSE_USERNAME || local.username || '',
  PASSWORD: process.env.COURSE_PASSWORD || local.password || '',
  COURSE_URL,
  GRAPH_ID: process.env.GRAPH_ID || local.graphId || (graphMatch && graphMatch[1]) || '',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  HEADED: process.env.HEADED === '1',
};
const missing = [];
if (!config.USERNAME) missing.push('账号');
if (!config.PASSWORD) missing.push('密码');
if (!config.COURSE_URL) missing.push('课程网址');
if (!config.GRAPH_ID) missing.push('课程网址中的 graphId');
if (missing.length) throw new Error(`缺少${missing.join('、')}。请先运行 node setup.js，或直接双击启动脚本完成配置。`);
module.exports = config;
