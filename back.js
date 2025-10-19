// === CONFIGURACIÓN GOOGLE DRIVE ===
const CLIENT_ID = "918822233973-jncnde1k79lhs4qllfhtutokuqua5ded.apps.googleusercontent.com"; // <-- cámbialo
const API_KEY = "AIzaSyCVxpJ3TGmDJ5kKYzalkYdQOzIXcmLUgfg"; // <-- cámbialo
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

async function initGoogleAPI() {
  return new Promise((resolve) => {
    gapi.load("client:auth2", async () => {
      await gapi.client.init({ apiKey: API_KEY, clientId: CLIENT_ID, discoveryDocs: DISCOVERY_DOCS, scope: SCOPES });
      const auth = gapi.auth2.getAuthInstance();
      if (!auth.isSignedIn.get()) await auth.signIn();
      resolve();
    });
  });
}

// === UTILIDADES LOCALES ===
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return parseInt(urlParams.get(param));
}

function getLocalNotes() {
  const saved = localStorage.getItem("notes");
  return saved ? JSON.parse(saved) : { notas: [] };
}

function saveLocalNotes(data) {
  localStorage.setItem("notes", JSON.stringify(data));
}

// === FUNCIONES DRIVE ===
async function subirArchivoDrive(fileId, data) {
  const accessToken = gapi.auth.getToken().access_token;
  const body = JSON.stringify(data);

  if (!fileId) {
    const metadata = { name: "notes.json", mimeType: "application/json" };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", new Blob([body], { type: "application/json" }));

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: new Headers({ Authorization: "Bearer " + accessToken }),
      body: form,
    });
    const info = await res.json();
    localStorage.setItem("driveFileId", info.id);
  } else {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + accessToken },
      body,
    });
  }
}

async function descargarArchivoDrive() {
  const fileId = localStorage.getItem("driveFileId");
  if (!fileId) return null;
  const accessToken = gapi.auth.getToken().access_token;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  return await res.json();
}

// === SINCRONIZACIÓN PRINCIPAL ===
async function cargarNotas() {
  let notes = getLocalNotes();

  if (navigator.onLine) {
    const online = await descargarArchivoDrive();
    if (online) {
      notes = online;
      saveLocalNotes(notes);
    } else {
      await subirArchivoDrive(null, notes); // crea en Drive si no existe
    }
  }

  return notes.notas;
}

async function guardarNotaDrive(id, titulo, contenido) {
  const data = getLocalNotes();
  const existente = data.notas.find((n) => n.id === id);
  const nueva = { id, titulo, contenido, fecha: new Date().toISOString() };

  if (existente) Object.assign(existente, nueva);
  else data.notas.push(nueva);

  saveLocalNotes(data);

  if (navigator.onLine) {
    const fileId = localStorage.getItem("driveFileId");
    await subirArchivoDrive(fileId, data);
  }

  alert("Nota guardada ✅");
}

async function eliminarNota(id) {
  const data = getLocalNotes();
  data.notas = data.notas.filter((n) => n.id !== id);
  saveLocalNotes(data);
  if (navigator.onLine) {
    await subirArchivoDrive(localStorage.getItem("driveFileId"), data);
  }
  alert("Nota eliminada 🗑️");
}

// === INICIALIZAR EDITOR (si existe) ===
const numeroNota = getQueryParam("cargar");
let tituloActual = "";

if (document.getElementById("mi_editor")) {
  tinymce.init({
    selector: "#mi_editor",
    plugins: "lists link emoticons advlist",
    toolbar_mode: "floating",
    toolbar: "undo redo | bold italic underline | bullist numlist | link | emoticons",
    setup: function (editor) {
      editor.on("init", async function () {
        await initGoogleAPI();
        const notas = await cargarNotas();
        const nota = notas.find((n) => n.id === numeroNota);
        if (nota) {
          editor.setContent(nota.contenido);
          tituloActual = nota.titulo;
        }
      });
    },
  });

  document.getElementById("guardar").addEventListener("click", async () => {
    const contenido = tinymce.get("mi_editor").getContent().trim();
    const titulo = prompt("Ingrese un título:", tituloActual) || "Sin título";
    await guardarNotaDrive(numeroNota, titulo, contenido);
  });

  document.getElementById("eliminar").addEventListener("click", async () => {
    if (confirm("¿Seguro que deseas eliminar esta nota?")) {
      await eliminarNota(numeroNota);
      location.href = "index.html";
    }
  });
}
