// === CONFIGURACIÓN GOOGLE DRIVE ===
// === CONFIGURACIÓN GOOGLE DRIVE ===
const CLIENT_ID = "918822233973-jncnde1k79lhs4qllfhtutokuqua5ded.apps.googleusercontent.com"; // 👈 Pega tu ID de cliente OAuth 2.0
const API_KEY = "AIzaSyCVxpJ3TGmDJ5kKYzalkYdQOzIXcmLUgfg"; // 👈 Pega tu clave de API
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// === INICIALIZAR AUTENTICACIÓN GOOGLE ===
async function initGoogleAPI() {
  return new Promise((resolve, reject) => {
    gapi.load("client:auth2", async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          discoveryDocs: DISCOVERY_DOCS,
          scope: SCOPES,
        });

        const auth = gapi.auth2.getAuthInstance();

        if (!auth.isSignedIn.get()) {
          console.log("🔐 Iniciando sesión con Google...");
          await auth.signIn();
        }

        const user = auth.currentUser.get();
        const token = user.getAuthResponse().access_token;

        if (!token) throw new Error("❌ Token no recibido. Verifica tu configuración OAuth.");

        console.log("✅ Usuario autenticado:", user.getBasicProfile().getEmail());
        resolve();
      } catch (err) {
        console.error("⚠️ Error iniciando sesión en Google:", err);
        alert("Error al iniciar sesión con Google. Revisa permisos en la consola.");
        reject(err);
      }
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
  const tokenData = gapi.auth.getToken();
  if (!tokenData || !tokenData.access_token) {
    console.error("⚠️ No hay token de acceso disponible. Intenta iniciar sesión nuevamente.");
    alert("No se pudo conectar con Google Drive. Revisa permisos o recarga la página.");
    return;
  }

  const accessToken = tokenData.access_token;
  const body = JSON.stringify(data);

  try {
    if (!fileId) {
      console.log("📤 Creando archivo notes.json en Drive...");
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
      console.log("✅ Archivo creado con ID:", info.id);
    } else {
      console.log("📤 Actualizando archivo notes.json existente en Drive...");
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + accessToken },
        body,
      });
      console.log("✅ Archivo actualizado correctamente.");
    }
  } catch (error) {
    console.error("❌ Error subiendo archivo a Drive:", error);
  }
}

async function descargarArchivoDrive() {
  const fileId = localStorage.getItem("driveFileId");
  if (!fileId) return null;

  const tokenData = gapi.auth.getToken();
  if (!tokenData || !tokenData.access_token) {
    console.error("⚠️ No hay token de acceso disponible.");
    return null;
  }

  const accessToken = tokenData.access_token;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!res.ok) throw new Error("Error descargando archivo desde Drive.");
    console.log("✅ Archivo descargado desde Drive correctamente.");
    return await res.json();
  } catch (error) {
    console.error("❌ Error al descargar archivo:", error);
    return null;
  }
}

// === SINCRONIZACIÓN PRINCIPAL ===
async function cargarNotas() {
  let notes = getLocalNotes();

  if (navigator.onLine) {
    console.log("🌐 Conectado: sincronizando con Google Drive...");
    const online = await descargarArchivoDrive();
    if (online) {
      notes = online;
      saveLocalNotes(notes);
    } else {
      console.log("📁 No se encontró archivo en Drive, creando nuevo...");
      await subirArchivoDrive(null, notes);
    }
  } else {
    console.log("📴 Modo offline: usando notas locales.");
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
  } else {
    console.log("📴 Sin conexión: se guardará localmente y se subirá al reconectarse.");
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
          console.log(`📝 Cargando nota #${numeroNota}: "${tituloActual}"`);
        } else {
          console.log(`📄 Nueva nota #${numeroNota}`);
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

