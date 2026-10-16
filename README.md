# Aptis General · B2 — Entrenamiento diario

App de práctica diaria para el examen Aptis General, nivel B2, publicada en
<https://agonzaleztic-source.github.io/InglesB2/>.

Para ponerla en marcha (con o sin clave de la API), ver [DESPLIEGUE.md](DESPLIEGUE.md).
El modo gratuito, sin clave, funciona también sin conexión una vez abierta la
app por primera vez.

## Desarrollo

El código de la app está en `src/app.jsx` y se compila a `app.js` (que se sube
al repositorio, porque GitHub Pages no tiene paso de build):

```sh
npm install      # la primera vez
npm run build    # tras cada cambio en src/app.jsx
npm test
```

Más detalle en [DESPLIEGUE.md](DESPLIEGUE.md#cambiar-el-código-de-la-app).

## Aviso de marca

Este proyecto es un entrenador independiente y no oficial. **"Aptis" es una
marca del British Council**, que no ha creado, revisado ni respalda esta
aplicación. No existe relación alguna entre este proyecto y el British
Council ni con el examen oficial.

## Licencia

Todos los derechos reservados: uso personal permitido, redistribución y uso comercial
no. Ver [LICENSE](LICENSE). Política de privacidad en
[privacidad.html](privacidad.html); condiciones de contratación y aviso legal en
[condiciones.html](condiciones.html) (borradores pendientes de revisión profesional).
