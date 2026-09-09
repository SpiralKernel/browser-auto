# CAU 实验室安全课程自动学习工具

基于 Playwright 的浏览器自动化脚本：登录学习平台、读取课程列表、播放未完成的视频，并处理视频中的弹题。

> 请只在你有权使用的账号和课程中运行，并遵守学校规定。平台页面或接口变化后，脚本可能需要更新。

## 最简单的用法

先安装 [Node.js LTS](https://nodejs.org/)，再下载并解压本项目。

- Windows：双击 `run.bat`
- macOS / Linux：在项目目录运行 `./run.sh`

首次启动只会询问学习平台账号和密码，然后自动安装 Playwright、下载专用 Chromium，并开始处理课程。课程网址和课程图 ID 已内置为全班共用的默认值。账号配置只写入本机 `config.local.json`；该文件已被 Git 忽略，密码输入时显示为 `*`。

## 常用方式

```bash
./run.sh                        # 默认无界面、8 倍速
HEADED=1 ./run.sh               # 显示浏览器窗口
RATE=4 ./run.sh                 # 使用 4 倍速
DRY=1 ./run.sh                  # 只列课程，不播放
MODE=section SECTION=水电安全 ./run.sh
node check_completion.js        # 检查完成情况
```

Windows 可先在命令提示符执行 `set HEADED=1` 等设置，再运行 `run.bat`。重新填写账号或课程时，删除本机的 `config.local.json`，再启动一次。

也可通过 `COURSE_USERNAME`、`COURSE_PASSWORD` 环境变量临时提供账号；`COURSE_URL` 和 `GRAPH_ID` 仅用于需要覆盖默认课程时。

## 运行模式

| 参数 | 说明 |
|---|---|
| `MODE=all` | 处理所有未完成课程（默认） |
| `MODE=one` | 只处理配置网址中的课程 |
| `MODE=section` | 只处理 `SECTION` 指定的章节 |
| `MODE=ids` | 处理 `COURSE_IDS` 指定的逗号分隔 ID |
| `DRY=1` | 只输出课程清单 |
| `RATE=8` | 设置播放速度 |
| `HEADED=1` | 显示浏览器窗口 |

## 安全说明

- 仓库不包含真实账号、密码、Cookie、运行日志或截图。
- 不要强制添加 `config.local.json`、日志、截图、`node_modules` 或浏览器缓存。
- 如果真实密码曾提交到别的仓库，仅删除文件并不够；还应修改密码并清理仓库历史。

## 开发

```bash
npm install
npx playwright install chromium
npm test
```

核心文件为 `run.js`，完成情况检查为 `check_completion.js`，首次配置向导为 `setup.js`。
