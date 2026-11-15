'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', 'data', 'static');
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'store', 'I_List.json'), 'utf8')).data.items;
const byCode = new Map(catalogue.filter((x) => x.shortCode).map((x) => [x.shortCode, x]));
for (const name of ['greedy', 'bullet']) {
  const pot = JSON.parse(fs.readFileSync(path.join(root, 'pots', `${name}.json`), 'utf8')).data.items;
  const banner = JSON.parse(fs.readFileSync(path.join(root, 'gacha', `banner_${name}.json`), 'utf8')).data;
  const codes = pot.map((x) => x.short_code);
  if (new Set(codes).size !== codes.length) throw new Error(`${name}: duplicate reward short_code`);
  if (banner.banner_id !== name) throw new Error(`${name}: banner_id mismatch`);
  if (JSON.stringify([...codes].sort()) !== JSON.stringify(banner.items.map((x) => x.short_code).sort())) {
    throw new Error(`${name}: banner reward table differs from pot reward table`);
  }
  if (!pot.length || pot.some((x) => !x.short_code || !['1', '2', '3', '4', '5'].includes(String(x.rarity)))) {
    throw new Error(`${name}: invalid reward entry`);
  }
  if (name === 'greedy') {
    const forbidden = pot.filter((x) => ['character', 'perk', 'profile'].includes(x.type) || /^(Hunter_|Survivor_|PP_|Profile_)/.test(x.short_code));
    if (forbidden.length) throw new Error(`greedy: forbidden reward type/code: ${forbidden.map((x) => x.short_code).join(', ')}`);
    const invalid = pot.filter((x) => !byCode.has(x.short_code) || byCode.get(x.short_code).isActive === false);
    if (invalid.length) throw new Error(`greedy: missing/inactive catalogue items: ${invalid.map((x) => x.short_code).join(', ')}`);
  }
  process.stdout.write(`${name}: ${pot.length} rewards OK\n`);
}
