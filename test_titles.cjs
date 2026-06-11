const xlsx = require('xlsx'); 
const wb = xlsx.readFile('src-tauri/data/job_titles.xlsx'); 
const ws = wb.Sheets[wb.SheetNames[0]]; 
const data = xlsx.utils.sheet_to_json(ws); 
console.log(data.filter(r => (r['العنوان الوظيفي'] || '').includes('عميد')));
