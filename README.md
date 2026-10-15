# 包装样机

在浏览器里编辑包装展开面、贴图，并实时预览 3D 样机。样机目录存在 MySQL，封面图存在 MinIO，三维预览仍在浏览器里用 three.js WebGL 完成。

## 技术栈

| 项 | 说明 |
| --- | --- |
| 前端 | Vite 6、原生 HTML / CSS / ES Module |
| 3D | three.js 0.170.0，`WebGLRenderer` |
| 刀版 | Canvas 2D 编辑，pdf-lib 导出 PDF / AI |
| 视频 | 浏览器 `MediaRecorder` |
| 接口 | Node.js、Express，默认端口 3000 |
| 数据 | MySQL 8，库名 `wego_mockup` |
| 文件 | MinIO，桶名 `wego-mockup` |

三维场景使用 `OrbitControls`、`RoomEnvironment`、`ACESFilmicToneMapping` 和软阴影。几何体由前端按盒型实时生成，没有使用 WebGPU。

建议使用 **Node.js 20 LTS**。Vite 6 接受 `^18.0.0 || ^20.0.0 || >=22.0.0`。

## 目录

```text
wego_3d_texture/
├── frontend/                 # 页面与三维预览
│   ├── index.html
│   ├── vite.config.js        # 5173，并把 /api 代理到 3000
│   └── src/
│       ├── main.js           # 场景、贴图、导出，样机列表来自接口
│       ├── models.js         # 刀版布局与缩略图绘制
│       ├── shapes.js         # 盒 / 瓶罐杯 / 袋
│       ├── foldBox.js
│       ├── net.js
│       ├── dielineEditor.js
│       └── export/
└── backend/
    ├── .env.example
    ├── src/index.js          # GET /api/health、GET /api/catalog
    ├── src/seed.js           # 建库、建表、建桶并写入 20 个样机
    └── src/catalog-data.js
```

`shapes.js` 按 `kind` 生成模型：`box` 走折叠盒，`bottle` / `can` / `cup` 走旋转体，`pouch` 走袋子。

## 环境

复制 `backend/.env.example` 为 `backend/.env`，填入 MySQL 和 MinIO。`.env` 不进入 Git。

需要的变量：

- `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`
- `MINIO_ENDPOINT`、`MINIO_PORT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`
- `MINIO_BUCKET`、`MINIO_PUBLIC_BASE`（浏览器能直接打开封面的地址）

首次初始化：

```powershell
cd backend
npm install
npm run seed
```

`seed` 会创建数据库 `wego_mockup`、表 `categories` 和 `models`、存储桶 `wego-mockup`，并上传每个样机的封面。重复执行会按编码更新，不会另起一套数据。

## 启动

开两个终端：

```powershell
cd backend
npm start
```

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。未登录会跳到同级目录的单点系统 `wego_sso`（http://127.0.0.1:5174）。样机页的分类和封面来自 `/api/catalog`，左侧「编辑 / 样机」由单点菜单控制。

`backend/.env` 里的 `SSO_JWT_SECRET` 必须和 `wego_sso/backend/.env` 一致。管理员 `admin` / `admin123`，样机账号 `designer` / `designer123`。

常用命令：

```powershell
cd frontend
npm run build
npm run preview
```

`preview` 同样把 `/api` 代理到本机 3000，所以接口进程要一起开着。

## 部署

```powershell
cd backend
pm2 start npm --name wego-api -- start

cd ../frontend
npm run build
pm2 start npm --name wego-web -- run preview -- --host 0.0.0.0 --port 5173
```

对外建议用 Nginx 把页面和 `/api` 放在同一个域名下：页面走前端，`/api` 转到 3000。封面继续用 `MINIO_PUBLIC_BASE` 指向的对象存储地址。
