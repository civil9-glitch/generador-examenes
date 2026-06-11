const Api = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  BATCH_SIZE: 10,
  MAX_RETRIES: 5,
  RETRY_DELAYS: [5000, 15000, 30000, 60000, 120000],

  buildPrompt(text, numQ, batchNote) {
    return `Sos profesor universitario. Generá exactamente ${numQ} preguntas de opción múltiple basadas en este texto.${batchNote}

TEXTO:
${text}

REGLAS:
- 5 opciones por pregunta
- Alternará 1 y 2 respuestas correctas
- explanation: máximo 15 palabras
- wrongExplanation: máximo 15 palabras
- source: máximo 4 palabras
- Respondé SOLO con JSON, sin markdown

FORMATO (seguilo exactamente):
{"examTitle":"título","questions":[{"topic":"tema","text":"pregunta","hint":"1 respuesta correcta","options":["a","b","c","d","e"],"correct":[0],"explanation":"breve","wrongExplanation":"breve","source":"sección"}]}

correct: índices 0-4. Para 2 correctas: hint="2 respuestas correctas", correct=[i,j]
Generá exactamente ${numQ} preguntas.`;
  },

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  async callGemini(apiKey, prompt, onRetry) {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 8192
            }
          })
        });

        const data = await res.json();

        if (data.error) {
          const msg = data.error.message || '';
          const retryable = msg.includes('high demand') || msg.includes('overload') ||
            msg.includes('quota') || res.status === 429 || res.status === 503;
          if (retryable && attempt < this.MAX_RETRIES) {
            if (onRetry) onRetry(attempt + 1, this.MAX_RETRIES, this.RETRY_DELAYS[attempt]);
            await this.sleep(this.RETRY_DELAYS[attempt]);
            continue;
          }
          throw new Error(msg || 'Error de API');
        }

        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!raw) throw new Error('Respuesta vacía');

        const cleaned = raw.replace(/```json|```/g, '').trim();

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON no encontrado en la respuesta');

        let jsonStr = jsonMatch[0];

        try {
          return JSON.parse(jsonStr);
        } catch(parseErr) {
          jsonStr = this.repairJSON(jsonStr);
          try {
            return JSON.parse(jsonStr);
          } catch(e2) {
            throw new Error('JSON inválido: ' + parseErr.message);
          }
        }

      } catch (err) {
        const retryable = err.message && (
          err.message.includes('high demand') || err.message.includes('overload') ||
          err.message.includes('503') || err.message.includes('429')
        );
        if (retryable && attempt < this.MAX_RETRIES) {
          if (onRetry) onRetry(attempt + 1, this.MAX_RETRIES, this.RETRY_DELAYS[attempt]);
          await this.sleep(this.RETRY_DELAYS[attempt]);
          continue;
        }
        throw err;
      }
    }
    throw new Error('Servidor saturado. Intentá de nuevo más tarde.');
  },

  repairJSON(str) {
    // Intentar cerrar un JSON truncado
    let depth = 0;
    let inString = false;
    let escaped = false;
    let lastValidPos = 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') depth++;
      if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) lastValidPos = i;
      }
    }

    // Cerrar estructuras abiertas
    let repaired = str;

    // Eliminar trailing comma o elemento incompleto antes de cerrar
    repaired = repaired.replace(/,\s*$/, '');
    repaired = repaired.replace(/,\s*\]/, ']');

    // Contar llaves y corchetes para cerrar lo que falta
    let opens = { '{': 0, '[': 0 };
    let inStr = false;
    let esc = false;
    for (const ch of repaired) {
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') opens['{']++;
      if (ch === '}') opens['{']--;
      if (ch === '[') opens['[']++;
      if (ch === ']') opens['[']--;
    }

    // Cerrar lo que falte
    for (let i = 0; i < opens['['] ; i++) repaired += ']';
    for (let i = 0; i < opens['{'] ; i++) repaired += '}';

    return repaired;
  },

  async generateQuestions(apiKey, text, numQ, onRetry, onBatchProgress) {
    const totalBatches = Math.ceil(numQ / this.BATCH_SIZE);

    if (numQ <= this.BATCH_SIZE) {
      return await this.callGemini(apiKey, this.buildPrompt(text, numQ, ''), onRetry);
    }

    let allQuestions = [];
    let examTitle = '';
    let remaining = numQ;
    let batchNum = 1;

    while (remaining > 0) {
      const size = Math.min(remaining, this.BATCH_SIZE);
      if (onBatchProgress) onBatchProgress(batchNum, totalBatches);
      const note = ` LOTE ${batchNum}/${totalBatches}: temas distintos a los anteriores.`;
      const parsed = await this.callGemini(apiKey, this.buildPrompt(text, size, note), onRetry);
      if (!examTitle && parsed.examTitle) examTitle = parsed.examTitle;
      allQuestions = [...allQuestions, ...(parsed.questions || [])];
      remaining -= size;
      batchNum++;
    }

    return { examTitle, questions: allQuestions };
  }
};
