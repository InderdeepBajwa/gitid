import chalk from 'chalk';

export function formatTable(data: Record<string, any>[]): string {
  if (data.length === 0) return '';
  
  const keys = Object.keys(data[0]!);
  const columnWidths: Record<string, number> = {};
  
  // Calculate column widths
  keys.forEach(key => {
    columnWidths[key] = Math.max(
      key.length,
      ...data.map(row => String(row[key] || '').length)
    );
  });
  
  // Build header
  const header = keys.map(key => 
    chalk.bold(key.padEnd(columnWidths[key]!))
  ).join('  ');
  
  const separator = keys.map(key => 
    '─'.repeat(columnWidths[key]!)
  ).join('──');
  
  // Build rows
  const rows = data.map(row =>
    keys.map(key => 
      String(row[key] || '-').padEnd(columnWidths[key]!)
    ).join('  ')
  );
  
  return [header, separator, ...rows].join('\n');
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function formatList(items: string[], indent: number = 2): string {
  const prefix = ' '.repeat(indent);
  return items.map(item => `${prefix}• ${item}`).join('\n');
}

export function formatKeyValue(
  data: Record<string, any>,
  indent: number = 0
): string {
  const prefix = ' '.repeat(indent);
  return Object.entries(data)
    .map(([key, value]) => {
      if (value === null || value === undefined) {
        return `${prefix}${key}: ${chalk.dim('-')}`;
      }
      if (typeof value === 'boolean') {
        return `${prefix}${key}: ${value ? chalk.green('Yes') : chalk.red('No')}`;
      }
      if (typeof value === 'object') {
        return `${prefix}${key}:\n${formatKeyValue(value, indent + 2)}`;
      }
      return `${prefix}${key}: ${value}`;
    })
    .join('\n');
}

export function wrapText(text: string, maxWidth: number = 80): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length > maxWidth) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  
  if (currentLine) lines.push(currentLine.trim());
  return lines.join('\n');
}