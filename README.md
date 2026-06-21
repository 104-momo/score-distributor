# 平时成绩小分自动计算工具

一个基于 Next.js 16 的教师成绩管理工具，能根据母表（综合成绩表）自动计算并分配平时成绩的小分到子表（成绩明细表），支持学号+姓名双重检索、可编辑预览、整数分配算法、Excel 导出。

## ✨ 核心功能

- **双表检索**：上传母表 + 子表名单，按「学号 + 姓名」双重匹配，自动校验
- **自动分配**：把母表中的签到/作业/课程积分，按规则折算并拆分为子表中的 8 个小分项
  - 出勤（10 分）= round(签到 / 10)
  - 课堂活动（10 分）= 课堂参与(3) + 笔记(3) + 随堂考(4)
  - 课后活动（10 分）= 作业1(2) + 作业2(3) + 作业3(2) + 作业4(3)
- **整数分配算法**：按子项满分比例拆分，余数按小数降序分配，确保三项之和等于目标总分
- **5 种综合分数模式**：平均 / 仅作业 / 仅课程积分 / 取大 / 加权
- **可编辑预览**：直接修改任一小分，平时总分、百分制、总评成绩自动重算
- **等级统计**：优 / 良 / 中 / 及格 / 不及格 分布
- **Excel 导出**：生成完全匹配子表原始模板的 3 层合并表头 xlsx，含配置说明工作表
- **自定义文件名**：导出文件名跟随课程名+班级自动生成，可手动编辑

## 🛠 技术栈

- **框架**：Next.js 16 (App Router) + TypeScript 5
- **样式**：Tailwind CSS 4 + shadcn/ui (New York)
- **Excel 处理**：xlsx (SheetJS) 解析 + exceljs 生成
- **状态管理**：React Hooks + TanStack Query

## 🚀 本地开发

```bash
# 1. 安装依赖
bun install   # 或 npm install

# 2. 启动开发服务器
bun run dev   # 或 npm run dev
```

访问 `http://localhost:3000` 即可使用。

> 💡 本项目已移除数据库依赖（Prisma/SQLite），所有计算在浏览器本地完成，开箱即用。

## ☁️ 部署到 Cloudflare Pages（推荐，国内可访问）

本项目已适配 Cloudflare Pages，**国内访问稳定、永久免费、不休眠**。

### 部署步骤

1. 打开 https://dash.cloudflare.com → 注册/登录
2. 左侧菜单点 **Workers & Pages** → **Create** → **Pages** 标签 → **Connect to Git**
3. 授权 GitHub → 选择仓库 `104-momo/score-distributor`
4. 配置构建：
   - **Framework preset**: `Next.js (Static HTML Export)` 或留空
   - **Build command**: `npx @cloudflare/next-on-pages@1`
   - **Build output directory**: `.vercel/output/static`
   - **Environment variables**: 添加 `NODE_VERSION = 20`
5. 点 **Save and Deploy** → 等 3-5 分钟构建完成
6. 部署完成后会得到一个 `https://score-distributor.pages.dev` 地址，**国内可直接访问**

### 优势

- ✅ 国内访问稳定，CDN 全球加速
- ✅ 永久免费，500 次/月构建，无限请求
- ✅ 不休眠，秒开
- ✅ 自动 HTTPS

## 🛠 技术栈

- **框架**: Next.js 16 (App Router) + TypeScript 5
- **样式**: Tailwind CSS 4 + shadcn/ui (New York)
- **Excel 处理**: xlsx (SheetJS) 解析 + exceljs 生成（纯客户端）
- **部署**: Cloudflare Pages（Edge runtime，无服务端 API）

## 📁 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── export/route.ts    # Excel 导出 API
│   │   └── sample/route.ts    # 模板下载 API
│   ├── page.tsx               # 主页面（四步流程）
│   └── layout.tsx
├── components/
│   ├── score-tool/
│   │   ├── file-uploader.tsx  # 文件上传组件
│   │   └── preview-table.tsx  # 可编辑预览表格
│   └── ui/                    # shadcn/ui 组件
└── lib/
    ├── score-utils.ts         # 核心计算逻辑
    └── excel-reader.ts        # Excel 解析（客户端）
```

## 📝 业务规则

| 子表项目 | 满分 | 来源 |
|---------|------|------|
| 出勤 | 10 | 母表签到 ÷ 10 |
| 课堂参与 | 3 | 综合分数 ÷ 10 × 3/10 |
| 笔记 | 3 | 综合分数 ÷ 10 × 3/10 |
| 随堂考 | 4 | 综合分数 ÷ 10 × 4/10 |
| 作业1 | 2 | 综合分数 ÷ 10 × 2/10 |
| 作业2 | 3 | 综合分数 ÷ 10 × 3/10 |
| 作业3 | 2 | 综合分数 ÷ 10 × 2/10 |
| 作业4 | 3 | 综合分数 ÷ 10 × 3/10 |

- **综合分数** = (作业 + 课程积分) / 2 （默认，可配置）
- **平时总成绩（百分制）** = (出勤 + 课堂活动 + 课后活动) / 30 × 100
- **总评成绩** = 平时 × 30% + 期中 × 20% + 期末 × 50%

## 📄 License

MIT
