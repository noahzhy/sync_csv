import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parseCSV, toCSV } from './csvParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const CSV_FILE = 'data.csv';
let csvData = [];
let clients = new Set();

// 初始化 CSV 数据
function loadCSV() {
  if (existsSync(CSV_FILE)) {
    const content = readFileSync(CSV_FILE, 'utf-8');
    csvData = parseCSV(content);
  } else {
    // 创建默认数据
    csvData = [
      ['姓名', '年龄', '城市', '职业'],
      ['张三', '25', '北京', '工程师'],
      ['李四', '30', '上海', '设计师'],
      ['王五', '28', '深圳', '产品经理']
    ];
    saveCSV();
  }
}

// 保存 CSV 数据
function saveCSV() {
  const content = toCSV(csvData);
  writeFileSync(CSV_FILE, content, 'utf-8');
}

// 广播消息给所有客户端
function broadcast(message, excludeClient = null) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client !== excludeClient && client.readyState === 1) {
      client.send(data);
    }
  });
}

loadCSV();

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));

// 上传 CSV 文件接口
app.post('/upload', express.text({ type: 'text/csv', limit: '50mb' }), (req, res) => {
  try {
    const content = req.body;
    csvData = parseCSV(content);
    saveCSV();
    
    // 通知所有客户端重新加载数据
    broadcast({ type: 'reload', data: csvData });
    
    res.json({ success: true, message: '文件上传成功' });
  } catch (error) {
    console.error('上传文件错误:', error);
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

// WebSocket 连接处理
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`新客户端连接，当前在线: ${clients.size}`);

  // 发送初始数据
  ws.send(JSON.stringify({
    type: 'init',
    data: csvData,
    clients: clients.size
  }));

  // 通知其他客户端有新用户加入
  broadcast({ type: 'clients', count: clients.size }, ws);

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.type) {
        case 'update':
          // 更新单元格
          const { row, col, value } = msg;
          if (csvData[row]) {
            csvData[row][col] = value;
            saveCSV();
            broadcast({ type: 'update', row, col, value }, ws);
          }
          break;

        case 'addRow':
          // 添加新行
          const newRow = new Array(csvData[0].length).fill('');
          csvData.push(newRow);
          saveCSV();
          broadcast({ type: 'addRow', row: newRow }, ws);
          break;

        case 'deleteRow':
          // 删除行
          if (msg.rowIndex > 0 && msg.rowIndex < csvData.length) {
            csvData.splice(msg.rowIndex, 1);
            saveCSV();
            broadcast({ type: 'deleteRow', rowIndex: msg.rowIndex }, ws);
          }
          break;

        case 'addColumn':
          // 添加新列
          csvData.forEach(row => row.push(''));
          saveCSV();
          broadcast({ type: 'addColumn' }, ws);
          break;
      }
    } catch (error) {
      console.error('处理消息错误:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`客户端断开，当前在线: ${clients.size}`);
    broadcast({ type: 'clients', count: clients.size });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 在浏览器中打开上述地址开始使用`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用，请修改 PORT 环境变量或关闭占用该端口的程序`);
    process.exit(1);
  } else {
    console.error('❌ 服务器启动错误:', err);
    process.exit(1);
  }
});
