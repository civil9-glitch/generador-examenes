const App = {
  extractedText: '',
  pdfName: '',
  examQuestions: [],
  examTitle: '',

  init() {
    const savedKey = Storage.loadKey();
    if (savedKey) document.getElementById('api-key').value = savedKey;
    this.renderHistory();
    this.showScreen('config');
  },

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
    window.scrollTo(0, 0);
  },

  showStatus(msg, type, loading = false) {
    const bar = document.getElementById('status-config');
    if (!bar) return;
    bar.className = `status-bar show ${type}`;
    bar.innerHTML = (loading ? '<span class="spinner"></span>' : '') + msg;
  },

  hideStatus() {
    const bar = document.getElementById('status-config');
    if (bar) { bar.className = 'status-bar'; bar.innerHTML = ''; }
  },

  renderHistory() {
    const hist = Storage.loadHistory();
    const list = document.getElementById('history-list');
    if (!list) return;
    if (!hist.length) {
      list.innerHTML = '<div class="hist-empty">Todavía no hay exámenes realizados.</div>';
      return;
    }
    list.innerHTML = hist.map(h => {
      const color = h.score >= 70 ? '#1D9E75' : h.score >= 40 ? '#BA7517' : '#D85A30';
      return `<div class="hist-item">
        <div>
          <div class="hist-title">${h.title}</div>
          <div class="hist-meta">${h.date} · ${h.numQ} preguntas · ${h.timerSecs}s c/u</div>
        </div>
        <div class="hist-score" style="color:${color}">${h.score}/100</div>
      </div>`;
    }).join('');
  },

  async handleFile(event) {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.pdf')) {
      this.showStatus('Solo se aceptan archivos .pdf', 'error');
      return;
    }
    this.pdfName = file.name.replace(/\.pdf$/i, '');
    this.showStatus('Extrayendo texto del PDF...', 'info', true);

    try {
      const result = await PdfExtractor.extract(file);
      if (!result.text || result.text.length < 200) {
        this.showStatus('No se pudo extraer texto. El PDF puede ser escaneado o estar protegido.', 'error');
        return;
      }
      this.extractedText = result.text.substring(0, 14000);

      document.getElementById('upload-zone').classList.add('has-file');
      document.getElementById('upload-text').textContent = file.name;
      document.getElementById('upload-text').classList.add('ready');
      document.getElementById('upload-sub').textContent =
        `${result.pages} páginas · ~${result.tokensEstimate.toLocaleString()} tokens estimados`;
      document.getElementById('btn-generate').disabled = false;
      this.hideStatus();
    } catch (err) {
      this.showStatus('Error al leer el PDF: ' + err.message, 'error');
    }
  },

  async generateExam() {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) { this.showStatus('Ingresá tu API key de Gemini.', 'error'); return; }
    if (!this.extractedText) { this.showStatus('Subí un PDF primero.', 'error'); return; }

    if (document.getElementById('save-key').checked) {
      Storage.saveKey(apiKey);
    } else {
      Storage.removeKey();
    }

    const numQ = parseInt(document.getElementById('num-q').value);
    const timerSecs = parseInt(document.getElementById('timer-sel').value);

    document.getElementById('btn-generate').disabled = true;

    try {
      let allQuestions = [];
      let examTitle = this.pdfName;

      if (numQ <= 30) {
        this.showStatus(`Generando ${numQ} preguntas con Gemini...`, 'info', true);
        const parsed = await Api.generateQuestions(apiKey, this.extractedText, numQ);
        examTitle = parsed.examTitle || this.pdfName;
        allQuestions = parsed.questions || [];
      } else {
        const b1 = Math.floor(numQ / 2);
        const b2 = numQ - b1;
        this.showStatus(`Generando preguntas — lote 1 de 2...`, 'info', true);
        const p1 = await Api.generateQuestions(apiKey, this.extractedText, b1,
          ' LOTE 1/2: usá temas de la primera mitad del texto.');
        examTitle = p1.examTitle || this.pdfName;
        allQuestions = [...(p1.questions || [])];
        this.showStatus(`Generando preguntas — lote 2 de 2...`, 'info', true);
        const p2 = await Api.generateQuestions(apiKey, this.extractedText, b2,
          ' LOTE 2/2: usá temas distintos al lote 1, segunda mitad del texto.');
        allQuestions = [...allQuestions, ...(p2.questions || [])];
      }

      if (!allQuestions.length) throw new Error('No se recibieron preguntas');

      this.examQuestions = allQuestions.slice(0, numQ);
      this.examTitle = examTitle;

      this.showStatus(`✓ ${this.examQuestions.length} preguntas generadas. Iniciando...`, 'success');
      setTimeout(() => {
        Exam.init(this.examQuestions, this.examTitle, timerSecs);
        Exam.start();
      }, 700);

    } catch (err) {
      this.showStatus('Error: ' + err.message, 'error');
      document.getElementById('btn-generate').disabled = false;
    }
  },

  restartExam() {
    Exam.init(this.examQuestions, this.examTitle, Exam.timerSecs);
    Exam.start();
  },

  backHome() {
    this.extractedText = '';
    this.pdfName = '';
    this.examQuestions = [];
    document.getElementById('upload-zone').classList.remove('has-file');
    document.getElementById('upload-text').textContent = 'Hacé clic para subir un PDF';
    document.getElementById('upload-text').classList.remove('ready');
    document.getElementById('upload-sub').textContent = 'El texto se extrae localmente en tu navegador';
    document.getElementById('btn-generate').disabled = true;
    document.getElementById('file-input').value = '';
    this.hideStatus();
    this.renderHistory();
    this.showScreen('config');
  }
};

function toggleKey() {
  const inp = document.getElementById('api-key');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function handleFile(event) { App.handleFile(event); }
function generateExam() { App.generateExam(); }

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
  document.head.appendChild(script);
});
