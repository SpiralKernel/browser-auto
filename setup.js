const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');

let hideInput = false;
const safeOutput = new Writable({
  write(chunk, encoding, callback) {
    if (!hideInput) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = readline.createInterface({ input: process.stdin, output: safeOutput, terminal: Boolean(process.stdin.isTTY) });
const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
async function askPassword(question) {
  if (!process.stdin.isTTY) return ask(question);
  process.stdout.write(question);
  hideInput = true;
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      hideInput = false;
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}
(async () => {
  console.log('\n首次运行配置（仅保存在本机，不会提交到 Git）\n');
  const username = await ask('学习平台账号：');
  const password = await askPassword('学习平台密码：');
  rl.close();
  if (!username || !password) throw new Error('账号和密码不能为空。');
  const target = path.join(__dirname, 'config.local.json');
  fs.writeFileSync(target, `${JSON.stringify({ username, password }, null, 2)}\n`, { mode: 0o600 });
  console.log('\n配置完成，继续启动。');
})().catch((error) => { rl.close(); console.error(`\n配置失败：${error.message}`); process.exit(1); });
