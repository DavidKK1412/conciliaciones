# Unificar conciliaciones

Herramienta para las conciliaciones bancarias del mes: por cada cuenta, une en un solo PDF el **formato de conciliación**, el **libro auxiliar** y el **extracto**, y revisa que los saldos cuadren.

Es **un solo archivo HTML**: se abre con doble clic en Edge o Chrome, funciona sin internet y sin instalar nada (pensado para PC corporativo). Los documentos no salen del computador.

## Cómo se usa

1. **Formatos en PDF (Excel).** Importa la macro `ExportarConciliacionesPDF.bas` en el libro de conciliaciones (Alt+F11 → Archivo → Importar archivo) o cópiala desde la herramienta. Al ejecutarla guarda cada hoja `_XXXX` como `MM_XXXX.pdf`.
2. **Abre `Unificar conciliaciones.html`** y elige la carpeta del mes.
3. **Revisa la tabla**: cuentas listas, incompletas o con saldos por revisar. Con **Ver** se abre el PDF unido.
4. **Guarda** todo en una carpeta o descarga un ZIP.

Descarga la última versión desde [Releases](../../releases), o desde los artefactos de la última ejecución de CI.

## Nombres de archivo que reconoce

| Documento | Nombre | Ejemplo |
|---|---|---|
| Formato de conciliación | `MM_XXXX.pdf` | `07_0123.pdf` |
| Libro auxiliar | `AUX MM_XXXX.pdf` | `AUX 07_0123.pdf` |
| Extracto | `EXT MM_XXXX.pdf` | `EXT 07_0123.pdf`, `EXT 07_01125.pdf` |

La cuenta se identifica por los **últimos 4 dígitos** del número del nombre, así que da igual si el extracto trae más dígitos. Los archivos que no son PDF (Excel, etc.) se ignoran, y los PDF con otro nombre aparecen como "no reconocidos".

## Revisión de saldos

- Del formato se toman dos valores: el que está junto a "Saldo según libros" (o "contabilidad"/"auxiliar") y el que está junto a "Saldo extracto". Las etiquetas están en `CONFIG`, al inicio del `<script>` principal de `src/index.html`.
- Luego se comprueba que el saldo de libros aparezca en el auxiliar y que el del extracto aparezca en el extracto. Da igual el formato del número (`1.582.201,32` o `1,582,201.32`).
- Si un documento es un escaneo sin texto, o si no se encuentra la etiqueta en el formato, la herramienta lo dice en vez de adivinar. Esta revisión es una ayuda: no reemplaza mirar el PDF.
- Los extractos con contraseña se pueden unir: la herramienta pide la clave y agrega esas páginas como imagen.

## Desarrollo

```bash
npm install
npm run build   # genera dist/Unificar conciliaciones.html y dist/ExportarConciliacionesPDF.bas
npm test        # build + prueba en Chromium con los ejemplos de tests/fixtures/07
```

- `src/index.html`: la interfaz y toda la lógica. Las librerías (pdf-lib, pdf.js, JSZip) se incrustan en el build, en los marcadores `/*__PDFLIB__*/`, etc.
- `src/ExportarConciliacionesPDF.bas`: la macro de Excel. Se muestra dentro del HTML y se exporta en Windows-1252 para que el editor de VBA la importe con tildes correctas.
- `tests/fixtures/07/`: documentos inventados (Fundación Ejemplo) que cubren una cuenta que cuadra, un saldo que no cuadra, un extracto con contraseña (`1234`), una cuenta incompleta y un archivo no reconocido. Se regeneran con `python3 generar_ejemplos.py` desde `tests/fixtures/` (requiere `reportlab`, `pypdf` y `openpyxl`).

Para publicar una versión: `git tag v1.0.0 && git push --tags`. La CI adjunta los dos archivos al release.
