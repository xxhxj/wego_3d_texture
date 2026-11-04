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
│   ├── share.html            # 公开分享页 /share
│   ├── vite.config.js        # 5173，并把 /api 代理到 3000
│   └── src/
│       ├── main.js           # 场景、贴图、导出、分享，样机列表来自接口
│       ├── share.js          # 公开分享页入口
│       ├── share-page.css    # 分享页样式
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

`backend/.env` 配置 `SSO_API_URL`（默认 `http://127.0.0.1:3001`）即可，不再需要 `SSO_JWT_SECRET`。后端从 SSO 公钥端点验签，并只接受 `aud` 包含 `wego-mockup` 的令牌。管理员 `admin` / `admin123`，样机账号 `designer` / `designer123`。

常用命令：

```powershell
cd frontend
npm run build
npm run preview
```

`preview` 同样把 `/api` 代理到本机 3000，所以接口进程要一起开着。

## 样机导出

导出弹窗按 Pacdora 样例布局：顶部居中标签、左侧预览和「比例」下拉、右侧 2K/4K 参考卡、地面阴影开关、格式与质量选项。

- 比例：`1:1`、`16:9`、`9:16`、`4:3`、`3:4`
- 格式：JPG / PNG
- 尺寸：2K / 4K / 8K；导出像素按比例对齐样例：
  - 1:1：1920 / 4000 / 7680
  - 16:9：1920×1080 / 3840×2160 / 7680×4320
  - 9:16：1080×1920 / 2160×3840 / 4320×7680
  - 4:3：1600×1200 / 4000×3000 / 7680×5760
  - 3:4：1200×1600 / 3000×4000 / 5760×7680
- 8K 仍按会员限制；阴影默认关闭，可在导出前打开。
- 8K/超高分辨率会按 2×2 分块渲染再拼接，避免部分显卡的 WebGL 视口上限导致画面被裁切。

## 分享

导出弹窗（顶部或底部「导出」）新增 **分享** 标签：

- 首次打开发送会为当前设计生成一个快照，链接形如 `http://127.0.0.1:5173/share?filter_url=<token>`；
- 右侧可以切换「移除官方标志」「移除水印」，设置会实时写回分享记录；
- 「复制链接」复制公开地址，「停止分享」让该地址立即失效（公开接口返回 410）；
- 左侧是可直接旋转、缩放、展开/闭合的 3D 预览，底部保留展开/闭合滑杆；
- 公开页 `/share` 复刻导出弹窗的标签和右侧面板，访客只能查看和复制链接，不能修改分享设置。

分享数据在 `wego_mockup.shares`，预览图在 MinIO 的 `shares/{userId}/{token}.jpg`。后端启动时会自动建表，不需要额外 seed。

接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/shares` | 登录用户创建分享快照 |
| `GET` | `/api/shares/:token` | 公开读取（仅返回面贴图、尺寸和展示开关） |
| `PATCH` | `/api/shares/:token` | 分享者修改标志/水印开关 |
| `DELETE` | `/api/shares/:token` | 分享者停止分享 |

说明：

- 分享是**设计快照**：生成链接后再改尺寸或贴图，需要重新打开发送弹窗生成新链接；旧链接仍然有效，直到手动停止。
- 3D 预览通过 `buildViewerHtml` 生成，three.js 从 CDN 加载；如果外网不可用，会自动回退到分享预览图。
- 分享页的旋转/缩放使用 OrbitControls，与 Pacdora 样例保持一致：拖拽旋转，滚轮上滚放大、下滚缩小。
- 滑杆方向与样例一致：左端「展开」、右端「闭合」，默认在右端闭合。闭合是盒子，展开是带贴图的 6 面刀版；折叠过程带缓动。
- 面贴图加载完成后才隐藏预览图；贴图加载失败时保留预览图，不会出现黑盒。
- 当前盒型的刀版是 6 面简化刀版，样例里的糊口/翼片属于更完整的刀版结构，目前没有存这部分数据，所以展开后的外轮廓会比样例简化。
- 公开页地址默认取 `location.origin`；如果前端在反向代理后需要固定公网地址，构建时设置 `VITE_PUBLIC_SHARE_BASE=https://你的域名`。
- 品牌展示使用「包装样机」，没有照搬样例里的 Pacdora 标识。

## 部署

```powershell
cd backend
pm2 start npm --name wego-api -- start

cd ../frontend
npm run build
pm2 start npm --name wego-web -- run preview -- --host 0.0.0.0 --port 5173
```

对外建议用 Nginx 把页面和 `/api` 放在同一个域名下：页面走前端，`/api` 转到 3000。封面继续用 `MINIO_PUBLIC_BASE` 指向的对象存储地址。

分享页是独立的 `share.html`。生产环境需要把 `/share` 重写到 `share.html`，否则分享链接会落到首页：

```nginx
location = /share {
  rewrite ^ /share.html break;
}
```
