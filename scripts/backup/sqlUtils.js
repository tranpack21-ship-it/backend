/** Escapa valores para INSERT SQL compatible con MySQL 8. */
export const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`;
  }

  const str = String(value);
  return `'${str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}'`;
};

export const quoteIdentifier = (name) => `\`${String(name).replace(/`/g, '``')}\``;

export const buildInsertStatements = (tableName, rows, chunkSize = 100) => {
  if (!rows.length) return '';

  const quotedTable = quoteIdentifier(tableName);
  const columns = Object.keys(rows[0]);
  const columnList = columns.map(quoteIdentifier).join(', ');
  const statements = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk
      .map((row) => {
        const vals = columns.map((col) => escapeSqlValue(row[col]));
        return `(${vals.join(', ')})`;
      })
      .join(',\n  ');

    statements.push(
      `INSERT INTO ${quotedTable} (${columnList}) VALUES\n  ${values};`
    );
  }

  return `${statements.join('\n')}\n`;
};

export const buildBackupHeader = ({ database, method, tableCount }) => `-- ============================================================
-- Tran-Pack Database Backup
-- Database: ${database}
-- Method: ${method}
-- Created: ${new Date().toISOString()}
-- Tables: ${tableCount}
-- Format: tran-pack-sql-v1
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
`;

export const buildTableSection = (tableName, createSql, insertSql) => {
  const quoted = quoteIdentifier(tableName);
  return `
-- @table-start:${tableName}
DROP TABLE IF EXISTS ${quoted};
${createSql};

${insertSql}-- @table-end:${tableName}
`;
};

export const parseTableSections = (sql) => {
  const sections = [];
  const regex = /-- @table-start:(\w+)\s*([\s\S]*?)-- @table-end:\1/g;
  let match;

  while ((match = regex.exec(sql)) !== null) {
    sections.push({
      table: match[1],
      sql: match[2].trim(),
    });
  }

  return sections;
};
