# Notas para trabajar en este repo

- Usuaria final: contadora, en un PC corporativo con Windows y Edge/Chrome. No puede instalar software y puede que no tenga internet: el entregable siempre es **un solo HTML autocontenido** (`dist/Unificar conciliaciones.html`). No agregues CDNs, fuentes externas ni llamadas de red. Los documentos bancarios nunca deben salir del navegador.
- La UI y los textos van en español de Colombia.
- Toda la lógica está en `src/index.html` (script principal al final). `scripts/build.mjs` incrusta las librerías y la macro. No edites `dist/`, que se genera.
- La clasificación es por nombre de archivo (`MM_XXXX`, `AUX MM_XXXX`, `EXT MM_XXXX`, últimos 4 dígitos = cuenta), no por contenido. Ver `clasificar()`.
- La revisión de saldos usa las etiquetas de `CONFIG`. Si la usuaria reporta "No ubiqué el saldo en el formato", lo normal es agregar la etiqueta real de su formato allí.
- La macro `src/ExportarConciliacionesPDF.bas` debe quedar dentro de Windows-1252 (el build falla si no).
- Antes de commitear corre `npm test`. Si cambias el comportamiento, actualiza `ESPERADO` en `tests/e2e.mjs` y, si hace falta, los ejemplos en `tests/fixtures/`.
