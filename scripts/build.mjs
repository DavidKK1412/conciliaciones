// Genera dist/ con:
//   - "Unificar conciliaciones.html": un solo archivo con todas las librerías incrustadas (funciona sin internet)
//   - "ExportarConciliacionesPDF.bas": la macro de Excel en Windows-1252, lista para Archivo > Importar en el editor VBA
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkgFile = (pkg, file) => readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), file), 'utf8');

const libs = {
  PDFLIB: pkgFile('pdf-lib', 'dist/pdf-lib.min.js'),
  PDFJS: pkgFile('pdfjs-dist', 'build/pdf.min.js'),
  JSZIP: pkgFile('jszip', 'dist/jszip.min.js'),
  PDFWORKER: pkgFile('pdfjs-dist', 'build/pdf.worker.min.js'),
};
for (const [name, code] of Object.entries(libs)) {
  if (/<\/script|<!--|<script/i.test(code)) throw new Error(`${name} contiene texto que rompería el <script> incrustado`);
}

const bas = readFileSync(join(root, 'src/ExportarConciliacionesPDF.bas'), 'utf8').replace(/\r\n/g, '\n');
const macroSinAtributos = bas.split('\n').filter(l => !l.startsWith('Attribute ')).join('\n').trim();
const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let html = readFileSync(join(root, 'src/index.html'), 'utf8');
const reemplazar = (marca, valor) => {
  if (!html.includes(marca)) throw new Error(`No encontré ${marca} en src/index.html`);
  html = html.replace(marca, () => valor);
};
reemplazar('<!--__MACRO__-->', escHtml(macroSinAtributos));
for (const [name, code] of Object.entries(libs)) reemplazar(`/*__${name}__*/`, code);

mkdirSync(join(root, 'dist'), {recursive: true});
writeFileSync(join(root, 'dist/Unificar conciliaciones.html'), html);
// Copia como index.html para servir la herramienta desde un hosting estático (Vercel, etc.)
writeFileSync(join(root, 'dist/index.html'), html);

// El editor de VBA lee los .bas en ANSI (Windows-1252); los caracteres usados (á, ó, ¿…) están en Latin-1
if (/[^\u0000-ÿ]/.test(bas)) throw new Error('La macro tiene caracteres fuera de Windows-1252');
writeFileSync(join(root, 'dist/ExportarConciliacionesPDF.bas'), Buffer.from(bas.replace(/\n/g, '\r\n'), 'latin1'));

console.log(`dist/Unificar conciliaciones.html (${(html.length / 1e6).toFixed(1)} MB) y dist/ExportarConciliacionesPDF.bas listos`);
