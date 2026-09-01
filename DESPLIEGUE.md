# Poner la app en marcha

La app está publicada en <https://agonzaleztic-source.github.io/InglesB2/>.

Hay tres formas de usarla. La primera no cuesta nada y no requiere montar nada.

---

## Opción A · Gratis, sin clave

Pulsa **«Empezar gratis, sin clave»** y ya está.

La app trae dentro (`banco.js`) los ejercicios de las 17 tareas del examen, cada
uno con su explicación al fallar y con la teoría a fondo detrás del botón
*Explícamelo mejor*. Funciona sin conexión al modelo y sin gastar un céntimo.

Lo que **no** puede hacer sin modelo:

- Generar ejercicios nuevos sin límite: el banco es finito y acaba repitiéndose.
- Corregirte el Writing y el Speaking. En su lugar te da la respuesta modelo de
  nivel B2 y una lista de comprobación con lo que miraría un examinador.
- Las micro-lecciones del *Temario*, que se escriben en el momento.

Puedes añadir una clave más adelante sin perder tu progreso.

---

## Opción B · Tu clave, en tu navegador (2 minutos)

1. Entra en <https://console.anthropic.com> → *API Keys* → crear clave.
   Cópiala: solo se ve una vez.
2. Antes de seguir, ve a *Billing* → *Limits* y ponte un **límite de gasto
   mensual**. Con 5 € vas sobrado y es la red de seguridad si algo se descontrola.
3. Abre la app y pega la clave. Ya está.

La clave se guarda en el `localStorage` de ese navegador. **No** se sube al
repositorio ni sale hacia ningún sitio que no sea la API de Anthropic.

**Cuándo NO usar esta opción:** en un ordenador compartido o público. Quien tenga
acceso al navegador puede leer la clave. Para tu portátil o tu móvil, es lo
razonable. Si algún día crees que se ha filtrado, bórrala en la consola de
Anthropic y crea otra: es gratis e inmediato.

---

## Opción C · Un Worker de Cloudflare (10 minutos)

Solo si prefieres que la clave no viva en el navegador — por ejemplo, si vas a
pasarle la URL a otra persona.

1. Entra en <https://dash.cloudflare.com> y crea una cuenta si no la tienes.
2. *Workers & Pages* → *Create* → *Start with Hello World* → *Deploy*.
3. Abre el editor del Worker, borra el contenido y pega entero `worker.js`.
   Guarda y despliega.
4. En *Settings* → *Variables and Secrets*, añade dos secretos:

   | Nombre              | Valor                                   |
   | ------------------- | --------------------------------------- |
   | `ANTHROPIC_API_KEY` | la clave del paso 1 de la opción B      |
   | `APP_PASS`          | una contraseña que te inventes          |

5. Cloudflare te da una dirección tipo `https://aptis.tu-usuario.workers.dev`.
   Pégala en la app, en el mismo campo donde iría la clave: la app distingue
   sola una cosa de la otra.

Si usas contraseña, revisa que `ALLOWED_ORIGIN` coincida exactamente con
`https://agonzaleztic-source.github.io`, sin barra final.

---

## Lo que cuesta

Esto solo aplica a las opciones B y C. El modelo es Claude Sonnet 5: 2 $ por millón de tokens de entrada y 10 $ por
millón de salida. Una sesión diaria completa consume unos 6.000 tokens de
entrada y 7.000 de salida: alrededor de **8 céntimos al día**, unos 2-3 € al mes
practicando a diario. Cloudflare, si usas la opción C, no cobra nada en este
volumen.

Precios actualizados en <https://platform.claude.com/docs/en/about-claude/pricing>.

---

## Si algo falla

La app te dice el motivo concreto en pantalla. Los mensajes más habituales:

**«La clave no es válida»** — está mal pegada, o la borraste en la consola de
Anthropic. Pulsa *cambiar conexión*, abajo a la derecha, y vuelve a pegarla.

**«Tu cuenta de Anthropic no tiene saldo»** — recarga en *Billing*.

**«Has llegado al límite de peticiones»** — espera un minuto.

**Falla solo a veces**: el modelo devolvió algo que no era JSON válido. La app ya
reintenta por su cuenta; con *Volver a intentarlo* se resuelve.

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
