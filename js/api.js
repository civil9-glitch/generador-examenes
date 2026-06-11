const Api = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

  buildPrompt(text, numQ, batchNote) {
    return `Sos un profesor universitario. Generá exactamente ${numQ} preguntas de opción múltiple para examen universitario basadas en este texto.${batchNote}

TEXTO:
${text}

REGLAS ESTRICTAS:
- Exactamente 5 opciones por pregunta
- Alternará 1 y 2 respuestas correctas
- Cubrí distintos temas
- Opciones incorrectas plausibles
- "explanation" y "wrongExplanation": máximo 1 oración cada una (breve y concisa)
- "source": solo el nombre de la sección, sin descripción
- Respondé SOLO con JSON válido, sin markdown, sin texto extra

FORMATO:
{"examTitle":"título","questions":[{"topic":"tema","text":"pregunta","hint":"1 respuesta correcta","options":["op1","op2","op3","op4","op5"],"correct":[0],"explanation":"explicación breve","wrongExplanation":"por qué las otras son incorrectas (breve)","source":"sección"}]}

- correct: array de índices 0-4
- Para 2 correctas: hint="2 respuestas correctas", correct=[i,j]
- Generá exactamente ${numQ} preguntas`;
  },

  async callGemini(apiKey, prompt) {
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
    if (data.error) throw new Error(data.error.message || 'Error de API');

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) throw new Error('Respuesta vacía de la API');

    const clean = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('La API no devolvió JSON válido');

    return JSON.parse(jsonMatch[0]);
  },

  async generateQuestions(apiKey, text, numQ, batchNote = '') {
    // Para evitar JSON cortado: máximo 15 preguntas por llamada
    const BATCH_SIZE = 15;

    if (numQ <= BATCH_SIZE) {
      const parsed = await this.callGemini(apiKey, this.buildPrompt(text, numQ, batchNote));
      return parsed;
    }

    // Dividir en lotes de máximo 15
    const batches = [];
    let remaining = numQ;
    let batchNum = 1;
    const totalBatches = Math.ceil(numQ / BATCH_SIZE);

    while (remaining > 0) {
      const size = Math.min(remaining, BATCH_SIZE);
      batches.push({ size, num: batchNum, total: totalBatches });
      remaining -= size;
      batchNum++;
    }

    let allQuestions = [];
    let examTitle = '';

    for (const batch of batches) {
      const note = ` LOTE ${batch.num} DE ${batch.total}: generá preguntas sobre temas distintos a los lotes anteriores.`;
      const parsed = await this.callGemini(apiKey, this.buildPrompt(text, batch.size, note));
      if (!examTitle && parsed.examTitle) examTitle = parsed.examTitle;
      allQuestions = [...allQuestions, ...(parsed.questions || [])];
    }

    return { examTitle, questions: allQuestions };
  }
};
