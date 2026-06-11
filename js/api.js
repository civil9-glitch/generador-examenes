const Api = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  BATCH_SIZE: 8,
  MAX_RETRIES: 5,
  RETRY_DELAYS: [5000, 15000, 30000, 60000, 120000],

  SCHEMA: {
    type: 'object',
    properties: {
      examTitle: { type: 'string' },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic:             { type: 'string' },
            text:              { type: 'string' },
            hint:              { type: 'string' },
            options:           { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
            correct:           { type: 'array', items: { type: 'integer' } },
            explanation:       { type: 'string' },
            wrongExplanation:  { type: 'string' },
            source:            { type: 'string' }
          },
          required: ['topic','text','hint','options','correct','explanation','wrongExplanation','source']
        }
      }
    },
    required: ['examTitle','questions']
  },

  buildPrompt(text, numQ, batchNote) {
    return `Sos profesor universitario. Generá exactamente ${numQ} preguntas de opción múltiple basadas en este texto.${batchNote}

TEXTO:
${text}

REGLAS:
- Cada pregunta tiene exactamente 5 opciones
- Alternará entre 1 y 2 respuestas correctas
- "correct" contiene los índices (0-4) de las opciones correctas
- Si hay 1 correcta: hint = "1 respuesta correcta"
- Si hay 2 correctas: hint = "2 respuestas correctas"
- explanation: máximo 20 palabras
- wrongExplanation: máximo 20 palabras
- source: nombre de la sección del texto
- Generá exactamente ${numQ} preguntas`;
  },

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  isRetryable(msg, status) {
    return (
      status === 429 || status === 503 ||
      (msg && (
        msg.includes('high demand') ||
        msg.includes('overload') ||
        msg.includes('quota') ||
        msg.includes('429') ||
        msg.includes('503')
      ))
    );
  },

  async callGemini(apiKey, prompt, numQ, onRetry) {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      let res, data;
      try {
        res = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
              responseSchema: this.SCHEMA
            }
          })
        });

        data = await res.json();

        if (data.error) {
          const msg = data.error.message || '';
          if (this.isRetryable(msg, res.status) && attempt < this.MAX_RETRIES) {
            if (onRetry) onRetry(attempt + 1, this.MAX_RETRIES, this.RETRY_DELAYS[attempt]);
            await this.sleep(this.RETRY_DELAYS[attempt]);
            continue;
          }
          throw new Error(msg || 'Error de API');
        }

        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) throw new Error('Respuesta vacía de la API');

        const parsed = JSON.parse(raw);
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new Error('Estructura JSON inválida');
        }
        return parsed;

      } catch (err) {
        if (this.isRetryable(err.message, res?.status) && attempt < this.MAX_RETRIES) {
          if (onRetry) onRetry(attempt + 1, this.MAX_RETRIES, this.RETRY_DELAYS[attempt]);
          await this.sleep(this.RETRY_DELAYS[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error('Servidor saturado después de varios intentos. Intentá más tarde.');
  },

  async generateQuestions(apiKey, text, numQ, onRetry, onBatchProgress) {
    const totalBatches = Math.ceil(numQ / this.BATCH_SIZE);

    if (numQ <= this.BATCH_SIZE) {
      return await this.callGemini(apiKey, this.buildPrompt(text, numQ, ''), numQ, onRetry);
    }

    let allQuestions = [];
    let examTitle = '';
    let remaining = numQ;
    let batchNum = 1;

    while (remaining > 0) {
      const size = Math.min(remaining, this.BATCH_SIZE);
      if (onBatchProgress) onBatchProgress(batchNum, totalBatches);
      const note = ` LOTE ${batchNum}/${totalBatches}: usá temas distintos a los lotes anteriores.`;
      const parsed = await this.callGemini(apiKey, this.buildPrompt(text, size, note), size, onRetry);
      if (!examTitle && parsed.examTitle) examTitle = parsed.examTitle;
      allQuestions = [...allQuestions, ...(parsed.questions || [])];
      remaining -= size;
      batchNum++;
    }

    return { examTitle, questions: allQuestions };
  }
};
