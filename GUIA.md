# Guía de instalación — Generador de Exámenes PDF

## Paso 1: Obtener la API key de Gemini (gratis)

1. Ir a https://aistudio.google.com/app/apikey
2. Iniciar sesión con una cuenta de Google
3. Hacer clic en **"Create API key"**
4. Seleccionar **"Create API key in new project"**
5. Copiar la clave generada (empieza con `AIza...`)
6. Guardarla en un lugar seguro — la vas a necesitar cada vez que uses la app

> La capa gratuita incluye 1.500 requests/día y 15 requests/minuto. Para uso personal es más que suficiente.

---

## Paso 2: Crear una cuenta en GitHub (si no tenés)

1. Ir a https://github.com
2. Hacer clic en **"Sign up"**
3. Completar el registro con email y contraseña
4. Verificar el email

---

## Paso 3: Subir los archivos a GitHub

### Opción A — Desde el navegador (más simple)

1. Ir a https://github.com/new
2. En **"Repository name"** escribir: `generador-examenes`
3. Dejar en **"Public"**
4. Tildar **"Add a README file"**
5. Hacer clic en **"Create repository"**

Ahora subir los archivos uno por uno:

6. En el repositorio, hacer clic en **"Add file" → "Upload files"**
7. Subir `index.html`
8. Hacer clic en **"Commit changes"**
9. Repetir para la carpeta `css/` → subir `style.css` (crear carpeta poniendo `css/style.css` en el nombre)
10. Repetir para cada archivo en `js/`:
    - `js/storage.js`
    - `js/pdf-extractor.js`
    - `js/api.js`
    - `js/exam.js`
    - `js/results.js`
    - `js/app.js`

### Opción B — Con GitHub Desktop (más cómodo para el futuro)

1. Descargar GitHub Desktop desde https://desktop.github.com
2. Instalar e iniciar sesión con tu cuenta de GitHub
3. Hacer clic en **"File → New repository"**
4. Nombre: `generador-examenes`, elegir carpeta local
5. Copiar todos los archivos del proyecto a esa carpeta
6. En GitHub Desktop: escribir un mensaje en "Summary" (ej: "primera versión")
7. Hacer clic en **"Commit to main"**
8. Hacer clic en **"Publish repository"** → dejar en Public → **"Publish"**

---

## Paso 4: Activar GitHub Pages

1. En tu repositorio de GitHub, hacer clic en **"Settings"** (pestaña superior)
2. En el menú izquierdo, hacer clic en **"Pages"**
3. En **"Source"**, seleccionar **"Deploy from a branch"**
4. En **"Branch"**, seleccionar **"main"** y carpeta **"/ (root)"**
5. Hacer clic en **"Save"**
6. Esperar 1-2 minutos
7. Aparecerá un mensaje verde con tu URL:
   `https://TU_USUARIO.github.io/generador-examenes`

---

## Paso 5: Usar la aplicación

1. Abrir la URL de GitHub Pages en tu navegador
2. Ingresar tu API key de Gemini (se guarda automáticamente en el dispositivo)
3. Subir un PDF
4. Elegir cantidad de preguntas y tiempo
5. Hacer clic en **"Generar examen"**

---

## Preguntas frecuentes

**¿La API key es segura?**
La clave se guarda solo en tu navegador (localStorage). No se envía a ningún servidor propio. Las llamadas van directamente desde tu navegador a la API de Google.

**¿Funciona con cualquier PDF?**
Funciona con PDFs que tengan texto real (la mayoría). PDFs escaneados (solo imágenes) no tienen capa de texto extraíble.

**¿Qué pasa si supero el límite gratuito?**
Google devuelve un error 429. La app lo muestra y podés intentar en el día siguiente.

**¿Cómo actualizar la app en el futuro?**
Reemplazá los archivos en GitHub (Upload files → arrastrá el archivo modificado). Los cambios se publican en 1-2 minutos.

**¿Puedo usarlo desde el celular?**
Sí, la interfaz es responsive. Funciona en cualquier navegador moderno.
