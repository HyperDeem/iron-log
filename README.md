# 铁记

本地优先的手机健身记录 PWA。数据默认只保存在当前设备的浏览器里，可导出 Excel/CSV，也可用 JSON 完整备份和恢复。

## 功能

- 先确定动作组数、力竭方式和组间休息，再逐组记录重量与次数
- 自动记住动作名称及上次参数，下次可从下拉框直接恢复
- 每完成一组自动开始组间休息倒计时
- 完成目标组数后自动开始固定的 5 分钟动作间休息
- 当天逐组修改重量、次数、休息时间，切换力竭方式
- 按日期查看和搜索训练历史
- 导出 Excel（训练明细 + 动作汇总两个工作表）
- 导入 Excel、CSV，自动识别常见的日期、训练项目、重量、组数、次数、力竭、休息表头
- JSON 完整备份与恢复
- 安装到手机主屏幕后可离线使用

## 本地运行

需要 Node.js 22。

```bash
npm ci
npm run dev
```

电脑浏览器打开 `http://localhost:5173/`。同一 Wi-Fi 下也可以用终端显示的 Network 地址在手机浏览器测试。

## 生产构建

```bash
npm run build
npm run preview
```

`dist/` 是可直接部署的静态文件。

## 发布到 Cloudflare Pages

### 直接上传

1. 在电脑执行 `npm ci` 和 `npm run build`。
2. 登录 Cloudflare，进入 `Workers & Pages`，创建 Pages 项目。
3. 项目名使用 `iron-log-workout` 或其他固定名称。
4. 选择直接上传，将完整的 `dist/` 目录上传。
5. 发布后获得 `https://<项目名>.pages.dev` 的固定 HTTPS 地址。

### 连接 Git 自动发布

如果后续把项目推送到 GitHub 或 GitLab，可使用以下 Cloudflare Pages 构建设置：

- Build command：`npm run build`
- Build output directory：`dist`
- Environment variable：`NODE_VERSION=22`

## 安装到 Android

1. 用 Android Chrome 打开固定的 `pages.dev` 地址。
2. 点击浏览器菜单中的“安装应用”或“添加到主屏幕”。
3. 安装后联网完整打开一次，让 Service Worker 缓存应用资源。
4. 开启飞行模式，确认应用仍能冷启动、记录和导出 Excel。

`public/_headers` 会禁止缓存 `sw.js`，并长期缓存带哈希的前端资源，确保发布新版本后能获取新的 Service Worker。

## 重新生成安装图标

已提交的 PNG 图标位于 `public/`。修改图标设计后，可在 Windows PowerShell 中重新生成：

```powershell
.\scripts\generate-icons.ps1
```

## 导入表头

导入逻辑支持每行一组，也支持一行包含“一共做几组 + 每组做几个”的历史表格式。常用别名包括：

- 日期：`日期`、`训练日期`
- 动作：`训练项目`、`动作`、`项目`
- 重量：`使用重量`、`重量(kg)`、`重量`
- 次数：`每组做几个`、`每组次数`、`次数`
- 力竭：`力竭类型`、`是否力竭`、`力竭`
- 休息：`组间休息多久`、`组间休息(秒)`、`休息时间`

## 数据说明

浏览器数据与网址域名绑定。请始终使用同一个 `pages.dev` 地址；更换域名、清除浏览器数据或更换设备前，请先导出 JSON 备份。
