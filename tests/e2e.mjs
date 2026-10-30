// Prueba de punta a punta: abre el HTML generado en Chromium, carga tests/fixtures/07 y revisa el resultado.
import {chromium} from 'playwright';
import {readdirSync, mkdtempSync, readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'tests/fixtures/07');

// Lo que debe salir con los archivos de ejemplo (ver tests/fixtures/generar_ejemplos.py)
const ESPERADO = {
  '0123': {estado: 'Lista', libros: 'Coincide', ext: 'Coincide', paginas: 3},
  '0352': {estado: 'Revisar saldos', libros: 'Coincide', ext: 'Diferente', paginas: 3},
  '1125': {estado: 'Lista', libros: 'Coincide', ext: 'Coincide', paginas: 4}, // extracto con contraseña 1234, 2 páginas
  '1146': {estado: 'Incompleta', paginas: null},
  '1651': {estado: 'Lista', libros: 'Coincide', ext: 'Coincide', paginas: 3},
};

const fallas = [];
const check = (cond, msg) => { if (!cond) fallas.push(msg); };

const browser = await chromium.launch();
const page = await browser.newPage({acceptDownloads: true});
const errores = [];
page.on('pageerror', e => errores.push(e.message));
page.on('dialog', d => d.accept('1234'));

await page.goto(pathToFileURL(join(root, 'dist/Unificar conciliaciones.html')).href);
await page.setInputFiles('#filesInput', readdirSync(fixtures).map(f => join(fixtures, f)));
await page.waitForFunction(() => {
  const filas = document.querySelectorAll('#tbody tr');
  return filas.length && ![...filas].some(f => f.innerText.includes('Procesando'));
}, null, {timeout: 60000});

const filas = await page.$$eval('#tbody tr', trs => trs.map(tr => {
  const td = [...tr.querySelectorAll('td')].map(c => c.innerText.trim());
  return {cuenta: td[0].split('\n')[0], libros: td[4], ext: td[5], estado: td[6]};
}));

check(filas.length === Object.keys(ESPERADO).length, `Esperaba ${Object.keys(ESPERADO).length} cuentas, salieron ${filas.length}`);
for (const f of filas) {
  const e = ESPERADO[f.cuenta];
  if (!e) { fallas.push(`Cuenta inesperada ${f.cuenta}`); continue; }
  check(f.estado.startsWith(e.estado), `${f.cuenta}: estado "${f.estado.split('\n')[0]}" ≠ "${e.estado}"`);
  if (e.libros) check(f.libros.startsWith(e.libros), `${f.cuenta}: saldo libros "${f.libros}" ≠ "${e.libros}"`);
  if (e.ext) check(f.ext.startsWith(e.ext), `${f.cuenta}: saldo extracto "${f.ext}" ≠ "${e.ext}"`);
}
const desconocidos = await page.$eval('#unknown', el => el.innerText);
check(desconocidos.includes('notas varias.pdf'), 'No reportó "notas varias.pdf" como no reconocido');
check(desconocidos.includes('1 archivos que no son PDF'), 'No reportó el Excel como ignorado');

// ZIP: un PDF por cuenta completa, con las páginas en el orden formato → auxiliar → extracto
const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#saveZip')]);
const zipPath = join(mkdtempSync(join(tmpdir(), 'conc-')), 'out.zip');
await descarga.saveAs(zipPath);
const zip = await JSZip.loadAsync(readFileSync(zipPath));
const nombres = Object.keys(zip.files).sort();
const listas = Object.entries(ESPERADO).filter(([, e]) => e.paginas).map(([c]) => `07_${c} CONCILIACION UNIFICADA.pdf`).sort();
check(JSON.stringify(nombres) === JSON.stringify(listas), `ZIP trae ${nombres.join(', ')}`);
for (const n of nombres) {
  const pdf = await PDFDocument.load(await zip.file(n).async('uint8array'));
  const cuenta = n.slice(3, 7);
  check(pdf.getPageCount() === ESPERADO[cuenta].paginas, `${n}: ${pdf.getPageCount()} páginas, esperaba ${ESPERADO[cuenta].paginas}`);
}

check(!errores.length, 'Errores de JavaScript: ' + errores.join(' | '));
await browser.close();

if (fallas.length) { console.error('FALLÓ:\n - ' + fallas.join('\n - ')); process.exit(1); }
console.log(`OK: ${filas.length} cuentas y ${nombres.length} PDF unificados como se esperaba`);
