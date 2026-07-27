# 创意投放数据仪表盘（Vika 自动同步版）

一个**纯静态**的数据仪表盘网站：数据来自 **Vika 维格表**，由 **GitHub Actions 定时自动同步**，**GitHub Pages 免费托管**。

最终效果：你在 Vika 里改数据 → 每 30 分钟自动同步到网站 → 把网址发给组内任何人（含钉钉群），对方点开即看最新，无需注册、无需安装。

---

## 目录结构

```
creative-dashboard/
├── index.html              # 仪表盘网站（已内置一份基准数据作为兜底）
├── data.json               # 由 Actions 自动生成的「最新数据快照」（网站实际读取它）
├── fetch_vika.mjs          # 同步脚本：拉取 Vika → 转换 → 写出 data.json
├── .github/workflows/
│   └── sync.yml            # 定时任务：每30分钟运行 fetch_vika.mjs 并提交 data.json
└── README.md
```

数据流向：

```
你在 Vika 改数据
   └─ GitHub Actions（服务器侧，每30分钟）拉取 Vika → 生成 data.json → 提交
        └─ GitHub Pages 检测到推送 → 自动重新发布网站
             └─ 任何人（含钉钉群）点开网址 → 看到最新数据
```

---

## 本地预览（可选，不依赖 GitHub）

直接用浏览器打开 `index.html` 即可。网站会优先读同目录的 `data.json`；若没有，则使用内置基准数据。

---

## 上线到 GitHub Pages（只需做一次）

### 第 1 步：准备 GitHub 账号
没有的话去 https://github.com 注册一个（免费）。

### 第 2 步：新建仓库
- 点击右上角 **+ → New repository**
- Repository name 填一个，例如 `creative-dashboard`
- 可见性选 **Public**（免费版 GitHub Pages 要求公开仓库；若不想公开源码可升级 Pro 设为 Private，访客体验不变）
- 不要勾选 "Add a README"（我们已有）
- 点 **Create repository**

### 第 3 步：把本目录的文件上传到仓库
方式 A（推荐，有 Git 环境）：
```bash
git init
git add index.html data.json fetch_vika.mjs .github/workflows/sync.yml README.md
git commit -m "init dashboard"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```
方式 B（不会用 Git）：在仓库页面把这几个文件**拖拽上传**即可（同样能工作）。

### 第 4 步：配置 Vika 访问令牌（密匙）
- 进入仓库 **Settings → Secrets and variables → Actions → New repository secret**
- Name 填：`VIKA_TOKEN`
- Secret 填：`uskJqYSRD9SLYHWGHQ1QuRk`（你的 Vika Token）
- 点 **Add secret**
> 令牌只存在 GitHub 密匙里，不会出现在代码或网页中，访客看不到。

### 第 5 步：开启 GitHub Pages
- 进入仓库 **Settings → Pages**
- Source 选 **Deploy from a branch**
- Branch 选 **main**，目录选 **/(root)**
- 点 **Save**
- 稍等 1~2 分钟，你的网址就生效了：
  **`https://<你的用户名>.github.io/<仓库名>/`**

### 第 6 步：触发首次自动同步（可选）
- 进入仓库 **Actions → 同步 Vika 数据 → Run workflow**
- 点一次，立刻用 Vika 最新数据刷新一次（之后每 30 分钟自动跑）

---

## 日常使用

- **你（站长）**：只在 Vika 里改数据，别的什么都不用管。
- **组内人**：收到网址 → 浏览器/钉钉内置浏览器点开 → 看到最新仪表盘（无需注册、无需进 GitHub）。
- **更新频率**：默认每 30 分钟同步一次。如需更频繁，改 `.github/workflows/sync.yml` 里的 `cron`（如每 10 分钟：`*/10 * * * *`）。

---

## 分享到钉钉群

1. 复制上面的 Pages 网址。
2. 直接粘贴到钉钉群发消息，组内人点开即可。
3. 想常驻入口：钉钉 **工作台 → 添加网页应用**，把该网址填进去（若公司钉钉拦截外链，请管理员把 `github.io` 加入可信域名白名单）。

---

## 自定义

| 想改什么 | 怎么改 |
|---------|--------|
| 换成另一张 Vika 表 | 改 `.github/workflows/sync.yml` 里的 `VIKA_DATASHEET_ID`（默认 `dstgba1BmVH0Pc8s61`） |
| 同步频率 | 改 `sync.yml` 里的 `cron` 表达式 |
| 仪表盘样式/字段 | 直接编辑 `index.html` 后重新推送 |

---

## 常见问题

**Q：网站显示的还是旧数据？**
A：同步是定时的（默认30分钟）。可去 Actions 手动点一次 "Run workflow" 立即刷新；或等下一个周期。

**Q：访客打开慢？**
A：网站是纯静态 + 同域读 data.json，比之前"浏览器直连 Vika"稳定且快，一般 1~2 秒出数据。

**Q：Vika Token 泄露怎么办？**
A：去 Vika 重新生成 Token，再到 GitHub Secrets 更新 `VIKA_TOKEN` 即可，无需改代码。

**Q：data.json 和 index.html 里都存了数据，会不会冲突？**
A：不会。网站优先读 `data.json`（最新），它缺失时才用 `index.html` 内置的基准数据兜底。
