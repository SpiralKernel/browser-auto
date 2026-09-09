const fs = require('fs');
const path = require('path');
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
async function askPassword(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return ask(question);
  rl.pause();
  process.stdout.write(question);
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  let value = '';
  return new Promise((resolve) => {
    const onKey = (str, key) => {
      if (key && (key.name === 'return' || key.name === 'enter')) {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKey);
        process.stdout.write('\n');
        rl.resume();
        resolve(value);
      } else if (key && key.name === 'backspace') {
        if (value) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
      } else if (key && key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.exit(130);
      } else if (str && !key.ctrl && !key.meta) {
        value += str;
        process.stdout.write('*');
      }
    };
    process.stdin.on('keypress', onKey);
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
