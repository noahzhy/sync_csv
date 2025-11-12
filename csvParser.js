// 正确解析 CSV，处理引号内的逗号
export function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // 转义的引号 ""
        currentCell += '"';
        i++; // 跳过下一个引号
      } else {
        // 切换引号状态
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // 字段分隔符
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      // 行分隔符
      if (char === '\r' && nextChar === '\n') {
        i++; // 跳过 \r\n 中的 \n
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      }
    } else {
      currentCell += char;
    }
  }
  
  // 处理最后一行
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  
  return rows;
}

// 将数据转换为 CSV 格式
export function toCSV(data) {
  return data.map(row => {
    return row.map(cell => {
      const cellStr = String(cell);
      // 如果包含逗号、引号或换行符，需要用引号包裹
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        // 转义引号
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',');
  }).join('\n');
}
