# Insumos de limpieza

App web para celular: entregas de insumos al personal, ingresos de proveedores y stock.
La página está en GitHub Pages y los datos se guardan en una planilla de Google Sheets.

## 1. Planilla de Google (una sola vez)
1. Entrá a sheets.google.com y creá una planilla nueva (por ejemplo "Insumos de limpieza").
2. Menú **Extensiones > Apps Script**. Borrá todo lo que aparece y pegá el contenido de `apps-script.gs`.
3. Cambiá la línea `const CLAVE = "limpieza2026";` por la clave que quieras. Guardá (ícono de disquete).
4. Arriba, en el desplegable de funciones, elegí **inicializar** y tocá **Ejecutar**.
   Google te pide permisos: "Revisar permisos" > tu cuenta > "Configuración avanzada" > "Ir a ... (no seguro)" > Permitir.
   Esto crea las hojas Entregas, Ingresos y Listas y carga los dos remitos del 13/10.
5. **Implementar > Nueva implementación** > engranaje > **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   Tocá Implementar y copiá la **URL de la aplicación web** (termina en `/exec`).

## 2. Conectar la página
Abrí `index.html` con cualquier editor de texto (o directamente en GitHub con el lápiz) y reemplazá
`PEGAR_ACA_LA_URL_DE_APPS_SCRIPT` por la URL que copiaste.

## 3. Subir a GitHub Pages
1. En github.com: **New repository** > nombre `insumos` > **Public** > Create.
2. **Add file > Upload files** y subí: `index.html`, `manifest.webmanifest`, `icon-180.png`, `icon-192.png`, `icon-512.png`. Commit.
   (`apps-script.gs` y este README no hacen falta en el repositorio.)
3. **Settings > Pages** > Source: **Deploy from a branch** > Branch: `main` / `(root)` > Save.
4. En 1–2 minutos la app queda en `https://TU-USUARIO.github.io/insumos/`.

## 4. En los celulares
- Abrir el link, poner la clave una vez (queda guardada en ese celular).
- Android (Chrome): menú ⋮ > **Agregar a la pantalla principal** / **Instalar app**.
- iPhone (Safari): botón compartir > **Agregar a inicio**.
Queda con ícono propio y se abre a pantalla completa, como una app.

## Si cambiás el código de Apps Script
Implementar > **Administrar implementaciones** > lápiz > Versión: **Nueva versión** > Implementar.
Así la URL no cambia.
