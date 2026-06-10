const Results = {
  show(exam) {
    const finalScore = Math.round(exam.earnedPts);
    Storage.saveHistory({
      title: exam.title,
      date: new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      score: finalScore,
      numQ: exam.questions.length,
      timerSecs: exam.timerSecs
    });

    App.showScreen('results');

    const correct = exam.results.filter(r => r.correct).length;
    const wrong = exam.results.filter(r => !r.correct && !r.timeout).length;
    const timeouts = exam.results.filter(r => r.timeout).length;
    const nota = finalScore >= 70 ? '✓ Aprobado' : finalScore >= 40 ? '— Regular' : '✗ Insuficiente';
    const notaColor = finalScore >= 70 ? '#1D9E75' : finalScore >= 40 ? '#BA7517' : '#D85A30';

    const topicMap = {};
    exam.questions.forEach(q => {
      const t = q.topic || 'General';
      if (!topicMap[t]) topicMap[t] = { earned: 0, max: 0 };
      topicMap[t].max += q.pts;
    });
    exam.results.forEach((r, i) => {
      topicMap[exam.questions[i].topic || 'General'].earned += r.earned;
    });
    const topicNames = Object.keys(topicMap);
    const topicPcts = topicNames.map(t => Math.round((topicMap[t].earned / topicMap[t].max) * 100));
    const barColors = topicPcts.map(p => p >= 70 ? '#1D9E75' : p >= 40 ? '#EF9F27' : '#D85A30');
    const barBorders = topicPcts.map(p => p >= 70 ? '#0F6E56' : p >= 40 ? '#BA7517' : '#993C1D');

    const rows = exam.results.map((r, i) => {
      const q = exam.questions[i];
      const tag = r.timeout
        ? '<span class="tag tag-timeout">Tiempo</span>'
        : r.correct
          ? '<span class="tag tag-ok">Correcta</span>'
          : '<span class="tag tag-wrong">Incorrecta</span>';
      const ans = r.correct
        ? ''
        : `<div style="margin-top:3px;color:#993C1D;font-size:11px;">→ ${q.correct.map(j => q.options[j]).join(' / ')}</div>`;
      return `<tr>
        <td style="width:24px;color:#9e9e9e">${i + 1}</td>
        <td><div>${q.text.substring(0, 65)}${q.text.length > 65 ? '…' : ''}</div>${ans}</td>
        <td style="text-align:center">${tag}</td>
        <td style="text-align:right;white-space:nowrap">${parseFloat(r.earned).toFixed(1)}/${parseFloat(r.max).toFixed(1)}</td>
      </tr>`;
    }).join('');

    document.getElementById('results-content').innerHTML = `
      <div class="results-header">
        <h2>Resultados del examen</h2>
        <p>${exam.title} · ${exam.questions.length} preguntas · ${exam.timerSecs}s c/u</p>
      </div>

      <div class="metrics-grid">
        <div class="metric"><div class="metric-label">Puntaje</div><div class="metric-value">${finalScore}/100</div></div>
        <div class="metric"><div class="metric-label">Correctas</div><div class="metric-value">${correct}/${exam.questions.length}</div></div>
        <div class="metric"><div class="metric-label">Incorrectas</div><div class="metric-value">${wrong}</div></div>
        <div class="metric"><div class="metric-label">Condición</div><div class="metric-value" style="font-size:13px;color:${notaColor}">${nota}</div></div>
      </div>

      <div class="btn-row">
        <button class="btn-primary" onclick="App.restartExam()">↺ Repetir examen</button>
        <button class="btn-secondary" onclick="App.backHome()">← Nuevo PDF</button>
      </div>

      <div class="chart-card" style="margin-top:1rem">
        <h3>Distribución de respuestas</h3>
        <div class="legend">
          <span><span class="swatch" style="background:#1D9E75"></span>Correctas (${correct})</span>
          <span><span class="swatch" style="background:#D85A30"></span>Incorrectas (${wrong})</span>
          <span><span class="swatch" style="background:#EF9F27"></span>Tiempo agotado (${timeouts})</span>
        </div>
        <div style="position:relative;width:100%;height:200px">
          <canvas id="chart-global" role="img" aria-label="Distribución de respuestas"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h3>Desempeño por tema</h3>
        <div class="legend">
          <span><span class="swatch" style="background:#1D9E75"></span>≥70% aprobado</span>
          <span><span class="swatch" style="background:#EF9F27"></span>40–69% regular</span>
          <span><span class="swatch" style="background:#D85A30"></span>&lt;40% insuficiente</span>
        </div>
        <div style="position:relative;width:100%;height:${Math.max(260, topicNames.length * 44 + 80)}px">
          <canvas id="chart-topics" role="img" aria-label="Desempeño por tema"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h3>Revisión pregunta por pregunta</h3>
        <table class="review-table">
          <thead><tr><th>#</th><th>Pregunta</th><th style="text-align:center">Estado</th><th style="text-align:right">Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    new Chart(document.getElementById('chart-global'), {
      type: 'doughnut',
      data: {
        labels: ['Correctas', 'Incorrectas', 'Tiempo agotado'],
        datasets: [{
          data: [correct, wrong, timeouts],
          backgroundColor: ['#1D9E75', '#D85A30', '#EF9F27'],
          borderColor: ['#0F6E56', '#993C1D', '#BA7517'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    new Chart(document.getElementById('chart-topics'), {
      type: 'bar',
      data: {
        labels: topicNames,
        datasets: [{
          data: topicPcts,
          backgroundColor: barColors,
          borderColor: barBorders,
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { min: 0, max: 100, ticks: { callback: v => v + '%', autoSkip: false } },
          y: { ticks: { font: { size: 11 } } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
};
