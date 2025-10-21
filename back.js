// === UTILIDADES LOCALES ===
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function getLocalNotes() {
  const saved = localStorage.getItem("notes");
  return saved ? JSON.parse(saved) : { notas: [] };
}

function saveLocalNotes(data) {
  localStorage.setItem("notes", JSON.stringify(data));
}

// === CONFIGURACIÓN GOOGLE DRIVE ===
const CLIENT_ID = "918822233973-jncnde1k79lhs4qllfhtutokuqua5ded.apps.googleusercontent.com";
const API_KEY = "AIzaSyCVxpJ3TGmDJ5kKYzalkYdQOzIXcmLUgfg";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// === INICIALIZACIÓN GOOGLE API ===
async function initGoogleAPI() {
  return new Promise((resolve, reject) => {
    gapi.load("client", async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });

        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              gapi.client.setToken({ access_token: tokenResponse.access_token });
              resolve();
            } else {
              reject("No se obtuvo token de acceso.");
            }
          },
        });

        // Mostrar prompt de autorización
        tokenClient.requestAccessToken({ prompt: "consent" });
      } catch (error) {
        console.error("Error inicializando Google API:", error);
        alert("No se pudo iniciar sesión con Google.");
        reject(error);
      }
    });
  });
}

// === FUNCIONES DRIVE ===
async function subirArchivoDrive(fileId, data) {
  try {
    const tokenObj = gapi.auth.getToken();
    if (!tokenObj || !tokenObj.access_token) {
      console.warn("No se pudo obtener el token de acceso de Google.");
      return;
    }
    const accessToken = tokenObj.access_token;
    const body = JSON.stringify(data);

    if (!fileId) {
      // Crear nuevo archivo
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
      if (info.id) localStorage.setItem("driveFileId", info.id);
    } else {
      // Actualizar archivo existente
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + accessToken },
        body,
      });
    }
  } catch (err) {
    console.error("Error en subirArchivoDrive:", err);
  }
}

async function descargarArchivoDrive() {
  try {
    const fileId = localStorage.getItem("driveFileId");
    if (!fileId) return null;

    const tokenObj = gapi.auth.getToken();
    if (!tokenObj || !tokenObj.access_token) {
      console.warn("No se pudo obtener el token de acceso de Google.");
      return null;
    }
    const accessToken = tokenObj.access_token;

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: "Bearer " + accessToken },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Error en descargarArchivoDrive:", err);
    return null;
  }
}

// === SINCRONIZACIÓN PRINCIPAL ===
async function cargarNotas() {
  let notes = getLocalNotes();

  if (navigator.onLine) {
    try {
      const online = await descargarArchivoDrive();
      if (online) {
        notes = online;
        saveLocalNotes(notes);
      } else {
        await subirArchivoDrive(null, notes);
      }
    } catch (err) {
      console.warn("No se pudo sincronizar con Drive:", err);
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
    try {
      const fileId = localStorage.getItem("driveFileId");
      await subirArchivoDrive(fileId, data);
      alert("Nota guardada ✅");
    } catch (err) {
      console.error("Error guardando en Drive:", err);
      alert("No se pudo guardar la nota en Drive.");
    }
  } else {
    alert("Nota guardada localmente (sin conexión) ✅");
  }
}

async function eliminarNota(id) {
  const data = getLocalNotes();
  data.notas = data.notas.filter((n) => n.id !== id);
  saveLocalNotes(data);

  if (navigator.onLine) {
    try {
      await subirArchivoDrive(localStorage.getItem("driveFileId"), data);
      alert("Nota eliminada 🗑️");
    } catch (err) {
      console.error("Error eliminando en Drive:", err);
      alert("No se pudo eliminar la nota en Drive.");
    }
  } else {
    alert("Nota eliminada localmente (sin conexión) 🗑️");
  }
}

// === INICIALIZAR EDITOR ===
const numeroNota = getQueryParam("cargar") || Date.now().toString(); // ID existente o nuevo
let tituloActual = "";

if (document.getElementById("mi_editor")) {
  tinymce.init({
    selector: "#mi_editor",
    plugins: "lists link emoticons advlist",
    toolbar_mode: "floating",
    toolbar: "undo redo | bold italic underline | bullist numlist | link | emoticons | fullscreen",
    height: "100%",
    menubar: false,
    skin: "oxide-dark",
    content_css: "dark",
    content_style: `
      body {
        background-color: #1e1e1e;
        color: #f5f5f5;
        font-family: "Comic Sans MS", sans-serif;
        font-size: 16px;
        line-height: 1.6;
        padding: 10px;
      }
      a { color: #82b1ff; }
      h1, h2, h3, h4 { color: #f5f5f5; }
      ul, ol { padding-left: 20px; }
    `,
    setup: function (editor) {
      editor.on("init", async function () {
        try {
          await initGoogleAPI();
          const notas = await cargarNotas();
          const nota = notas.find((n) => n.id === numeroNota);
          if (nota) {
            editor.setContent(nota.contenido);
            tituloActual = nota.titulo;
          }
        } catch (err) {
          console.error("Error inicializando editor o cargando notas:", err);
        }
      });
    },
  });

  // === BOTÓN GUARDAR ===
  document.getElementById("guardar").addEventListener("click", async () => {
    const contenido = tinymce.get("mi_editor").getContent().trim();
    const titulo = prompt("Ingrese un título:", tituloActual) || "Sin título";
    await guardarNotaDrive(numeroNota, titulo, contenido);
  });

  // === BOTÓN ELIMINAR ===
  document.getElementById("eliminar").addEventListener("click", async () => {
    if (confirm("¿Seguro que deseas eliminar esta nota?")) {
      await eliminarNota(numeroNota);
      location.href = "index.html";
    }
  });
}
