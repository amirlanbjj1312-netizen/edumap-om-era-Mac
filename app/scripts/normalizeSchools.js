const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '../assets/data/schools.json');
const outputPath = path.resolve(__dirname, '../assets/data/schools.normalized.json');

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

const normalizeValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    // remove trailing .0 from numbers that came through Excel
    const asString = value.toString();
    return asString.endsWith('.0')
      ? asString.slice(0, -2)
      : asString;
  }
  return String(value).trim();
};

const normalized = raw.map((item, index) => {
  const id = Number(item['Column1.id']);
  return {
    id: Number.isNaN(id) ? index + 1 : id,
    number: normalizeValue(item['Column1.school_number']),
    type: normalizeValue(item['Column1.school_type']),
    address: normalizeValue(item['Column1.school_address']),
    name: normalizeValue(item['Column1.school_name']),
    region: normalizeValue(item['Column1.name_region']),
  };
});

fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2), 'utf-8');
console.log(`Normalized ${normalized.length} schools → ${outputPath}`);
