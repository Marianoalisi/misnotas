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

// === FUNCIONES PRINCIPALES ===
async function cargarNotas() {
  const notes = getLocalNotes();
  return notes.notas;
}

async function guardarNota(id, titulo, contenido) {
  const data = getLocalNotes();
  const existente = data.notas.find((n) => n.id === id);
  const nueva = { id, titulo, contenido, fecha: new Date().toISOString() };

  if (existente) Object.assign(existente, nueva);
  else data.notas.push(nueva);

  saveLocalNotes(data);
  alert("Nota guardada ✅");
}

async function eliminarNota(id) {
  const data = getLocalNotes();
  const idStr = String(id); // 🔒 aseguramos tipo string

  data.notas = data.notas.filter((n) => String(n.id) !== idStr);
  saveLocalNotes(data);
  alert("Nota eliminada 🗑️");
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
        const notas = await cargarNotas();
        const nota = notas.find((n) => n.id === numeroNota);
        if (nota) {
          editor.setContent(nota.contenido);
          tituloActual = nota.titulo;
        }
      });
    },
  });

  // === BOTÓN GUARDAR ===
  document.getElementById("guardar").addEventListener("click", async () => {
    const contenido = tinymce.get("mi_editor").getContent().trim();
    const titulo = prompt("Ingrese un título:", tituloActual) || "Sin título";
    await guardarNota(numeroNota, titulo, contenido);
  });

  // === BOTÓN ELIMINAR ===
  document.getElementById("eliminar").addEventListener("click", async () => {
    if (confirm("¿Seguro que deseas eliminar esta nota?")) {
      await eliminarNota(numeroNota);
      location.href = "index.html";
    }
  });
}

