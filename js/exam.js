const Exam = {
  questions: [],
  currentQ: 0,
  earnedPts: 0,
  timerSecs: 60,
  timerInterval: null,
  timeLeft: 0,
  answered: false,
  results: [],
  title: '',

  init(questions, title, timerSecs) {
    this.questions = questions;
    this.title = title;
    this.timerSecs = timerSecs;
    this.currentQ = 0;
    this.earnedPts = 0;
    this.answered = false;
    this.results = [];

    const ptsEach = parseFloat((100 / questions.length).toFixed(2));
    this.questions = questions.map(q => ({ ...q, pts: ptsEach }));
  },

  start() {
    App.showScreen('exam');
    document.getElementById('exam-title-display').textContent = this.title;
    document.getElementById('exam-meta-display').textContent =
      `${this.questions.length} preguntas · ${this.timerSecs}s por pregunta`;
    this.buildDots();
    this.renderQuestion();
  },

  buildDots() {
    const row = document.getElementById('dots-row');
    row.innerHTML = this.questions
      .map((_, i) => `<div class="dot" id="dot-${i}">${i + 1}</div>`)
      .join('');
  },

  setDot(i, cls) {
    const d = document.getElementById(`dot-${i}`);
    if (d) d.className = `dot ${cls}`;
  },

  renderQuestion() {
    this.answered = false;
    this.timeLeft = this.timerSecs;
    const q = this.questions[this.currentQ];
    document.getElementById('score-display').textContent =
      Math.round(this.earnedPts) + ' / 100';
    this.setDot(this.currentQ, 'active');

    const multi = q.correct.length > 1;
    const inputType = multi ? 'checkbox' : 'radio';

    document.getElementById('question-area').innerHTML = `
      <div class="q-card">
        <div class="q-meta">
          <span class="topic-badge">${q.topic || 'General'}</span>
          <span class="q-pts">${parseFloat(q.pts).toFixed(1)} pts</span>
        </div>
        <div class="q-num">Pregunta ${this.currentQ + 1} de ${this.questions.length}</div>
        <p class="q-text">${q.text}</p>
        <p class="q-hint">${q.hint}</p>
        <div class="timer-row">
          <span class="timer-num" id="timer-num">${this.timerSecs}</span>
          <div class="timer-track">
            <div class="timer-fill" id="timer-fill" style="width:100%;background:#534AB7"></div>
          </div>
        </div>
        <div class="sel-counter" id="sel-counter">
          Seleccioná ${multi ? q.correct.length + ' opciones' : '1 opción'}
        </div>
        <div class="options">
          ${q.options.map((o, i) => `
            <label class="opt-lbl" id="opt-${i}">
              <input type="${inputType}" name="q_opts" id="inp-${i}" onchange="Exam.updateCounter()">
              ${o}
            </label>
          `).join('')}
        </div>
        <button class="btn-confirm" id="btn-confirm" onclick="Exam.confirm()" disabled>
          Confirmar respuesta
        </button>
      </div>
    `;
    this.startTimer();
  },

  updateCounter() {
    const q = this.questions[this.currentQ];
    const sel = this.getSelected();
    const n = q.correct.length;
    const ctr = document.getElementById('sel-counter');
    const btn = document.getElementById('btn-confirm');
    if (sel.length === n) {
      ctr.textContent = `✓ ${n} opción${n > 1 ? 'es' : ''} seleccionada${n > 1 ? 's' : ''}`;
      ctr.className = 'sel-counter ready';
      btn.disabled = false;
    } else {
      ctr.textContent = `${sel.length} de ${n} opción${n > 1 ? 'es' : ''} seleccionada${sel.length !== 1 ? 's' : ''}`;
      ctr.className = 'sel-counter';
      btn.disabled = true;
    }
  },

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      const tn = document.getElementById('timer-num');
      const tf = document.getElementById('timer-fill');
      if (!tn) { clearInterval(this.timerInterval); return; }
      tn.textContent = this.timeLeft;
      tf.style.width = Math.round((this.timeLeft / this.timerSecs) * 100) + '%';
      if (this.timeLeft <= Math.floor(this.timerSecs * 0.15)) {
        tn.className = 'timer-num urgent';
        tf.style.background = '#D85A30';
      } else if (this.timeLeft <= Math.floor(this.timerSecs * 0.33)) {
        tn.className = 'timer-num warn';
        tf.style.background = '#EF9F27';
      }
      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        if (!this.answered) this.timeout();
      }
    }, 1000);
  },

  getSelected() {
    const sel = [];
    this.questions[this.currentQ].options.forEach((_, i) => {
      const inp = document.getElementById(`inp-${i}`);
      if (inp && inp.checked) sel.push(i);
    });
    return sel;
  },

  confirm() {
    if (this.answered) return;
    clearInterval(this.timerInterval);
    this.answered = true;
    const sel = this.getSelected();
    if (!sel.length) { this.timeout(); return; }
    this.processAnswer(sel, false);
  },

  timeout() {
    this.answered = true;
    clearInterval(this.timerInterval);
    this.processAnswer([], true);
  },

  processAnswer(sel, isTimeout) {
    const q = this.questions[this.currentQ];
    const cs = new Set(q.correct);
    const ss = new Set(sel);
    const ok = !isTimeout && q.correct.length === sel.length && q.correct.every(c => ss.has(c));
    const pts = ok ? q.pts : 0;
    if (ok) this.earnedPts += pts;

    this.results.push({
      topic: q.topic || 'General',
      earned: pts, max: q.pts,
      correct: ok, timeout: isTimeout
    });

    this.setDot(this.currentQ, isTimeout ? 'timeout' : ok ? 'ok' : 'wrong');

    q.options.forEach((_, i) => {
      const lbl = document.getElementById(`opt-${i}`);
      const inp = document.getElementById(`inp-${i}`);
      if (inp) inp.disabled = true;
      lbl.classList.add('dis');
      if (cs.has(i) && ss.has(i)) lbl.classList.add('correct');
      else if (!cs.has(i) && ss.has(i)) lbl.classList.add('wrong');
      else if (cs.has(i) && !ss.has(i)) lbl.classList.add('missed');
    });

    document.getElementById('btn-confirm').style.display = 'none';
    document.getElementById('sel-counter').style.display = 'none';

    const fbClass = isTimeout ? 'timeout' : ok ? 'correct' : 'wrong';
    const fbTitle = isTimeout
      ? '⏱ Tiempo agotado — 0 pts'
      : ok
        ? `✓ ¡Correcto! +${parseFloat(pts).toFixed(1)} pts`
        : '✗ Incorrecto — 0 pts';
    const correctLabels = q.correct.map(i => `<em>${q.options[i]}</em>`).join(' / ');

    document.getElementById('question-area').insertAdjacentHTML('beforeend', `
      <div class="fb-box ${fbClass}">
        <div class="fb-title">${fbTitle}</div>
        ${ok
          ? q.explanation
          : `<strong>Respuesta correcta:</strong> ${correctLabels}<br><br>${q.explanation}`
        }
        ${!ok && q.wrongExplanation
          ? `<div class="why-wrong"><strong>¿Por qué las otras son incorrectas?</strong><br>${q.wrongExplanation}</div>`
          : ''
        }
        ${q.source ? `<div class="src-note">📖 ${q.source}</div>` : ''}
      </div>
      <button class="btn-next" onclick="Exam.next()">
        ${this.currentQ < this.questions.length - 1 ? 'Siguiente pregunta →' : 'Ver resultados →'}
      </button>
    `);

    document.getElementById('score-display').textContent =
      Math.round(this.earnedPts) + ' / 100';
  },

  next() {
    this.currentQ++;
    if (this.currentQ >= this.questions.length) {
      Results.show(this);
    } else {
      this.renderQuestion();
    }
  }
};
