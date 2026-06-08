import * as fs from 'fs';
import * as path from 'path';

const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', '20260406_schema_integrity_refactor.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const position = 870;
const start = Math.max(0, position - 100);
const end = Math.min(sql.length, position + 100);

console.log('--- SQL Content Around Position 870 ---');
console.log(sql.substring(start, end));
console.log('---------------------------------------');
