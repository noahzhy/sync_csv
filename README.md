# 多人协作 CSV 编辑器

一个支持多人实时协作编辑 CSV 文件的 Web 应用，使用 WebSocket 实现实时同步。

## 功能特性

- ✅ 实时多人协作编辑
- ✅ 自动保存到服务器
- ✅ 显示在线用户数量
- ✅ 添加/删除行和列
- ✅ 导出 CSV 文件
- ✅ 断线自动重连
- ✅ 实时同步所有修改

## 安装依赖

```bash
npm install
```

## 启动服务器

```bash
npm start
```

服务器将在 http://localhost:3001 启动

## 使用方法

1. 启动服务器后，在浏览器中打开 http://localhost:3001
2. 可以在多个浏览器窗口或不同设备上打开同一地址
3. 点击任意单元格即可编辑，按 Enter 或点击其他地方保存
4. 所有修改会实时同步到所有在线用户
5. 使用工具栏按钮添加行/列或导出数据

## 技术栈

- 后端：Node.js + Express + WebSocket (ws)
- 前端：原生 JavaScript + HTML + CSS
- 数据存储：本地 CSV 文件

## 文件说明

- `server.js` - WebSocket 服务器和 HTTP 服务器
- `public/index.html` - 前端页面
- `public/app.js` - 前端 WebSocket 客户端逻辑
- `public/style.css` - 样式文件
- `data.csv` - CSV 数据文件（自动生成）
