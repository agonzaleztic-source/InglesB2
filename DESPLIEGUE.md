# Poner la app en marcha en agonzaleztic-source.github.io/InglesB2

La app genera cada ejercicio en el momento, así que necesita hablar con la API de
Anthropic. La clave de la API **no puede ir dentro de `index.html`**: GitHub Pages
sirve el código en abierto y cualquiera podría leerla y gastar tu saldo.

La solución son dos piezas:

- **`index.html`** — se sube a tu repositorio, como ahora.
- **`worker.js`** — un intermediario de 60 líneas alojado en Cloudflare, gratis,
  que es el único sitio donde vive la clave.

---

## 1. Consigue una clave de la API

En <https://console.anthropic.com> → *API Keys* → crear clave. Cópiala, solo se
ve una vez.

Antes de seguir, entra en *Billing* → *Limits* y ponte un **límite de gasto
mensual** (5 € basta de sobra). Es la red de seguridad por si algo se descontrola.

## 2. Publica el Worker

1. Entra en <https://dash.cloudflare.com> y crea una cuenta si no la tienes.
2. *Workers & Pages* → *Create* → *Start with Hello World* → *Deploy*.
3. Abre el editor del Worker, borra el contenido y pega entero `worker.js`.
   Guarda y despliega.
4. En *Settings* → *Variables and Secrets*, añade dos secretos:

   | Nombre              | Valor                                   |
   | ------------------- | --------------------------------------- |
   | `ANTHROPIC_API_KEY` | la clave del paso 1                     |
   | `APP_PASS`          | una contraseña que te inventes          |

   `APP_PASS` es opcional pero conviene: tu Worker es una dirección pública y,
   sin ella, quien la descubra puede usar tu saldo. Con contraseña, no.

5. Apunta la dirección que te da Cloudflare. Será algo como
   `https://aptis.tu-usuario.workers.dev`.

## 3. Sube la app

Sustituye el `index.html` del repositorio por el nuevo y haz push. GitHub Pages
lo publica solo en un minuto.

## 4. Conecta las dos piezas

Abre <https://agonzaleztic-source.github.io/InglesB2/>. La primera vez te pedirá
la dirección del Worker y la contraseña. Se guardan en tu navegador, no en el
repositorio. Si te equivocas, el botón *cambiar conexión* de abajo a la derecha
lo reinicia.

---

## Lo que cuesta

Claude Sonnet 5 son 2 $ por millón de tokens de entrada y 10 $ por millón de
salida. Una sesión diaria completa consume unos 6.000 tokens de entrada y 7.000
de salida: alrededor de **8 céntimos al día**, unos 2-3 € al mes si practicas a
diario. Cloudflare no cobra nada en este volumen.

Precios actualizados en <https://platform.claude.com/docs/en/about-claude/pricing>.

## Si algo falla

**«No he podido preparar el ejercicio»** en todos los ejercicios: el Worker no
responde. Ábrelo en el navegador; si dice *Solo se admite POST*, está vivo y el
problema es la contraseña o el origen. Revisa que `ALLOWED_ORIGIN` coincida
exactamente con `https://agonzaleztic-source.github.io`, sin barra final.

**Falla solo a veces**: el modelo devolvió algo que no era JSON válido. La app ya
reintenta una vez por su cuenta; con el botón *Volver a intentarlo* se resuelve.

**El listening no suena**: la voz la pone el navegador. Chrome y Edge de
escritorio van bien; en algunos móviles hay que tocar la pantalla antes de que
deje sonar el audio.

**El speaking no transcribe**: el reconocimiento de voz solo va en Chrome y Edge.
En los demás navegadores la app te deja escribir lo que has dicho y lo corrige
igual.

## Los datos

Todo tu progreso vive en el `localStorage` de tu navegador: no hay servidor ni
cuenta. Si cambias de dispositivo o vacías la caché, empiezas de cero. En el
móvil y en el ordenador tendrás progresos separados.
