
import * as pdfjsLib from 'pdfjs-dist';
import { CompanyDocument, AustracUpdate } from './types'; // Import AustracUpdate if needed for future adaptation
import { RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP } from './constants.tsx';


// Type for the return of parseFileContent, adaptable for both CompanyDocument and AustracUpdate structures
export interface ParsedFileData {
  name: string;
  textContent: string;
  type: 'pdf' | 'txt' | 'generic'; // File type
  lastModified: number;
  size: number;
}

export const parseFileContent = async (file: File): Promise<ParsedFileData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        let textContent = '';
        let fileType: 'txt' | 'pdf' | 'generic' = 'generic';

        if (file.type === 'text/plain') {
          textContent = e.target?.result as string;
          fileType = 'txt';
        } else if (file.type === 'application/pdf') {
          fileType = 'pdf';
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContentPage = await page.getTextContent();
            textContent += textContentPage.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
          }
        } else {
          reject(new Error(`Unsupported file type: ${file.type}. Please upload PDF or TXT files.`));
          return;
        }
        
        resolve({
          name: file.name,
          textContent: textContent.trim(),
          type: fileType,
          lastModified: file.lastModified,
          size: file.size,
        });

      } catch (err) {
        console.error('Error parsing file:', err);
        reject(new Error(`Failed to parse ${file.name}: ${(err as Error).message}`));
      }
    };

    reader.onerror = (err) => {
      console.error('FileReader error:', err);
      reject(new Error(`Error reading file ${file.name}.`));
    };
    
    if (file.type === 'application/pdf') {
      reader.readAsArrayBuffer(file);
    } else if (file.type === 'text/plain') {
      reader.readAsText(file);
    } else {
       reject(new Error(`Unsupported file type: ${file.type}. Please upload PDF or TXT files.`));
    }
  });
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Helper to generate unique IDs, especially for pasted content
export const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const chunkText = (text: string, chunkSize: number = RAG_CHUNK_SIZE, overlap: number = RAG_CHUNK_OVERLAP): string[] => {
  if (!text) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.substring(i, end));
    i += chunkSize - overlap;
    if (i + overlap >= text.length && end === text.length) break; // Avoids tiny last chunk if overlap is large
  }
  // Ensure the last part of the text is captured if the loop condition prematurely exits
  if (i < text.length && chunks[chunks.length -1] && !chunks[chunks.length-1].endsWith(text.substring(text.length - (chunkSize - i)))) {
      const lastChunkStart = Math.max(0, text.length - chunkSize);
      const lastChunk = text.substring(lastChunkStart);
      if (chunks.length === 0 || (chunks.length > 0 && !chunks[chunks.length -1].endsWith(lastChunk))) {
          // Add if it's the only chunk or if the last chunk doesn't already contain this text
           if (chunks.length > 0 && chunks[chunks.length -1].includes(lastChunk.substring(0, overlap))) { // avoid fully duplicate last chunk
             //
           } else {
            chunks.push(lastChunk);
           }
      }
  }


  // Filter out very small chunks that might result from the overlap logic, unless it's the only chunk
  return chunks.filter((chunk, index, arr) => arr.length === 1 || chunk.length > overlap / 2 || chunk.length === text.length);
};