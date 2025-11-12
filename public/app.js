let ws;
let csvData = [];
let isConnected = false;
let isRendering = false;

const statusEl = document.getElementById('status');
const userCountEl = document.getElementById('userCount');
const tableBody = document.getElementById('tableBody');
const addRowBtn = document.getElementById('addRow');
const addColumnBtn = document.getElementById('addColumn');
const exportBtn = document.getElementById('export');
const fileInput = document.getElementById('fileInput');
const loadingOverlay = document.getElementById('loadingOverlay');
const rowCountEl = document.getElementById('rowCount');
const colCountEl = document.getElementById('colCount');
const tableWrapper = document.getElementById('tableWrapper');

// 虚拟滚动配置
const ROW_HEIGHT = 40;
const ROWS_PER_PAGE = 50;
let currentPage = 0;
let totalPages = 0;
let scrollTimeout = null;

// 更新数据统计
function updateStats() {
  rowCountEl.textContent = csvData.length;
  colCountEl.textContent = csvData.length > 0 ? csvData[0].length : 0;
}

// 连接 WebSocket
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    isConnected = true;
    const statusText = statusEl.querySelector('.status-text');
    if (statusText) statusText.textContent = '已连接';
    statusEl.classList.add('connected');
    statusEl.classList.remove('disconnected');
    console.log('WebSocket 连接成功');
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
  };

  ws.onclose = () => {
    isConnected = false;
    const statusText = statusEl.querySelector('.status-text');
    if (statusText) statusText.textContent = '已断开';
    statusEl.classList.add('disconnected');
    statusEl.classList.remove('connected');
    console.log('WebSocket 连接断开，3秒后重连...');
    setTimeout(connect, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket 错误:', error);
  };
}

// 处理服务器消息
async function handleMessage(message) {
  switch (message.type) {
    case 'init':
      csvData = message.data;
      userCountEl.textContent = message.clients;
      console.log(`加载数据: ${csvData.length} 行 × ${csvData[0]?.length || 0} 列`);
      // 延迟渲染确保 DOM 已准备好
      setTimeout(() => renderTable(), 100);
      break;

    case 'update':
      // 更新数据
      if (csvData[message.row]) {
        csvData[message.row][message.col] = message.value;
        updateCell(message.row, message.col, message.value);
      }
      break;

    case 'addRow':
      // 其他客户端的添加行操作
      csvData.push(message.row);
      renderTable();
      break;

    case 'deleteRow':
      // 其他客户端的删除行操作
      csvData.splice(message.rowIndex, 1);
      renderTable();
      break;

    case 'addColumn':
      // 其他客户端的添加列操作
      csvData.forEach(row => row.push(''));
      renderTable();
      break;

    case 'reload':
      csvData = message.data;
      console.log(`重新加载数据: ${csvData.length} 行`);
      setTimeout(() => renderTable(), 100);
      break;

    case 'clients':
      userCountEl.textContent = message.count;
      break;
  }
}

// 显示加载动画
function showLoading() {
  loadingOverlay.classList.remove('hidden');
}

// 隐藏加载动画
function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// 创建表格行
function createRow(row, rowIndex) {
  const tr = document.createElement('tr');
  tr.dataset.rowIndex = rowIndex;
  tr.style.height = `${ROW_HEIGHT}px`;
  
  row.forEach((cell, colIndex) => {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.value = cell || '';
    input.dataset.row = rowIndex;
    input.dataset.col = colIndex;
    
    // 编辑事件
    input.addEventListener('focus', () => {
      td.classList.add('cell-editing');
    });
    
    input.addEventListener('blur', () => {
      td.classList.remove('cell-editing');
      const newValue = input.value;
      if (newValue !== csvData[rowIndex][colIndex]) {
        sendUpdate(rowIndex, colIndex, newValue);
      }
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      }
    });
    
    td.appendChild(input);
    
    // 添加删除按钮（除了表头）
    if (rowIndex > 0 && colIndex === 0) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '✕';
      deleteBtn.className = 'delete-row';
      deleteBtn.onclick = () => deleteRow(rowIndex);
      td.appendChild(deleteBtn);
    }
    
    tr.appendChild(td);
  });
  
  return tr;
}

// 渲染表格
function renderTable() {
  if (isRendering) return;
  isRendering = true;
  
  setTimeout(() => {
    if (csvData.length === 0) {
      tableBody.innerHTML = '';
      hideLoading();
      isRendering = false;
      return;
    }
    
    // 小数据集直接全部渲染
    if (csvData.length <= 200) {
      tableBody.innerHTML = '';
      const fragment = document.createDocumentFragment();
      csvData.forEach((row, rowIndex) => {
        fragment.appendChild(createRow(row, rowIndex));
      });
      tableBody.appendChild(fragment);
      hideLoading();
      isRendering = false;
      updateStats();
      console.log(`✓ 全部渲染: ${csvData.length} 行`);
      return;
    }
    
    // 大数据集：虚拟滚动
    const scrollTop = tableWrapper.scrollTop || 0;
    const containerHeight = tableWrapper.clientHeight || 500;
    
    // 计算可见范围
    const startRow = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleRows = Math.ceil(containerHeight / ROW_HEIGHT);
    const bufferRows = 20;
    
    const actualStart = Math.max(0, startRow - bufferRows);
    const actualEnd = Math.min(csvData.length, startRow + visibleRows + bufferRows);
    
    // 清空并重新渲染
    tableBody.innerHTML = '';
    const colCount = csvData[0]?.length || 1;
    
    // 顶部占位
    if (actualStart > 0) {
      const spacerTr = document.createElement('tr');
      const spacerTd = document.createElement('td');
      spacerTd.colSpan = colCount;
      spacerTd.style.height = `${actualStart * ROW_HEIGHT}px`;
      spacerTd.style.padding = '0';
      spacerTd.style.border = 'none';
      spacerTd.style.background = 'transparent';
      spacerTr.appendChild(spacerTd);
      tableBody.appendChild(spacerTr);
    }
    
    // 渲染可见行
    const fragment = document.createDocumentFragment();
    for (let i = actualStart; i < actualEnd; i++) {
      if (csvData[i]) {
        fragment.appendChild(createRow(csvData[i], i));
      }
    }
    tableBody.appendChild(fragment);
    
    // 底部占位
    if (actualEnd < csvData.length) {
      const spacerTr = document.createElement('tr');
      const spacerTd = document.createElement('td');
      spacerTd.colSpan = colCount;
      spacerTd.style.height = `${(csvData.length - actualEnd) * ROW_HEIGHT}px`;
      spacerTd.style.padding = '0';
      spacerTd.style.border = 'none';
      spacerTd.style.background = 'transparent';
      spacerTr.appendChild(spacerTd);
      tableBody.appendChild(spacerTr);
    }
    
    hideLoading();
    isRendering = false;
    updateStats();
    console.log(`✓ 渲染: 第 ${actualStart}-${actualEnd} 行 / 共 ${csvData.length} 行`);
  }, 0);
}

// 滚动处理
function onScroll() {
  if (!csvData.length || csvData.length <= 200) return;
  
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  
  scrollTimeout = setTimeout(() => {
    console.log('滚动位置:', tableWrapper.scrollTop);
    renderTable();
  }, 100);
}

// 初始化滚动监听
if (tableWrapper) {
  tableWrapper.addEventListener('scroll', onScroll);
  console.log('✓ 滚动监听已启用，容器高度:', tableWrapper.clientHeight);
} else {
  console.error('❌ tableWrapper 未找到');
}

// 更新单个单元格
function updateCell(row, col, value) {
  // 只在可见范围内才更新 DOM
  if (row >= visibleStart && row < visibleEnd) {
    const input = document.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
    if (input && document.activeElement !== input) {
      input.value = value;
      const td = input.parentElement;
      td.classList.add('cell-updated');
      setTimeout(() => td.classList.remove('cell-updated'), 500);
    }
  }
}

// 发送更新
function sendUpdate(row, col, value) {
  if (isConnected) {
    ws.send(JSON.stringify({
      type: 'update',
      row,
      col,
      value
    }));
  }
}

// 添加行
addRowBtn.addEventListener('click', () => {
  if (isConnected && !isRendering) {
    // 立即更新本地数据和 UI
    const newRow = new Array(csvData[0]?.length || 1).fill('');
    csvData.push(newRow);
    renderTable();
    
    // 通知服务器和其他客户端
    ws.send(JSON.stringify({ type: 'addRow' }));
  }
});

// 添加列
addColumnBtn.addEventListener('click', () => {
  if (isConnected && !isRendering) {
    // 立即更新本地数据和 UI
    csvData.forEach(row => row.push(''));
    renderTable();
    
    // 通知服务器和其他客户端
    ws.send(JSON.stringify({ type: 'addColumn' }));
  }
});

// 删除行
function deleteRow(rowIndex) {
  if (isConnected && !isRendering && confirm('确定要删除这一行吗？')) {
    // 立即更新本地数据和 UI
    csvData.splice(rowIndex, 1);
    renderTable();
    
    // 通知服务器和其他客户端
    ws.send(JSON.stringify({
      type: 'deleteRow',
      rowIndex
    }));
  }
}

// 导出 CSV
exportBtn.addEventListener('click', () => {
  const csvContent = csvData.map(row => row.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `export_${new Date().getTime()}.csv`;
  link.click();
});

// 上传 CSV 文件
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  showLoading();
  
  try {
    const text = await file.text();
    const response = await fetch('/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv'
      },
      body: text
    });

    const result = await response.json();
    if (result.success) {
      console.log('文件上传成功');
    } else {
      hideLoading();
      alert('上传失败：' + result.message);
    }
  } catch (error) {
    console.error('上传错误:', error);
    hideLoading();
    alert('上传失败，请重试');
  }

  // 清空文件选择
  fileInput.value = '';
});

// 初始化连接
connect();
