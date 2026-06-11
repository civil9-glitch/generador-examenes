const Api = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  BATCH_SIZE: 15,
  MAX_RETRIES: 5,
  RETRY_DELAYS: [5000, 15000, 30000, 60000, 120000],

  buildPrompt(text, numQ, batchNote) {
    return `Sos un profesor universitario. Generá exactamente ${numQ} preguntas de opción múltiple para examen universitario basadas en este texto.${batchNote}

TEXTO:
${text}

REGLAS ESTRICTAS:
- Exactamente 5 opciones por pregunta
- Alternará 1 y 2 respuestas correctas
- Cubrí distintos temas
- Opciones incorrectas plausibles
- "explanation" y "wrongExplanation": máximo 1 oración cada una
- "source": solo el nombre de la sección
- Respondé SOLO con JSON válido, sin markdown, sin texto extra

FORMATO:
{"examTitle":"título","questions":[{"topic":"tema","text":"pregunta","hint":"1 respuesta correcta","options":["op1","op2","op3","op4","op5"],"correct":[0],"explanation":"explicación breve","wrongExplanation":"por qué las otras son incorrectas","source":"sección"}]}

- correct: array de índices 0-4
- Para 2 correctas: hint="2 respuestas correctas", correct=[i,j]
- Generá exactamente ${numQ} preguntas`;
  },

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  formatTime(ms) {
    if (ms < 60000) return `${Math.round(ms / 1000)} segundos`;
    return `${Math.round(ms / 60000)} minuto${ms >= 120000 ? 's' : ''}`;
  },

  async callGemini(apiKey, prompt, onRetry) {
    let lastError;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json'
            }
          })
        });

        const data = await response.json();

        if (data.error) {
          const msg = data.error.message || 'Error de API';
          const isRetryable =
            msg.includes('high demand') ||
            msg.includes('overloaded') ||
            msg.includes('quota') ||
            msg.includes('503') ||
            msg.includes('429') ||
            response.status === 429 ||
            response.status === 503;

          if (isRetryable && attempt < this.MAX_RETRIES) {
            const delay = this.RETRY_DELAYS[attempt];
            lastError = msg;
            if (onRetry) onRetry(attempt + 1, this.MAX_RETRIES, delay);
            await this.sleep(delay);
            continue;
          }
          throw new Error(msg);
        }

        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!raw) throw new Error('Respuesta vacía de la API');

        const clean = raw.replace(/```json|```/g, '').trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('La API no devolvió JSON válido');

        return JSON.parse(jsonMatch[0]);

      } catch (err) {
        if (err.message && (
          err.message.includes('high demand') ||
          err.message.includes('overloaded') ||
          err.message.includes('503') ||
          err.message.includes('429')
        ) && attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAYS[attempt];
          lastError = err.message;
          if (onRetry) onRetry(attempt + 1, this.MAX_RETRIES, delay);
          await this.sleep(delay);
          continue;
        }
        throw err;
      }
    }

    throw new Error(`Servidor saturado después de ${this.MAX_RETRIES} intentos. Intentá más tarde.`);
  },

  async generateQuestions(apiKey, text, numQ, onRetry, onBatchProgress) {
    if (numQ <= this.BATCH_SIZE) {
      const parsed = await this.callGemini(apiKey, this.buildPrompt(text, numQ, ''), onRetry);
      return parsed;
    }

    const totalBatches = Math.ceil(numQ / this.BATCH_SIZE);
    let allQuestions = [];
    let examTitle = '';
    let remaining = numQ;
    let batchNum = 1;

    while (remaining > 0) {
      const size = Math.min(remaining, this.BATCH_SIZE);
      if (onBatchProgress) onBatchProgress(batchNum, totalBatches);
      const note = ` LOTE ${batchNum} DE ${totalBatches}: temas distintos a lotes anteriores.`;
      const parsed = await this.callGemini(apiKey, this.buildPrompt(text, size, note), onRetry);
      if (!examTitle && parsed.examTitle) examTitle = parsed.examTitle;
      allQuestions = [...allQuestions, ...(parsed.questions || [])];
      remaining -= size;
      batchNum++;
    }

    return { examTitle, questions: allQuestions };
  }
};
