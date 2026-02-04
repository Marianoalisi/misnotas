// ================================
// UTILIDADES
// ================================
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  const value = parseInt(urlParams.get(param));
  return isNaN(value) ? null : value;
}

function getLocalNotes() {
  const saved = localStorage.getItem("notes");
  return saved ? JSON.parse(saved) : { notas: [] };
}

function saveLocalNotes(data) {
  localStorage.setItem("notes", JSON.stringify(data));
}

// ================================
// NOTAS (LOCAL)
// ================================
function cargarNotas() {
  return getLocalNotes().notas;
}

function guardarNota(id, titulo, contenido) {
  const data = getLocalNotes();

  if (id == null) {
    id = Date.now();
  }

  const existente = data.notas.find(n => n.id === id);

  const nota = {
    id,
    titulo,
    contenido,
    fecha: new Date().toISOString()
  };

  if (existente) {
    Object.assign(existente, nota);
  } else {
    data.notas.push(nota);
  }

  saveLocalNotes(data);
  return id;
}

function eliminarNota(id) {
  if (!id) return;

  const data = getLocalNotes();
  data.notas = data.notas.filter(n => n.id !== id);
  saveLocalNotes(data);

  alert("Nota eliminada 🗑️");
  location.href = "index.html";
}

// ================================
// INICIALIZAR EDITOR
// ================================
let numeroNota = getQueryParam("cargar");
let tituloActual = "";

if (document.getElementById("mi_editor")) {

  // si es nota nueva → crear ID y fijarlo en la URL
  if (!numeroNota) {
    numeroNota = Date.now();
    history.replaceState(null, "", `interfaz.html?cargar=${numeroNota}`);
  }

  tinymce.init({
    selector: "#mi_editor",
    plugins: "lists link emoticons advlist",
    toolbar_mode: "floating",
    toolbar: "undo redo | bold italic underline | bullist numlist | link | emoticons",
    setup(editor) {
      editor.on("init", () => {
        const nota = cargarNotas().find(n => n.id === numeroNota);
        if (nota) {
          editor.setContent(nota.contenido);
          tituloActual = nota.titulo || "";
        }
      });
    }
  });

  document.getElementById("guardar").addEventListener("click", () => {
    const contenido = tinymce.get("mi_editor").getContent().trim();

    const titulo = prompt(
      "Ingrese un título:",
      tituloActual || "Sin título"
    );

    if (titulo === null) return;

    tituloActual = titulo;
    guardarNota(numeroNota, tituloActual, contenido);

    alert("Nota guardada ✅");
  });

  document.getElementById("eliminar")?.addEventListener("click", () => {
    if (confirm("¿Seguro que deseas eliminar esta nota?")) {
      eliminarNota(numeroNota);
    }
  });
}

// ================================
// MICRÓFONO Y TRANSCRIPCIÓN
// ================================
let recognition;
let grabando = false;
let ultimoResultado = Date.now();
const PAUSA_MS = 3000;

function initMicrofono() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Tu navegador no soporta reconocimiento de voz 😕");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "es-AR";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = function (event) {
    let textoFinal = "";

    const ahora = Date.now();
    const huboPausa = ahora - ultimoResultado > PAUSA_MS;
    ultimoResultado = ahora;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        textoFinal += event.results[i][0].transcript + " ";
      }
    }

    if (textoFinal) {
      const editor = tinymce.get("mi_editor");

      if (huboPausa) {
        editor.execCommand(
          "mceInsertContent",
          false,
          "<p><strong>— Intervención —</strong></p>"
        );
      }

      editor.execCommand("mceInsertContent", false, textoFinal);
    }
  };

  recognition.onend = () => {
    if (grabando) recognition.start();
  };
}

document.getElementById("microfono")?.addEventListener("click", () => {
  if (!recognition) initMicrofono();

  const btn = document.getElementById("microfono");

  if (!grabando) {
    recognition.start();
    grabando = true;
    btn.innerText = "⏹ Detener";
    btn.classList.add("grabando");
  } else {
    recognition.stop();
    grabando = false;
    btn.innerText = "🎤 Grabar";
    btn.classList.remove("grabando");
  }
});
