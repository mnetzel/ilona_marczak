import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('dist');
const base = '/ilona_marczak';
const records = ['india','west'].flatMap(name=>JSON.parse(fs.readFileSync(`research/${name}.json`,'utf8')));
assert.equal(records.length,50,'Raport musi zawierać 50 źródeł');
assert.equal(new Set(records.map(e=>e.id)).size,50,'ID muszą być unikalne');
assert.equal(new Set(records.map(e=>new URL(e.url).hostname.replace(/^www\./,''))).size,50,'Domeny źródeł muszą być różne');
for (const region of ['Indie','Zachód']) assert.equal(records.filter(e=>e.region===region).length,25,`${region}: wymagane 25 witryn`);
for (const record of records) {
  for (const field of ['id','name','url','country','type','traditionEvidence','contentPL','designPL','takeawayPL','evidenceMethod','checkedDate']) assert.ok(record[field],`Brak ${field}: ${record.id}`);
  assert.ok(record.pagesReviewed.length>0 && record.sections.length>0,`Niepełne źródło ${record.id}`);
}
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
const pages = walk(root).filter(p=>p.endsWith('.html'));
let links = 0;
for(const file of pages){
  const html = fs.readFileSync(file,'utf8');
  assert.match(html,/<html[^>]+lang="pl"/,`Brak języka: ${file}`);
  assert.match(html,/<title>.+?<\/title>/,`Brak tytułu: ${file}`);
  assert.match(html,/id="main"/,`Brak treści głównej: ${file}`);
  for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
    const raw=match[1].replaceAll('&amp;','&');
    if(/^(https?:|mailto:|data:|tel:)/.test(raw))continue;
    let [url,fragment]=raw.split('#');
    url=(url||'').split('?')[0];
    let target;
    if(!url) target=file;
    else if(url.startsWith(base+'/')) target=path.join(root,decodeURIComponent(url.slice(base.length)));
    else if(url===base) target=path.join(root,'index.html');
    else if(url.startsWith('/')) throw new Error(`Link poza bazą Pages: ${raw} (${file})`);
    else target=path.resolve(path.dirname(file),decodeURIComponent(url));
    if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
    assert.ok(fs.existsSync(target),`Uszkodzony link ${raw} w ${file}`);
    if(fragment && target.endsWith('.html')){
      const targetHtml=fs.readFileSync(target,'utf8');
      assert.ok(targetHtml.includes(`id="${decodeURIComponent(fragment)}"`),`Nieistniejąca kotwica ${raw} w ${file}`);
    }
    links++;
  }
}
assert.ok(fs.statSync('dist/images/hero.webp').size<250000,'Zbyt duży obraz hero');
assert.equal((fs.readFileSync('dist/raport/index.html','utf8').match(/class="report-entry"/g)||[]).length,50,'Raport nie renderuje 50 rekordów');
console.log(`OK: ${pages.length} stron HTML, ${links} odnośników lokalnych, 50 unikalnych witryn, baza GitHub Pages i obraz WebP.`);
