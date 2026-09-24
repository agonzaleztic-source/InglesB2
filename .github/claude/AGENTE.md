# Instrucciones para el agente autónomo

Trabajas sin supervisión humana en tiempo real. Sigue estas reglas sin excepción.

## Flujo
1. Lee la tarea completa (issue, comentario o prompt) y el `CLAUDE.md` del repositorio si existe.
2. Explora el código que toca la tarea.
3. Implementa el cambio mínimo que resuelve la tarea. Si el proyecto tiene tests, añade o actualiza los que cubran tu cambio.
4. Ejecuta la verificación del proyecto (sección "Verificación de este proyecto"). Si falla, corrige y vuelve a ejecutarla.
5. **Trabaja por bloques y guarda el progreso**: cada vez que un bloque coherente quede verde (un archivo corregido, una función con su test, una migración), haz commit y `git push` a tu rama inmediatamente. Si el entorno te corta por límite de turnos o de presupuesto, lo que ya esté empujado no se pierde y el siguiente intento continúa desde ahí. Nunca acumules más de ~10 archivos modificados sin commit.
6. Cuando la verificación pase completa: último commit con un mensaje claro (español, imperativo, una línea de resumen), push y abre un Pull Request contra la rama base. Termina.

## Límites (criterios de parada)
- Máximo 10 ciclos corrección → verificación. Si tras el décimo sigue fallando: haz commit de lo que tengas, abre el PR como borrador con el título precedido de `[BLOQUEADO]` y explica en el cuerpo qué falla y qué has intentado. Termina.
- Si la tarea es ambigua o exige una decisión de negocio, no adivines: responde en la issue con preguntas concretas y termina sin cambiar código.
- Si la tarea requiere credenciales, datos de producción o cambios de infraestructura, detente y explícalo en la issue.
- Si el `CLAUDE.md` del repo pide mantener un artefacto, documento o servicio externo al cambiar algo (por ejemplo un informe de auditoría publicado), no puedes hacerlo desde aquí: no bloquees la tarea por eso; anota en el PR qué elemento debe actualizar una persona.
- No repitas el mismo intento fallido dos veces; cambia de enfoque o para.
- Si la tarea es grande (muchos archivos), empieza por lo que más valor aporta y deja constancia en el PR de lo que queda; un PR parcial con verificación verde y trabajo empujado vale más que uno completo que nunca llega.

## Prohibido
- Commit o push directo en la rama base (`main`/`master`). Trabaja siempre en una rama `claude/...`.
- Hacer merge de tu propio PR.
- Leer, crear o modificar secretos: `.env*`, `config.py`, claves, tokens, cuentas de Stripe/Turso/Vercel/Google.
- Modificar `.github/workflows/`, `.github/claude/`, este archivo o cualquier configuración del agente.
- Borrar, saltar o debilitar tests para que "pasen".
- Añadir dependencias nuevas salvo que sea imprescindible; si lo haces, justifícalo en el PR.
- Comandos destructivos: `git push --force`, `git reset --hard` sobre trabajo ajeno, borrar ramas, drops o migraciones destructivas de BD, `rm -rf` fuera del repositorio.
- Desplegar a producción o tocar servicios remotos.

## Definición de terminado (Definition of Done)
- La verificación del proyecto pasa completa.
- Los cambios están en un PR contra la rama base con: resumen, archivos tocados, cómo probarlo y `Closes #N` si viene de una issue.
- No queda trabajo a medias sin documentar en el PR.

## Verificación de este proyecto (InglesB2)

- Rama base: `master`. Stack: estatico.
- Verificación obligatoria antes de dar por terminada la tarea (todos deben salir con código 0):
  - `node --test tests/`
