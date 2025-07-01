// Simulates a backend service that interacts with Vertex AI RAG

import { AustracUpdate, CompanyDocument, DocumentChunk } from './types';
import { generateUniqueId } from './utils'; // Keep for mock IDs
import { GEMINI_TEXT_MODEL } from './constants.tsx'; // Keep if any direct AI call remains, otherwise remove

// Simulate a delay for API calls
const fakeApiDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const ingestDocumentToVertexAI = async (
  doc: CompanyDocument | AustracUpdate,
  docType: 'company' | 'austrac'
): Promise<{ success: boolean; documentId: string; message: string }> => {
  await fakeApiDelay(1000 + Math.random() * 1000); // Simulate network latency
  const docName = docType === 'company' ? (doc as CompanyDocument).name : (doc as AustracUpdate).title;
  console.log(`[Vertex RAG Service SIMULATION] Ingesting ${docType} document: ${docName}`);
  // In a real scenario, this would send the document content to a backend,
  // which then processes and adds it to Vertex AI Search/Conversation.
  // The random failure condition has been removed to ensure reliable ingestion for the demo.
  // if (Math.random() < 0.05) { // Simulate occasional failure (5% chance)
  //   return { success: false, documentId: doc.id, message: `Simulated ingestion failure for ${docName}.` };
  // }
  return { success: true, documentId: doc.id, message: `Successfully ingested ${docName} (simulated).` };
};

export const retrieveContextFromVertexAI = async (
  queryText: string,
  topK: number 
): Promise<DocumentChunk[]> => {
  await fakeApiDelay(800 + Math.random() * 700);
  console.log(`[Vertex RAG Service SIMULATION] Retrieving context for query: "${queryText.substring(0, 50)}..." (topK: ${topK})`);

  const mockChunks: DocumentChunk[] = [];
  const queryKeywords = queryText.toLowerCase().split(" ").filter(kw => kw.length > 2); // Simple keyword extraction for mock

  // Simulate returning a few generic chunks based on the query.
  // In a real scenario, this comes from Vertex AI.
  if (queryKeywords.some(kw => ["policy", "procedure", "internal"].includes(kw))) {
    mockChunks.push({
      id: `vertex-chunk-comp-${generateUniqueId().substring(0,4)}`,
      documentId: 'simulated-policy-doc-id',
      documentName: 'Simulated Company Policy Document.pdf',
      documentType: 'company',
      text: `This is a simulated relevant chunk from a company policy regarding: "${queryText.substring(0,30)}...". It mentions specific procedures (like section 4.B) and general compliance requirements related to user queries. For detailed information, please refer to the official internal documentation provided.`,
      keywords: ['policy', 'compliance', 'procedure', 'internal', ...queryKeywords.filter(k => k.length > 3)],
      charCount: 250 + Math.floor(Math.random() * 50),
    });
  }
  if (queryKeywords.some(kw => ["austrac", "update", "regulation", "guidance"].includes(kw))) {
    mockChunks.push({
      id: `vertex-chunk-aus-${generateUniqueId().substring(0,4)}`,
      documentId: 'simulated-austrac-doc-id',
      documentName: 'Simulated AUSTRAC Update Q3.txt',
      documentType: 'austrac',
      text: `Simulated AUSTRAC update context: A recent regulatory change (AUSTRAC Notice ${new Date().getFullYear()}-X) impacts reporting obligations for transactions. This is relevant to your query: "${queryText.substring(0,30)}...". Entities must update their AML/CTF programs accordingly.`,
      keywords: ['austrac', 'regulatory', 'transaction', 'reporting', 'aml/ctf', ...queryKeywords.filter(k => k.length > 3)],
      charCount: 230 + Math.floor(Math.random() * 50),
    });
  }
  
  // Add a generic fallback if no specific context matched or to fill up to topK
  if (mockChunks.length < topK || mockChunks.length === 0) {
     const numGenericNeeded = Math.max(1, topK - mockChunks.length); // Ensure at least one if none found
     for(let i=0; i < numGenericNeeded; i++) {
        mockChunks.push({
            id: `vertex-chunk-gen-${generateUniqueId().substring(0,4)}-${i}`,
            documentId: `simulated-generic-doc-id-${i}`,
            documentName: `General Information Store (Simulated Topic ${i+1})`,
            documentType: (i % 2 === 0 && mockChunks.some(c => c.documentType === 'company')) ? 'company' : 'austrac', // Mix types
            text: `This is a generic simulated chunk from Vertex AI RAG relevant to your query: "${queryText.substring(0,30)}...". It provides general information or a tangentially related point. For more specific details, a refined query might be needed or ensure relevant documents are ingested. This chunk pertains to simulated topic ${i+1}.`,
            keywords: ['general', 'information', queryText.split(" ")[0]?.toLowerCase()].filter(Boolean) as string[],
            charCount: 180 + Math.floor(Math.random() * 70),
        });
     }
  }
  
  // console.log(`[Vertex RAG Service SIMULATION] Returning ${Math.min(mockChunks.length, topK)} chunks.`);
  return mockChunks.slice(0, topK); // Respect topK for the simulation
};

// Client-side keyword extraction (using Gemini) is removed, as this is now a conceptual backend/Vertex AI responsibility.
// `processDocumentForRag` (client-side chunking and keyword extraction) is removed.
// `retrieveRelevantChunksByKeywords` (client-side retrieval) is removed.