# Poner la app en marcha

La app está publicada en <https://agonzaleztic-source.github.io/InglesB2/>.

Hay tres formas de usarla. La primera no cuesta nada y no requiere montar nada.

---

## Opción A · Gratis, sin clave

Pulsa **«Empezar gratis, sin clave»** y ya está.

La app trae dentro (`banco.js`) ejercicios de las 17 tareas del examen, cada
uno con su explicación al fallar y con la teoría a fondo detrás del botón
*Explícamelo mejor*: 47 preguntas de gramática, dos o tres textos por parte de
Reading y tres ejercicios por cada parte de Listening, Writing y Speaking.
Funciona sin conexión al modelo y sin gastar un céntimo.

Además funciona **sin conexión a internet**: la primera vez que abres la app,
un *service worker* (`sw.js`) guarda en el navegador la página, el banco y las
librerías de `vendor/`. A partir de ahí puedes abrirla en el metro o en un
avión y el modo gratuito sigue funcionando. Las actualizaciones se descargan
en segundo plano y se ven en la siguiente carga.

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

Solo si prefieres que la clave no viva en el navegador de tu propio dispositivo
(por ejemplo, para usar la misma URL desde el móvil y el ordenador).

Este proyecto es de aprendizaje personal, no un servicio para repartir: no
compartas la URL de tu Worker ni la contraseña con otras personas, porque sus
peticiones gastarían tu saldo de la API y pasarían por tu cuenta de Anthropic.
Si alguien más quiere usar la app, que despliegue su propio Worker con su
propia clave — es el mismo proceso descrito aquí.

1. Entra en <https://dash.cloudflare.com> y crea una cuenta si no la tienes.
2. *Workers & Pages* → *Create* → *Start with Hello World* → *Deploy*.
3. Abre el editor del Worker, borra el contenido y pega entero `worker.js`.
   Guarda y despliega.
4. Crea el KV que lleva la cuenta de peticiones por día: *Storage & Databases*
   → *KV* → *Create namespace* (por ejemplo `aptis-rate-limit`). Vuelve al
   Worker, pestaña *Settings* → *Bindings* → *Add binding* → *KV Namespace*,
   y ponle el nombre de variable `RATE_LIMIT` apuntando a ese namespace.
   Sin este paso el Worker responde error 500 a todo.
5. En *Settings* → *Variables and Secrets*, añade los secretos:

   | Nombre              | Valor                                            |
   | ------------------- | ------------------------------------------------- |
   | `ANTHROPIC_API_KEY` | la clave del paso 1 de la opción B                |
   | `APP_PASS`          | una contraseña que te inventes (obligatoria)      |
   | `DAILY_LIMIT`       | opcional: peticiones por IP y día (60 por defecto)|
   | `GLOBAL_DAILY_LIMIT`| opcional: tope total al día entre todos (1500)    |

   Hace falta al menos uno de `APP_PASS` (contraseña única, uso personal) o
   `ADMIN_SECRET` (cuentas de usuario, ver más abajo). Sin ninguno, el Worker
   rechaza toda petición.
6. Cloudflare te da una dirección tipo `https://aptis.tu-usuario.workers.dev`.
   Pégala en la app, en el campo de conexión; al detectar que es una URL
   aparece un segundo campo para la contraseña que pusiste en `APP_PASS`.

Revisa que `ALLOWED_ORIGIN` coincida exactamente con
`https://agonzaleztic-source.github.io`, sin barra final: el Worker rechaza
cualquier petición sin esa cabecera `Origin` exacta, venga o no de un
navegador.

Si en vez de la dirección `*.workers.dev` le pones un dominio propio al
Worker, añade ese dominio a `connect-src` en la etiqueta `<meta>` de CSP al
principio de `index.html`: si no, el navegador bloqueará la petición.

---

## Cuentas de usuario y cupo mensual (para dar acceso a otras personas)

Con el secreto `ADMIN_SECRET` el Worker gestiona usuarios. Cada uno recibe un
código personal `apt_...` que pega en el campo de contraseña de la app, y tiene
un cupo de correcciones al mes (300 por defecto, `DEFAULT_MONTHLY_QUOTA`). El
KV solo guarda el hash del código y el cupo se cuenta por email.

```sh
# Alta: devuelve el código UNA sola vez
curl -X POST https://TU-WORKER/admin/users/create \n  -H "x-admin-secret: $ADMIN_SECRET" -H "content-type: application/json" \n  -d '{"email":"alumno@correo.com","plan":"pro","monthly_quota":300}'

# Baja / alta, o cambio de cupo (no toca su código)
curl -X POST https://TU-WORKER/admin/users/update -H "x-admin-secret: $ADMIN_SECRET" \n  -H "content-type: application/json" -d '{"email":"alumno@correo.com","disabled":true}'

# Código perdido o filtrado: invalida el viejo y emite uno nuevo
curl -X POST https://TU-WORKER/admin/users/reset -H "x-admin-secret: $ADMIN_SECRET" \n  -H "content-type: application/json" -d '{"email":"alumno@correo.com"}'
```

El usuario puede consultar su cupo con un POST a `/me` (devuelve `plan`, `quota`
y `used`). `GLOBAL_DAILY_LIMIT` sigue siendo el tope de gasto de todos juntos.
Si una petición falla por un error del modelo (5xx), no se descuenta del cupo.

---

## Cobrar con Stripe (altas automáticas)

El Worker recibe los avisos de Stripe en `/webhooks/stripe` y hace solo lo que
antes hacías con `curl`: al pagar crea la cuenta y envía el código por email;
al renovarse la mantiene activa; al cancelar o no pagar la da de baja. Si el
cliente se vuelve a suscribir recibe un código nuevo y conserva su cupo.

1. En Stripe crea un producto con precio recurrente (mensual) y un *Payment Link*
   o Checkout para él. Es el enlace que pondrás en la web para pagar.
2. *Developers* → *Webhooks* → *Add endpoint*, con la dirección
   `https://TU-WORKER/webhooks/stripe` y estos eventos:
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` e `invoice.paid`. Copia el *Signing secret*
   (`whsec_...`).
3. Crea una cuenta en <https://resend.com>, verifica tu dominio de envío y saca
   una clave de API.
4. En el Worker, añade los secretos y variables:

   | Nombre                  | Valor                                                  |
   | ----------------------- | ------------------------------------------------------ |
   | `STRIPE_WEBHOOK_SECRET` | el `whsec_...` del paso 2                              |
   | `RESEND_API_KEY`        | la clave del paso 3                                    |
   | `EMAIL_FROM`            | remitente verificado, p. ej. `Aptis B2 <hola@tudominio.com>` |
   | `APP_URL`               | opcional: dirección de la app que sale en el email     |

5. Prueba con las tarjetas de test de Stripe en modo prueba antes de pasar a real.

Detalles que conviene saber:

- La firma del webhook se comprueba antes de mirar el contenido, con un margen
  de 5 minutos: sin ella no se da de alta a nadie.
- Si falla el envío del email, el Worker deshace el alta y responde 500 para que
  Stripe lo reintente durante días. Un código que nadie ha recibido no sirve.
- Cada evento se procesa una sola vez aunque Stripe lo reenvíe, y un evento más
  antiguo que el último aplicado no puede reactivar a quien ya se dio de baja.
- El cupo es el de `DEFAULT_MONTHLY_QUOTA`; cámbialo por usuario con
  `/admin/users/update` si hace falta.
- La cuenta se identifica por el email que se escribe al pagar.
- Los códigos perdidos se reemiten con `/admin/users/reset`; ese endpoint
  devuelve el código y tienes que enviárselo tú.
- No hay portal de cliente: para que se den de baja solos, activa el *Customer
  portal* de Stripe y enlázalo desde la web.

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

**«Se ha llegado al límite diario de peticiones desde tu conexión»** — solo con
la opción C: el Worker corta a las `DAILY_LIMIT` peticiones diarias por IP.
Vuelve mañana, o sube el valor de `DAILY_LIMIT` en el Worker.

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
cuenta. En el móvil y en el ordenador tendrás progresos separados.

Para llevarlo de un dispositivo a otro, o para tener una copia antes de vaciar
la caché, en la pantalla de inicio de la app están los botones **Exportar
progreso** (descarga un JSON) e **Importar progreso** (lo restaura; sustituye lo
que hubiera en ese dispositivo).

## Actualizar las librerías

React y Babel no se cargan de un CDN sino de `vendor/`, con su hash de
integridad en `index.html`. Si algún día subes de versión, hay que hacer tres
cosas: sustituir los ficheros de `vendor/`, recalcular los hashes
(`openssl dgst -sha384 -binary fichero.js | openssl base64 -A`) y cambiar la
constante `VERSION` de `sw.js` para que los navegadores tiren la caché antigua.
