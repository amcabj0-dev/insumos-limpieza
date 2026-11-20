/**
 * API de "Insumos de limpieza" para Google Sheets.
 *
 * Cómo se usa (resumen):
 * 1. Creá una planilla nueva en Google Sheets.
 * 2. Menú Extensiones > Apps Script. Borrá lo que haya y pegá TODO este archivo.
 * 3. Cambiá la CLAVE de abajo y guardá.
 * 4. Elegí la función "inicializar" arriba y tocá "Ejecutar" (te va a pedir permisos: aceptalos).
 * 5. Implementar > Nueva implementación > tipo "Aplicación web":
 *      Ejecutar como: Yo   |   Quién tiene acceso: Cualquier usuario
 *    Copiá la URL que termina en /exec y pegala en index.html (API_URL).
 */

// Clave que el personal escribe una sola vez en el celular. Cambiala.
// Si la dejás vacía ("") la app no pide clave (cualquiera con el link podría cargar datos).
const CLAVE = "limpieza2026";

const HOJAS = {
  Entregas: ["id", "fecha", "hora", "entrega", "recibe", "sector", "articulo", "cantidad", "unidad", "observaciones", "creado"],
  Ingresos: ["id", "fecha", "proveedor", "remito", "recibio", "articulo", "cantidad", "unidad", "observaciones", "creado"],
  Listas: ["tipo", "nombre", "unidad"],
};
const TIPOS_LISTA = ["personal", "sectores", "proveedores", "articulos"];

// ---------------------------------------------------------------- entrada
function doGet() {
  return salida({ ok: true, mensaje: "La API de insumos está funcionando." });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return salida({ ok: false, error: "json" }); }
  if (CLAVE && req.clave !== CLAVE) return salida({ ok: false, error: "clave" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (req.action) {
      case "listar":         return salida(Object.assign({ ok: true }, listar()));
      case "agregarEntrega": agregarEntrega(req.registro); return salida({ ok: true });
      case "agregarIngreso": agregarIngreso(req.registro); return salida({ ok: true });
      case "borrar":         borrar(req.tipo, req.id); return salida({ ok: true });
      case "listaAgregar":   listaAgregar(req.tipo, req.nombre, req.unidad); return salida({ ok: true });
      case "listaQuitar":    listaQuitar(req.tipo, req.nombre); return salida({ ok: true });
      default:               return salida({ ok: false, error: "accion" });
    }
  } catch (err) {
    return salida({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- utilidades
function hoja(nombre) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    const cols = HOJAS[nombre];
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold").setBackground("#e2f3ef");
    sh.setFrozenRows(1);
    sh.getRange(2, 1, sh.getMaxRows() - 1, cols.length).setNumberFormat("@");
    const c = cols.indexOf("cantidad");
    if (c >= 0) sh.getRange(2, c + 1, sh.getMaxRows() - 1, 1).setNumberFormat("0.##");
  }
  return sh;
}

// Texto limpio y sin fórmulas (evita que algo escrito con "=" se ejecute en la planilla).
function txt(v, max) {
  let s = String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function numero(v) { const n = Number(String(v).replace(",", ".")); return isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : 0; }
function clave(s) { return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " "); }

function celda(v, tipo) {
  if (v instanceof Date) {
    const tz = Session.getScriptTimeZone();
    return Utilities.formatDate(v, tz, tipo === "hora" ? "HH:mm" : "yyyy-MM-dd");
  }
  return v;
}

function filas(nombre) {
  const sh = hoja(nombre);
  const cols = HOJAS[nombre];
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, cols.length).getValues().map(r => {
    const o = {};
    cols.forEach((c, i) => o[c] = celda(r[i], c));
    return o;
  });
}

function items(registro) {
  const lista = (registro && Array.isArray(registro.items) ? registro.items : []).slice(0, 60)
    .map(it => ({ articulo: txt(it.articulo, 150), cantidad: numero(it.cantidad), unidad: txt(it.unidad || "unidad", 30) }))
    .filter(it => it.articulo && it.cantidad > 0);
  if (!lista.length) throw new Error("sin artículos");
  return lista;
}

// ---------------------------------------------------------------- acciones
function listar() {
  const agrupar = (rows, cabecera) => {
    const map = {};
    const orden = [];
    rows.forEach(r => {
      if (!r.id) return;
      if (!map[r.id]) { map[r.id] = Object.assign({ _id: String(r.id), items: [] }, cabecera(r)); orden.push(r.id); }
      map[r.id].items.push({ articulo: String(r.articulo), cantidad: Number(r.cantidad) || 0, unidad: String(r.unidad || "unidad") });
    });
    return orden.map(id => map[id]);
  };
  const entregas = agrupar(filas("Entregas"), r => ({
    fecha: String(r.fecha) + (r.hora ? "T" + String(r.hora).slice(0, 5) : ""),
    entrega: String(r.entrega), recibe: String(r.recibe), sector: String(r.sector),
    obs: String(r.observaciones || ""), creado: String(r.creado || ""),
  }));
  const ingresos = agrupar(filas("Ingresos"), r => ({
    fecha: String(r.fecha), proveedor: String(r.proveedor), remito: String(r.remito || ""), recibio: String(r.recibio || ""),
    obs: String(r.observaciones || ""), creado: String(r.creado || ""),
  }));
  const listas = { personal: [], sectores: [], proveedores: [], articulos: [] };
  filas("Listas").forEach(r => {
    const t = String(r.tipo), n = String(r.nombre || "").trim();
    if (!n || !listas[t]) return;
    if (t === "articulos") listas.articulos.push({ nombre: n, unidad: String(r.unidad || "unidad") });
    else listas[t].push(n);
  });
  const ord = (a, b) => a.localeCompare(b, "es");
  ["personal", "sectores", "proveedores"].forEach(t => listas[t].sort(ord));
  listas.articulos.sort((a, b) => ord(a.nombre, b.nombre));
  return { entregas, ingresos, listas };
}

function agregarEntrega(reg) {
  const its = items(reg);
  const id = Utilities.getUuid();
  const fecha = txt(reg.fecha, 16);
  const ahora = new Date().toISOString();
  const cab = [id, fecha.slice(0, 10), fecha.slice(11, 16), txt(reg.entrega), txt(reg.recibe), txt(reg.sector)];
  const rows = its.map(it => cab.concat([it.articulo, it.cantidad, it.unidad, txt(reg.obs, 500), ahora]));
  const sh = hoja("Entregas");
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  sumarAListas({ personal: [reg.entrega, reg.recibe], sectores: [reg.sector] }, its);
}

function agregarIngreso(reg) {
  const its = items(reg);
  const id = Utilities.getUuid();
  const ahora = new Date().toISOString();
  const cab = [id, txt(reg.fecha, 10), txt(reg.proveedor), txt(reg.remito, 40), txt(reg.recibio)];
  const rows = its.map(it => cab.concat([it.articulo, it.cantidad, it.unidad, txt(reg.obs, 500), ahora]));
  const sh = hoja("Ingresos");
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  sumarAListas({ personal: [reg.recibio], proveedores: [reg.proveedor] }, its);
}

function borrar(tipo, id) {
  const nombre = tipo === "entregas" ? "Entregas" : tipo === "ingresos" ? "Ingresos" : null;
  if (!nombre || !id) throw new Error("borrar: datos inválidos");
  const sh = hoja(nombre);
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(id)) sh.deleteRow(i + 2);
}

function listaAgregar(tipo, nombre, unidad) {
  if (TIPOS_LISTA.indexOf(tipo) < 0) throw new Error("tipo de lista inválido");
  const n = txt(nombre, 150);
  if (!n) return;
  const existentes = filas("Listas").filter(r => r.tipo === tipo).map(r => clave(r.nombre));
  if (existentes.indexOf(clave(n)) >= 0) return;
  hoja("Listas").appendRow([tipo, n, tipo === "articulos" ? txt(unidad || "unidad", 30) : ""]);
}

function listaQuitar(tipo, nombre) {
  const sh = hoja("Listas");
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const vals = sh.getRange(2, 1, n, 2).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === tipo && clave(vals[i][1]) === clave(nombre)) sh.deleteRow(i + 2);
  }
}

function sumarAListas(campos, its) {
  const actuales = {};
  TIPOS_LISTA.forEach(t => actuales[t] = []);
  filas("Listas").forEach(r => { if (actuales[r.tipo]) actuales[r.tipo].push(clave(r.nombre)); });
  const nuevas = [];
  const sumar = (tipo, nombre, unidad) => {
    const n = txt(nombre, 150);
    if (!n || actuales[tipo].indexOf(clave(n)) >= 0) return;
    actuales[tipo].push(clave(n));
    nuevas.push([tipo, n, tipo === "articulos" ? (unidad || "unidad") : ""]);
  };
  Object.keys(campos).forEach(t => (campos[t] || []).forEach(v => sumar(t, v)));
  its.forEach(it => sumar("articulos", it.articulo, it.unidad));
  if (nuevas.length) {
    const sh = hoja("Listas");
    sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, 3).setValues(nuevas);
  }
}

// ---------------------------------------------------------------- primera vez
// Ejecutala UNA vez desde el editor: crea las hojas y carga los dos remitos del 13/10/2026.
function inicializar() {
  Object.keys(HOJAS).forEach(hoja);
  if (filas("Ingresos").length) { Logger.log("Ya había ingresos cargados: no se agregó nada."); return; }

  agregarIngreso({
    fecha: "2026-10-13", proveedor: "Limpi Hogar", remito: "X00000025", recibio: "Miguel Luquez",
    obs: "Cargado desde la foto del remito",
    items: [
      { articulo: "Lavandina concentrada 5 L (Cleanny)", cantidad: 12, unidad: "bidón" },
      { articulo: "Detergente Cleanny 5 L", cantidad: 2, unidad: "bidón" },
      { articulo: "Líquido para lampazo 3 L", cantidad: 3, unidad: "bidón" },
      { articulo: "Cif crema original 750 g", cantidad: 4, unidad: "unidad" },
      { articulo: "Raid mata moscas y mosquitos 380 cc", cantidad: 8, unidad: "aerosol" },
      { articulo: "Trapo rejilla Marilú", cantidad: 8, unidad: "unidad" },
      { articulo: "Bolsas consorcio 80x110 (x10)", cantidad: 10, unidad: "paquete" },
      { articulo: "Bolsas residuos 45x60 (rollo x30)", cantidad: 10, unidad: "rollo" },
      { articulo: "Papel higiénico Family Mega x6 90 m", cantidad: 4, unidad: "paquete" },
      { articulo: "Toalla de papel 300 m Campanita (pack x2)", cantidad: 40, unidad: "pack" },
      { articulo: "Papel higiénico Ecco x8 300 m", cantidad: 25, unidad: "paquete" },
      { articulo: "Jabón en pan gigante 200 g", cantidad: 3, unidad: "unidad" },
      { articulo: "Lysoform desinfectante aerosol 380 ml", cantidad: 2, unidad: "aerosol" },
      { articulo: "Lampazo barredor 100 cm Italimp completo", cantidad: 1, unidad: "unidad" },
      { articulo: "Vinagre de alcohol 5 L", cantidad: 2, unidad: "bidón" },
      { articulo: "Batea plástica blanca mediana 41x30", cantidad: 4, unidad: "unidad" },
      { articulo: "Jabón líquido de manos 5 L Cleanny coco", cantidad: 6, unidad: "bidón" },
      { articulo: "Bobina de papel Elegante 400 m", cantidad: 12, unidad: "unidad" },
    ],
  });
  agregarIngreso({
    fecha: "2026-10-13", proveedor: "Limpieza Zur", remito: "0012-00001365", recibio: "",
    obs: "Cargado desde la foto del remito",
    items: [
      { articulo: "Repuesto escurridor para balde ovalado", cantidad: 4, unidad: "unidad" },
      { articulo: "Repuesto barredor comercial 100 cm algodón", cantidad: 4, unidad: "unidad" },
      { articulo: "Barredor completo doméstico 60 cm algodón", cantidad: 4, unidad: "unidad" },
      { articulo: "Secador de piso 40 cm goma Romyl", cantidad: 2, unidad: "unidad" },
      { articulo: "Trapo de piso azul 50x60", cantidad: 5, unidad: "unidad" },
      { articulo: "Guantes de goma talle M", cantidad: 10, unidad: "par" },
      { articulo: "Guantes de goma talle XG", cantidad: 10, unidad: "par" },
      { articulo: "Pulverizador 1 L", cantidad: 6, unidad: "unidad" },
    ],
  });
  listaAgregar("personal", "Daniel");
  Logger.log("Listo: hojas creadas y remitos cargados.");
}
