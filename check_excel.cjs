const xlsx = require('xlsx');
const workbook = xlsx.readFile('./src-tauri/data/Administrative_tab.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, {header: 1});
console.log(data.slice(0, 5));
