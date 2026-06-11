const Api = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  BATCH_SIZE: 5,
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
            topic:       { type: 'string' },
            text:        { type: 'string' },
            hint:        { type: 'string' },
            options:     { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
            correct:     { type: 'array', items: { type: 'integer' } },
            explanation: { type: 'string' },
            source:      { type: 'string' }
          },
          required: ['topic','text','hint','options','correct','explanation','source']
        }
      }
    },
    required: ['examTitle','questions']
  },

  buildPrompt(text, numQ, batchNote) {
    return `Profesor universitario: generá ${numQ} preguntas de opción múltiple del siguiente texto.${batchNote}

TEXTO:
${text}

REGLAS:
- 5 opciones por pregunta (exacto)
- Alternará 1 y 2 respuestas correctas
- "correct": índices 0-4 de las opciones correctas
- hint: "1 respuesta correcta" o "2 respuestas correctas"
- explanation: máximo 12 palabras
- source: máximo 3 palabras
- Generá exactamente ${numQ} preguntas`;
  },

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  isRetryable(msg, status) {
    return status === 429 || status === 503 ||
      !!(msg && (msg.includes('high demand') || msg.includes('overload') ||
        msg.includes('quota') || msg.includes('429') || msg.includes('503')));
  },

  async callGemini(apiKey, prompt, onRetry) {
    let lastRes;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        lastRes = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
              responseSchema: this.SCHEMA
            }
          })
        });

        const data = await lastRes.json();

        if (data.error) {
          const msg = data.error.message || '';
          if (this.isRetryable(msg, lastRes.status) && attempt < this.MAX_RETRIES) {
            if (onRetry) onRetry(attempt + 1, this.MAX_RETRIES, this.RETRY_DELAYS[attempt]);
            await this.sleep(this.RETRY_DELAYS[attempt]);
            continue;
          }
          throw new Error(msg || 'Error de API');
        }

        const finishReason = data.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
          throw new Error('Respuesta cortada por límite de tokens. Recargá e intentá de nuevo.');
        }

        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) throw new Error('Respuesta vacía de la API');

        const parsed = JSON.parse(raw);
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new Error('Estructura JSON inválida');
        }
        return parsed;

      } catch (err) {
        if (this.isRetryable(err.message, lastRes?.status) && attempt < this.MAX_RETRIES) {
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
    let allQuestions = [];
    let examTitle = '';
    let remaining = numQ;
    let batchNum = 1;

    while (remaining > 0) {
      const size = Math.min(remaining, this.BATCH_SIZE);
      if (onBatchProgress) onBatchProgress(batchNum, totalBatches);
      const note = totalBatches > 1
        ? ` Lote ${batchNum}/${totalBatches}: temas distintos a los anteriores.`
        : '';
      const parsed = await this.callGemini(apiKey, this.buildPrompt(text, size, note), onRetry);
      if (!examTitle && parsed.examTitle) examTitle = parsed.examTitle;
      allQuestions = [...allQuestions, ...(parsed.questions || [])];
      remaining -= size;
      batchNum++;
    }

    return { examTitle, questions: allQuestions };
  }
};
