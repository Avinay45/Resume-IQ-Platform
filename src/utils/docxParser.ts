import JSZip from 'jszip';

/**
 * Extracts plain text from a DOCX File object.
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXmlPath = 'word/document.xml';
    
    if (!zip.files[documentXmlPath]) {
      throw new Error('Not a valid DOCX file (missing word/document.xml)');
    }
    
    const xmlText = await zip.files[documentXmlPath].async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    
    // Check for XML parsing errors
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      throw new Error('Failed to parse internal XML document structure.');
    }
    
    // Extract all text content from <w:t> tags
    const textNodes = xmlDoc.getElementsByTagName('w:t');
    let fullText = '';
    
    for (let i = 0; i < textNodes.length; i++) {
      // Add a space to separate words, but keep formatting somewhat readable
      fullText += (textNodes[i].textContent || '') + ' ';
    }
    
    // Standardize spacing and normalize characters
    const cleanText = fullText
      .replace(/\s+/g, ' ')
      .trim();
      
    if (!cleanText) {
      throw new Error('DOCX document appears to be empty.');
    }
    
    return cleanText;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to parse DOCX resume.');
  }
}
