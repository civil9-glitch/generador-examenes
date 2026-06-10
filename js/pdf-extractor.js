const PdfExtractor = {
  async extract(file) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 80);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map(item => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    fullText = fullText.replace(/\s+/g, ' ').trim();

    return {
      text: fullText,
      pages: pdf.numPages,
      chars: fullText.length,
      tokensEstimate: Math.round(fullText.length / 4)
    };
  }
};
