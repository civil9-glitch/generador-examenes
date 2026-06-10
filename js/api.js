const Api = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',

  async generateQuestions(apiKey, text, numQ, batchNote = '') {
    const prompt = `Sos un profesor universitario experto. Leé el siguiente texto y generá exactamente ${numQ} preguntas de opción múltiple para un examen final universitario.${batchNote}

TEXTO DEL DOCUMENTO:
${text}

REGLAS:
- Cada pregunta debe tener exactamente 5 opciones
- Alternará entre preguntas de 1 respuesta correcta y 2 respuestas correctas
- Cubrí distintos temas del texto
- Opciones incorrectas plausibles, no obvias
- Respondé SOLO con JSON válido, sin texto antes ni después, sin markdown, sin backticks

FORMATO EXACTO:
{"examTitle":"título corto del documento","questions":[{"topic":"tema","text":"pregunta","hint":"1 respuesta correcta","options":["op1","op2","op3","op4","op5"],"correct":[0],"explanation":"por qué es correcta","wrongExplanation":"por qué las otras son incorrectas","source":"sección del texto"}]}

NOTAS:
- "correct": array de índices 0-4
- Para 2 correctas: hint="2 respuestas correctas", correct=[i,j]
- Generá exactamente ${numQ} preguntas en el array "questions"`;

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
      throw new Error(data.error.message || 'Error de API');
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) throw new Error('Respuesta vacía de la API');

    const clean = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('La API no devolvió JSON válido');

    return JSON.parse(jsonMatch[0]);
  }
};
