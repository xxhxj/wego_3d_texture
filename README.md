# 包装样机

在浏览器里编辑包装展开面、贴图，并实时预览 3D 样机。支持盒子、瓶子、食品包装和袋子，可导出样机图、刀版、视频和独立 HTML。

纯前端项目，没有后端服务。页面由原生 JavaScript 和 Vite 组成，3D 场景使用 three.js 的 **WebGL** 渲染器（`THREE.WebGLRenderer`）。

## 技术栈

| 项 | 说明 |
| --- | --- |
| 构建 | Vite 6（锁定版本 6.4.4） |
| 页面 | 原生 HTML / CSS / ES Module，无 React、Vue |
| 3D | three.js 0.170.0，WebGL |
| 刀版编辑 | Canvas 2D |
| 刀版导出 | pdf-lib 1.17.1（PDF / AI） |
| 视频导出 | 浏览器 `MediaRecorder` |

3D 相关能力：

- `WebGLRenderer`：抗锯齿、透明背景、`preserveDrawingBuffer`（截图和录像需要）
- `OrbitControls`：拖拽旋转、缩放
- `RoomEnvironment` + `PMREMGenerator`：环境贴图
- `ACESFilmicToneMapping`、`PCFSoftShadowMap` 软阴影
- `MeshStandardMaterial`、`CanvasTexture` 按面贴图

项目未使用 WebGPU，也没有 `WebGPURenderer`。

导出的独立 HTML 通过 jsDelivr CDN 加载 three.js 0.170.0，打开时需要能访问外网。

## Node 版本

Vite 6 要求：

```text
Node.js ^18.0.0 || ^20.0.0 || >=22.0.0
```

建议使用 **Node.js 20 LTS**。包管理器使用 npm（仓库内有 `package-lock.json`）。

## 目录结构

```text
wego_3d_texture/
├── index.html              # 页面入口：编辑栏、展开面、3D 舞台、导出弹窗
├── package.json
├── package-lock.json
├── vite.config.js          # 端口 5173，监听 0.0.0.0；pdf-lib 别名
└── src/
    ├── main.js             # 应用入口：场景、交互、贴图、导出调度
    ├── style.css
    ├── models.js           # 盒型分类与尺寸预设
    ├── shapes.js           # 按盒型创建网格（盒 / 瓶罐杯 / 袋）
    ├── foldBox.js          # 可折叠纸盒（铰链展开与闭合）
    ├── net.js              # 十字刀版布局、贴图裁切与绘制
    ├── dielineEditor.js    # 展开面画布：拖拽、缩放、滚轮
    └── export/
        ├── common.js       # 下载与尺寸换算
        ├── mockup.js       # 样机图 JPG / PNG（2K / 4K / 8K）
        ├── dieline.js      # 刀版 PDF / AI（RGB / CMYK）
        ├── video.js        # 转台录像 MP4 / MOV / WebM
        └── html.js         # 内嵌贴图的独立查看页
```

盒型预设在 `src/models.js`：盒子、瓶子、食品包装、袋子。`src/shapes.js` 按 `kind` 分发：

- `box`：`foldBox.js` 中的折叠盒
- `bottle` / `can` / `cup`：圆柱或锥体
- `pouch`：袋子（可选提手）

## 本地启动

```powershell
npm install
npm run dev
```

开发服务器：

- 地址：`http://localhost:5173`
- 监听：`0.0.0.0:5173`（局域网可访问）
- `strictPort: true`，5173 被占用时会直接失败

常用脚本：

```powershell
npm run dev       # 开发
npm run build     # 构建到 dist/
npm run preview   # 预览构建结果
```

## 部署

构建产物是静态文件，放在 `dist/`。任选一种方式托管即可。

### 1. 构建

```powershell
npm install
npm run build
```

### 2. 静态目录

把 `dist/` 交给 Nginx、Caddy 或对象存储。Nginx 示例：

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/wego-3d/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3. 用 Vite preview 临时托管

```powershell
npm run preview -- --host 0.0.0.0 --port 5173
```

### 4. 用 PM2 保持进程

先安装 PM2：

```powershell
npm install -g pm2
```

开发模式：

```powershell
pm2 start npm --name wego-3d -- run dev
```

生产模式（先构建，再预览）：

```powershell
npm run build
pm2 start npm --name wego-3d -- run preview -- --host 0.0.0.0 --port 5173
```

管理：

```powershell
pm2 list
pm2 logs wego-3d
pm2 restart wego-3d
pm2 stop wego-3d
pm2 delete wego-3d
```

长期对外服务优先用静态目录（方式 2）。`vite preview` 和 PM2 适合内网或临时托管。
