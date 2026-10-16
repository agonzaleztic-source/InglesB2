/**
 * Simulacro cronometrado del Aptis General: lógica pura (sin DOM ni React).
 *
 * Aquí se decide qué ítems entran, cuánto dura cada sección, cómo se
 * puntúa cada destreza en la escala 0-50 y qué nivel MCER se estima. La
 * interfaz vive en src/app.jsx (componente Simulacro) y se guarda en
 * localStorage; todo lo de aquí se prueba con node:test
 * (tests/simulacro.test.js).
 *
 * Se expone como un único global, SIM, para no chocar con los nombres de
 * logica.js y app.js, que comparten el ámbito global del navegador.
 *
 * QUÉ DIFIERE DEL EXAMEN REAL (Aptis General, formato por ordenador):
 *  - Tiempos: se respetan los del examen (Core 25, Reading 35, Listening 40,
 *    Writing 50, Speaking 12 min), pero el número de ítems depende del banco
 *    que viene en la app, que es más pequeño:
 *      · Core: hasta 50 preguntas (el real tiene 25 de gramática y 25 de
 *        vocabulario); el banco trae unas 47, todas de opción múltiple, sin
 *        los formatos de vocabulario de emparejar del examen real.
 *      · Reading: las 4 partes del catálogo (r1-r4), una tanda de cada una,
 *        unos 20 ítems. El examen real tiene 5 partes y algo más de ítems.
 *      · Listening: todas las tandas de l1 (9 audios frente a 13), una de l2,
 *        una de l3 y hasta dos de l4 (unos 23 ítems frente a 25).
 *      · Writing y Speaking: una tanda de cada parte (w1-w4, s1-s4), como el
 *        examen. El Speaking real lo graba el ordenador; aquí se transcribe
 *        con el reconocimiento de voz del navegador si lo hay.
 *  - Entre sección y sección hay una pantalla de paso: el reloj de la
 *    siguiente no arranca hasta que pulsas «Empezar». En el examen real no hay
 *    pausa. Dentro de una sección, el reloj sigue corriendo aunque cierres la
 *    pestaña (se guarda la hora de fin, no los segundos que quedan).
 *  - En el Listening real cada audio suena dos veces y no más; aquí el
 *    contador de escuchas se reinicia si recargas la página.
 *  - Puntuación: 0-50 por destreza como en el examen, pero las fronteras de
 *    nivel (CORTES) son una aproximación propia: el British Council las ajusta
 *    por versión del examen y no publica una tabla fija. El Core, que en el
 *    examen real no da nivel por sí solo, se muestra aparte con su nivel
 *    orientativo y no suma al total.
 */
(function (raiz) {
  const MIN = 60 * 1000;

  /* Formato de cada parte del catálogo TASKS de src/app.jsx. */
  const FORMATO = {
    core: "mcq", l1: "mcq", l4: "mcq",
    r1: "fill", r3: "fill",
    r2: "order",
    r4: "match", l2: "match", l3: "match",
    w1: "write", w2: "write", w3: "write", w4: "write",
    s1: "speak", s2: "speak", s3: "speak", s4: "speak",
  };

  /*
   * Estructura de cada sección. «partes» dice de qué parte del banco sale
   * cada bloque y cuántas tandas se juntan en él (juntar: tandas que se
   * funden en una sola parte, como los audios cortos de l1) o cuántos
   * bloques separados se sacan (repite).
   */
  const ESTRUCTURA = {
    core: { nombre: "Gramática y vocabulario", mins: 25, partes: [{ id: "core", preguntas: 50 }] },
    reading: { nombre: "Reading", mins: 35, partes: [{ id: "r1" }, { id: "r2" }, { id: "r3" }, { id: "r4" }] },
    listening: { nombre: "Listening", mins: 40, partes: [{ id: "l1", juntar: 5 }, { id: "l2" }, { id: "l3" }, { id: "l4", repite: 2 }] },
    writing: { nombre: "Writing", mins: 50, partes: [{ id: "w1" }, { id: "w2" }, { id: "w3" }, { id: "w4" }] },
    speaking: { nombre: "Speaking", mins: 12, partes: [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }] },
  };
  const ORDEN = ["core", "reading", "listening", "writing", "speaking"];
  const PRODUCTIVAS = ["writing", "speaking"];
  const esProductiva = (skill) => PRODUCTIVAS.includes(skill);

  /* Peso de cada parte en la nota de Writing/Speaking. La parte 4 del
     Writing (los dos emails) es la que más pesa en el examen real; el
     reparto exacto no es público, así que es una aproximación. */
  const PESOS = { w1: 1, w2: 1, w3: 1, w4: 2, s1: 1, s2: 1, s3: 1, s4: 1 };

  /*
   * Puntuación mínima (0-50) para cada nivel. Aproximación propia, ver la
   * cabecera: NO es la tabla oficial. «global» se aplica a la media de las
   * destrezas puntuadas para el nivel del total.
   */
  const NIVELES = ["A0", "A1", "A2", "B1", "B2", "C"];
  const CORTES = {
    core: { A1: 8, A2: 16, B1: 26, B2: 38, C: 46 },
    reading: { A1: 8, A2: 16, B1: 26, B2: 38, C: 46 },
    listening: { A1: 8, A2: 16, B1: 24, B2: 34, C: 42 },
    writing: { A1: 6, A2: 18, B1: 26, B2: 40, C: 48 },
    speaking: { A1: 4, A2: 16, B1: 26, B2: 41, C: 48 },
    global: { A1: 7, A2: 17, B1: 26, B2: 38, C: 46 },
  };
  const NOMBRE_NIVEL = { A0: "por debajo de A1", A1: "A1", A2: "A2", B1: "B1", B2: "B2", C: "C1-C2" };

  function nivelDe(skill, puntos) {
    if (typeof puntos !== "number" || !Number.isFinite(puntos)) return null;
    const c = CORTES[skill] || CORTES.global;
    let n = "A0";
    for (const lv of NIVELES.slice(1)) if (puntos >= c[lv]) n = lv;
    return n;
  }

  /* Un nivel (el que devuelve la corrección del modelo o la autoevaluación)
     pasado a puntos: el centro de su franja en la escala de esa destreza, de
     modo que nivelDe(skill, puntosDeNivel(skill, lv)) === lv. */
  function puntosDeNivel(skill, lv) {
    const c = CORTES[skill] || CORTES.global;
    if (lv === "A0") return Math.floor(c.A1 / 2);
    const i = NIVELES.indexOf(lv);
    if (i < 1) return null;
    const desde = c[lv];
    const hasta = i + 1 < NIVELES.length ? c[NIVELES[i + 1]] : 51;
    return Math.floor((desde + hasta - 1) / 2);
  }

  const puntosObjetivos = (aciertos, total) => (total > 0 ? Math.round((50 * aciertos) / total) : 0);

  /* ---------------- selección de ítems ---------------- */
  const barajar = (a, rand) => a.map((v) => [rand(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  /* Orden de partida de una tarea de ordenar: el que ve el alumno antes de
     tocar nada y, si no lo toca, su respuesta. */
  function ordenInicial(nLineas, rand) {
    const idx = Array.from({ length: Math.max(0, nLineas - 1) }, (_, i) => i + 1);
    return barajar(idx, rand);
  }

  function preparaParte(def, banco, rand) {
    const pool = Array.isArray(banco[def.id]) ? banco[def.id] : [];
    if (def.id === "core") {
      const qs = barajar(pool, rand).slice(0, def.preguntas || 50);
      return qs.length ? [{ id: "core", data: { questions: qs } }] : [];
    }
    if (!pool.length) return [];
    const tandas = barajar(pool, rand);
    if (def.juntar) {
      const elegidas = tandas.slice(0, def.juntar);
      return [{ id: def.id, data: {
        intro: elegidas[0].intro,
        questions: elegidas.flatMap((t) => t.questions || []),
      } }];
    }
    return tandas.slice(0, def.repite || 1).map((data) => {
      const p = { id: def.id, data };
      if (FORMATO[def.id] === "order") p.orden = ordenInicial((data.lines || []).length, rand);
      return p;
    });
  }

  /*
   * Prepara un simulacro nuevo. modo = "completo" o una destreza ("reading"...).
   * banco = window.BANK; rand = Math.random (o uno fijo en los tests).
   * Las secciones sin ningún contenido en el banco se quitan.
   */
  function preparaSimulacro(banco, modo, rand = Math.random, ahora = Date.now()) {
    const skills = modo === "completo" ? ORDEN : ORDEN.includes(modo) ? [modo] : [];
    if (!skills.length) throw new Error("Modo de simulacro desconocido.");
    const secciones = skills.map((skill) => ({
      skill,
      mins: ESTRUCTURA[skill].mins,
      partes: ESTRUCTURA[skill].partes.flatMap((def) => preparaParte(def, banco || {}, rand)),
      fin: null,
      cerrada: false,
      motivo: null,
    })).filter((s) => s.partes.length);
    if (!secciones.length) throw new Error("El banco no tiene ejercicios para este simulacro.");
    return {
      v: 1,
      id: `sim-${ahora}-${Math.floor(rand() * 1e6)}`,
      modo,
      inicio: ahora,
      fase: "examen",
      actual: 0,
      secciones,
      resp: secciones.map((s) => s.partes.map(() => null)),
      calif: secciones.map(() => null),
    };
  }

  /* ---------------- corrección de las destrezas objetivas ---------------- */
  function itemsDeParte(parte) {
    const d = parte.data || {};
    switch (FORMATO[parte.id]) {
      case "mcq": return (d.questions || []).length;
      case "fill": return Array.isArray(d.bank) ? (d.answers || []).length : (d.gaps || []).length;
      case "order": return Math.max(0, (d.lines || []).length - 1);
      case "match": return (d.items || []).length;
      default: return 0;
    }
  }

  /* resp: {índice: opción} en mcq/fill/match; el orden actual en order. */
  function aciertosDeParte(parte, resp) {
    const d = parte.data || {};
    const r = resp && typeof resp === "object" ? resp : {};
    switch (FORMATO[parte.id]) {
      case "mcq": return (d.questions || []).filter((q, i) => r[i] === q.correct).length;
      case "fill": {
        const ok = Array.isArray(d.bank) ? (d.answers || []) : (d.gaps || []).map((g) => g.correct);
        return ok.filter((c, i) => r[i] === c).length;
      }
      case "order": {
        const orden = Array.isArray(resp) ? resp : (parte.orden || []);
        return orden.filter((v, i) => v === i + 1).length;
      }
      case "match": return (d.answers || []).filter((c, i) => i < (d.items || []).length && r[i] === c).length;
      default: return 0;
    }
  }

  /* ---------------- Writing y Speaking ---------------- */
  const palabras = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
  /* Una parte productiva sin nada escrito o dicho vale 0, como en el examen. */
  function parteVacia(resp) {
    if (!resp) return true;
    const textos = Array.isArray(resp) ? resp : Object.values(resp);
    return textos.every((t) => palabras(t) === 0);
  }

  /*
   * Nota de una sección productiva a partir del nivel de cada parte
   * (niveles[i] = "A2"|"B1"|..., o null si esa parte no se ha podido
   * corregir). Las partes vacías cuentan 0. Si falta alguna nota, null.
   */
  function puntuaProductiva(skill, partes, resps, niveles) {
    let suma = 0;
    let pesos = 0;
    for (let i = 0; i < partes.length; i++) {
      const w = PESOS[partes[i].id] || 1;
      let p;
      if (parteVacia(resps[i])) p = 0;
      else {
        p = puntosDeNivel(skill, (niveles || [])[i]);
        if (p == null) return null;
      }
      suma += w * p;
      pesos += w;
    }
    return pesos ? Math.round(suma / pesos) : null;
  }

  /* ---------------- temporizador ---------------- */
  /* Arranca el reloj de la sección actual (si no estaba ya en marcha). */
  function iniciaSeccion(estado, ahora = Date.now()) {
    const s = estado.secciones[estado.actual];
    if (!s || s.fin) return estado;
    const secciones = estado.secciones.slice();
    secciones[estado.actual] = { ...s, fin: ahora + s.mins * MIN };
    return { ...estado, secciones };
  }

  function segundosRestantes(estado, ahora = Date.now()) {
    const s = estado.secciones[estado.actual];
    if (!s || !s.fin) return null;
    return Math.max(0, Math.ceil((s.fin - ahora) / 1000));
  }

  /* Cierra la sección actual (motivo "tiempo" o "usuario") y pasa a la
     siguiente; tras la última, al resultado. */
  function cierraSeccion(estado, motivo = "usuario") {
    const s = estado.secciones[estado.actual];
    if (!s || estado.fase !== "examen") return estado;
    const secciones = estado.secciones.slice();
    secciones[estado.actual] = { ...s, cerrada: true, motivo };
    const actual = estado.actual + 1;
    return { ...estado, secciones, actual, fase: actual >= secciones.length ? "resultado" : "examen" };
  }

  /* Si el reloj de la sección en curso ha llegado a cero, la cierra.
     Se llama en cada tic y al recuperar el simulacro tras una recarga. */
  function compruebaTiempo(estado, ahora = Date.now()) {
    if (estado.fase !== "examen") return estado;
    const r = segundosRestantes(estado, ahora);
    return r === 0 ? cierraSeccion(estado, "tiempo") : estado;
  }

  /* Avisos para el lector de pantalla: solo al cruzar estas marcas, no cada
     segundo. Devuelve el texto o null. */
  const MARCAS = [600, 300, 60];
  function avisoTiempo(antes, ahora) {
    if (antes == null || ahora == null || ahora >= antes) return null;
    for (const m of MARCAS) {
      if (antes > m && ahora <= m && ahora > 0) {
        return m === 60 ? "Queda 1 minuto de esta sección." : `Quedan ${m / 60} minutos de esta sección.`;
      }
    }
    return null;
  }

  const reloj = (seg) => {
    const s = Math.max(0, seg | 0);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  /* ---------------- resultado ---------------- */
  /*
   * Resultado de un simulacro: por destreza, puntos 0-50, nivel estimado y de
   * dónde sale la nota (fuente: "auto" para las objetivas; "modelo",
   * "autoevaluacion", "sin" o "pendiente" para Writing y Speaking). El total
   * suma las destrezas puntuadas salvo el Core, que en el Aptis se informa
   * aparte; si el simulacro es solo de Core, el total es el Core.
   */
  function resultadoDe(estado) {
    const destrezas = {};
    estado.secciones.forEach((s, si) => {
      const resps = estado.resp[si] || [];
      if (esProductiva(s.skill)) {
        const c = estado.calif && estado.calif[si];
        const fuente = c ? c.fuente : "pendiente";
        const puntos = c && c.fuente !== "sin" ? puntuaProductiva(s.skill, s.partes, resps, c.niveles) : null;
        destrezas[s.skill] = { puntos, nivel: nivelDe(s.skill, puntos), fuente: puntos == null && fuente !== "sin" ? "pendiente" : fuente };
      } else {
        const total = s.partes.reduce((a, p) => a + itemsDeParte(p), 0);
        const aciertos = s.partes.reduce((a, p, i) => a + aciertosDeParte(p, resps[i]), 0);
        const puntos = puntosObjetivos(aciertos, total);
        destrezas[s.skill] = { puntos, nivel: nivelDe(s.skill, puntos), fuente: "auto", aciertos, total };
      }
    });
    const claves = Object.keys(destrezas);
    const suman = claves.some((k) => k !== "core") ? claves.filter((k) => k !== "core") : claves;
    const puntuadas = suman.filter((k) => destrezas[k].puntos != null);
    const puntos = puntuadas.reduce((a, k) => a + destrezas[k].puntos, 0);
    const total = {
      puntos: puntuadas.length ? puntos : null,
      max: 50 * puntuadas.length,
      nivel: puntuadas.length ? nivelDe(suman.length === 1 ? suman[0] : "global", puntos / puntuadas.length) : null,
      incompleto: puntuadas.length < suman.length,
    };
    return { destrezas, total };
  }

  /* Entrada del historial que se guarda en el progreso. */
  function entradaHistorial(estado, fecha) {
    const { destrezas, total } = resultadoDe(estado);
    return { id: estado.id, fecha, modo: estado.modo, destrezas, total };
  }

  /* Añade o sustituye (mismo id) una entrada; las más recientes primero. */
  function anadeAlHistorial(lista, entrada, max = 30) {
    const resto = (Array.isArray(lista) ? lista : []).filter((e) => e && e.id !== entrada.id);
    return [entrada, ...resto].slice(0, max);
  }

  /* ¿Lo guardado en localStorage es un simulacro en curso utilizable? */
  function estadoValido(e) {
    return !!e && typeof e === "object" && e.v === 1 && typeof e.id === "string"
      && (e.fase === "examen" || e.fase === "resultado")
      && Array.isArray(e.secciones) && e.secciones.length > 0
      && e.secciones.every((s) => s && ESTRUCTURA[s.skill] && Array.isArray(s.partes) && s.partes.every((p) => p && FORMATO[p.id] && p.data))
      && Array.isArray(e.resp) && e.resp.length === e.secciones.length
      && Array.isArray(e.calif) && e.calif.length === e.secciones.length
      && Number.isInteger(e.actual) && e.actual >= 0 && e.actual <= e.secciones.length;
  }

  const SIM = {
    FORMATO, ESTRUCTURA, ORDEN, CORTES, NIVELES, NOMBRE_NIVEL, PESOS,
    esProductiva, nivelDe, puntosDeNivel, puntosObjetivos, preparaSimulacro, itemsDeParte, aciertosDeParte,
    parteVacia, palabras, puntuaProductiva, iniciaSeccion, segundosRestantes, cierraSeccion, compruebaTiempo,
    avisoTiempo, reloj, resultadoDe, entradaHistorial, anadeAlHistorial, estadoValido,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = SIM;
  else raiz.SIM = SIM;
})(typeof window !== "undefined" ? window : globalThis);
