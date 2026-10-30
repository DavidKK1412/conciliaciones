// Prueba de punta a punta: abre el HTML generado en Chromium, carga tests/fixtures/07 y revisa el resultado.
// Se prueba de dos formas: abriendo el archivo con doble clic (file://) y servido por HTTP (como en Vercel).
import {chromium} from 'playwright';
import {readdirSync, mkdtempSync, readFileSync, existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {join, dirname, normalize} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
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

async function probar(browser, url, modo) {
  const check = (cond, msg) => { if (!cond) fallas.push(`[${modo}] ${msg}`); };
  const page = await browser.newPage({acceptDownloads: true});
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('dialog', d => d.accept('1234'));

  await page.goto(url);
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
    if (!e) { check(false, `Cuenta inesperada ${f.cuenta}`); continue; }
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
  await page.close();
  return `${filas.length} cuentas, ${nombres.length} PDF`;
}

// Servidor estático mínimo sobre dist/ (equivalente a lo que publica Vercel)
const server = createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const archivo = normalize(join(dist, ruta === '/' ? 'index.html' : ruta));
  if (!archivo.startsWith(dist) || !existsSync(archivo)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'content-type': archivo.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'});
  res.end(readFileSync(archivo));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const resumen = [];
try {
  resumen.push('archivo: ' + await probar(browser, pathToFileURL(join(dist, 'Unificar conciliaciones.html')).href, 'archivo'));
  resumen.push('http: ' + await probar(browser, base + '/', 'http'));

  // La plantilla sin compilar debe mostrar un aviso claro en vez de fallar en silencio
  const page = await browser.newPage();
  await page.goto(pathToFileURL(join(root, 'src/index.html')).href);
  const aviso = await page.textContent('body');
  if (!aviso.includes('Esta página no está compilada')) fallas.push('[plantilla] No muestra el aviso de página sin compilar');
  await page.close();
} finally {
  await browser.close();
  server.close();
}

if (fallas.length) { console.error('FALLÓ:\n - ' + fallas.join('\n - ')); process.exit(1); }
console.log('OK → ' + resumen.join(' · ') + ' · aviso de plantilla sin compilar');
