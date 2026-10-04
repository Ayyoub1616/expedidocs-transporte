# ExpediDocs Transporte

Aplicación web estática para gestionar expediciones, catálogos y generar un documento de control de transporte imprimible, inspirada en las estructuras del Excel original. URL prevista: https://ayyoub1616.github.io/expedidocs-transporte/

## Funciones
- Panel con número de expediciones, palets, expediciones del día y destinos distintos.
- Expediciones: alta, edición, búsqueda y eliminación, evitando referencias duplicadas.
- Destinos y transportistas editables.
- Generar documento de transporte con diseño para imprimir o guardar como PDF desde el navegador.
- Copia de seguridad JSON, restauración validada y exportación CSV.
- Adaptada a móvil / soporte de instalación web (manifest).

## ATENCIÓN: almacenamiento y privacidad
Esta es una **versión local / individual**. Los datos se guardan solo en `localStorage` del navegador del dispositivo. No hay sincronización, cuentas, copias de seguridad automáticas ni control de accesos. No uses ordenadores compartidos para guardar nombres, DNI, teléfonos u otros datos personales. Se recomienda exportar una copia JSON periódicamente a almacenamiento protegido. El repositorio público no contiene registros, conductores ni teléfonos del Excel original.

## Publicación
1. En Settings → Pages → Build and deployment selecciona **GitHub Actions**.
2. Ve a Actions → Deploy GitHub Pages → Run workflow (o realiza un push a main).
3. La web estará disponible en https://ayyoub1616.github.io/expedidocs-transporte/

## Alcance y migración posterior
La lógica de macros VBA, formularios exactos por plantilla de destino y funcionalidades de emisión oficiales necesitan validación operativa antes de sustituir totalmente el libro original. El documento web es un borrador de control imprimible y no equivale a una reproducción pixel a pixel del CMR del Excel. Para multiusuario se recomienda Supabase con autenticación, políticas RLS, auditoría, backups y un entorno privado. GitHub Pages solo aloja interfaz estática y no debe alojar secretos.

## Desarrollo
Sin dependencias ni compilación: `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`.
