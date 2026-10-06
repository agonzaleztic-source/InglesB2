// Caracteriza callClaude() (index.html): el mapeo de cada fallo de red o de
// estado HTTP a un mensaje de error y a si merece reintento (reintentable).
// No se puede requerir index.html (mezcla JSX en el mismo <script>), así que
// se extrae su código fuente como texto —igual que tests/delbanco.test.js—
// y se ejecuta con vm junto a un fetch simulado. No se modifica index.html.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function extraerLinea(regex, nombre) {
  const m = html.match(regex);
  assert.ok(m, `no se encontró ${nombre} en index.html`);
  return m[0];
}

const modelSrc = extraerLinea(/const MODEL = "[^"]+";/, "MODEL");
const callClaudeSrc = extraerLinea(/async function callClaude\(prompt\) \{\n[\s\S]*?\n\}/, "callClaude");

function cargarCallClaude({ fetchImpl, cfg = {}, abortLento = false } = {}) {
  const sandbox = {
    window: { APTIS_CONFIG: cfg },
    fetch: fetchImpl,
    AbortController: abortLento ? class { signal = {}; abort() {} } : AbortController,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(`${modelSrc}\n${callClaudeSrc}\nthis.callClaude = callClaude;`, sandbox);
  return sandbox.callClaude;
}

const resOk = (data) => ({ ok: true, status: 200, json: async () => data });
const resErr = (status, data) => ({
  ok: false,
  status,
  json: async () => data,
  clone() { return this; },
});

test("callClaude: respuesta correcta devuelve el texto concatenado de los bloques", async () => {
  const callClaude = cargarCallClaude({
    fetchImpl: async () => resOk({ content: [{ type: "text", text: "hola " }, { type: "text", text: "mundo" }] }),
  });
  assert.equal(await callClaude("p"), "hola mundo");
});

test("callClaude: bloques que no son de texto se ignoran", async () => {
  const callClaude = cargarCallClaude({
    fetchImpl: async () => resOk({ content: [{ type: "tool_use" }, { type: "text", text: "ok" }] }),
  });
  assert.equal(await callClaude("p"), "ok");
});

for (const [status, fragmento] of [
  [401, /clave no es válida/],
  [403, /clave no es válida/],
  [400, /ha rechazado la petición/],
  [429, /límite de peticiones/],
  [402, /no tiene saldo/],
  [500, /no responde ahora mismo/],
  [503, /no responde ahora mismo/],
]) {
  test(`callClaude: estado ${status} da un mensaje concreto y no reintentable`, async () => {
    const callClaude = cargarCallClaude({ fetchImpl: async () => resErr(status, {}) });
    await assert.rejects(callClaude("p"), (err) => {
      assert.match(err.message, fragmento);
      assert.equal(err.reintentable, false);
      return true;
    });
  });
}

test("callClaude: un estado sin caso específico da un mensaje genérico con el código", async () => {
  const callClaude = cargarCallClaude({ fetchImpl: async () => resErr(418, {}) });
  await assert.rejects(callClaude("p"), (err) => {
    assert.match(err.message, /Error 418/);
    assert.equal(err.reintentable, false);
    return true;
  });
});

test("callClaude: en modo worker, el mensaje de error del propio Worker tiene prioridad sobre el genérico", async () => {
  const callClaude = cargarCallClaude({
    cfg: { mode: "worker", endpoint: "https://w/x" },
    fetchImpl: async () => resErr(403, { error: "Cupo diario agotado." }),
  });
  await assert.rejects(callClaude("p"), (err) => {
    assert.equal(err.message, "Cupo diario agotado.");
    assert.equal(err.reintentable, false);
    return true;
  });
});

test("callClaude: en modo worker, si la respuesta de error no es JSON cae al mensaje genérico por estado", async () => {
  const callClaude = cargarCallClaude({
    cfg: { mode: "worker", endpoint: "https://w/x" },
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      json: async () => { throw new SyntaxError("no es JSON"); },
      clone() { return this; },
    }),
  });
  await assert.rejects(callClaude("p"), (err) => {
    assert.match(err.message, /límite de peticiones/);
    assert.equal(err.reintentable, false);
    return true;
  });
});

test("callClaude: un fallo de red (fetch rechaza) da un mensaje de conexión y sí es reintentable", async () => {
  const callClaude = cargarCallClaude({ fetchImpl: async () => { throw new TypeError("network error"); } });
  await assert.rejects(callClaude("p"), (err) => {
    assert.match(err.message, /No hay conexión/);
    assert.notEqual(err.reintentable, false);
    return true;
  });
});

test("callClaude: un AbortError (timeout) da un mensaje de demora y sí es reintentable", async () => {
  const callClaude = cargarCallClaude({
    fetchImpl: async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; },
  });
  await assert.rejects(callClaude("p"), (err) => {
    assert.match(err.message, /tarda demasiado/);
    assert.notEqual(err.reintentable, false);
    return true;
  });
});

test("callClaude: modo directo manda x-api-key y el modelo en el cuerpo, sin cabecera x-app-pass", async () => {
  let vistos;
  const callClaude = cargarCallClaude({
    cfg: { key: "sk-ant-xxx" },
    fetchImpl: async (url, opts) => {
      vistos = { url, headers: opts.headers, body: JSON.parse(opts.body) };
      return resOk({ content: [] });
    },
  });
  await callClaude("hola");
  assert.equal(vistos.url, "https://api.anthropic.com/v1/messages");
  assert.equal(vistos.headers["x-api-key"], "sk-ant-xxx");
  assert.equal(vistos.headers["x-app-pass"], undefined);
  assert.equal(vistos.body.model, "claude-sonnet-5");
  assert.equal(vistos.body.messages[0].content, "hola");
});

test("callClaude: modo worker manda x-app-pass y no x-api-key, y pega al endpoint configurado", async () => {
  let vistos;
  const callClaude = cargarCallClaude({
    cfg: { mode: "worker", endpoint: "https://w.example/api", pass: "1234" },
    fetchImpl: async (url, opts) => {
      vistos = { url, headers: opts.headers, body: JSON.parse(opts.body) };
      return resOk({ content: [] });
    },
  });
  await callClaude("hola");
  assert.equal(vistos.url, "https://w.example/api");
  assert.equal(vistos.headers["x-app-pass"], "1234");
  assert.equal(vistos.headers["x-api-key"], undefined);
  assert.equal(vistos.body.model, undefined);
});
