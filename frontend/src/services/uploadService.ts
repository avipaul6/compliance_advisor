// frontend/src/services/uploadService.ts
export interface UploadResult {
  success: boolean;
  document_id?: string;
  file_path?: string;
  storage_url?: string;
  metadata?: {
    original_filename: string;
    content_type: string;
    document_type: string;
    upload_timestamp: string;
    file_size: string;
    unique_id: string;
  };
  message: string;
}

export interface BatchUploadResult {
  uploads: Array<{
    filename: string;
    result: UploadResult;
  }>;
  summary: {
    total_files: number;
    successful_uploads: number;
    failed_uploads: number;
  };
}

export interface DocumentStatus {
  exists: boolean;
  document_id: string;
  status: 'indexed' | 'not_found' | 'processing' | 'error';
  metadata?: any;
  error?: string;
}

export interface IndexedDocument {
  id: string;
  name: string;
  content_uri?: string;
  metadata: {
    title?: string;
    document_type?: string;
    upload_timestamp?: string;
    file_size?: number;
    processing_timestamp?: string;
    file_path?: string;     // ADD THIS
    bucket?: string;        // ADD THIS
  };
}

class UploadService {
  private readonly API_BASE = '/api/v1';

  async uploadSingleDocument(
    file: File, 
    documentType: string = 'company'
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);

    const response = await fetch(`${this.API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Upload failed: ${response.statusText}`;
      try {
        const error = await response.json();
        errorMessage = error.detail || errorMessage;
      } catch (e) {
        // Could not parse error response
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async uploadMultipleDocuments(
    files: File[], 
    documentType: string = 'company'
  ): Promise<BatchUploadResult> {
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('document_type', documentType);

    const response = await fetch(`${this.API_BASE}/documents/batch-upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Batch upload failed: ${response.statusText}`;
      try {
        const error = await response.json();
        errorMessage = error.detail || errorMessage;
      } catch (e) {
        // Could not parse error response
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getDocumentStatus(documentId: string): Promise<DocumentStatus> {
    const response = await fetch(`${this.API_BASE}/documents/status/${documentId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get document status: ${response.statusText}`);
    }

    return response.json();
  }


  async listIndexedDocuments(documentType?: string): Promise<{documents: IndexedDocument[], total_count: number}> {
  const params = new URLSearchParams();
  if (documentType) {
    params.append('document_type', documentType);
  }

  const url = `/api/v1/rag/indexed-documents${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to list indexed documents: ${response.statusText}`);
  }

  return response.json();
}

  async deleteDocument(documentId: string): Promise<{success: boolean, message: string}> {
    const response = await fetch(`${this.API_BASE}/documents/document/${documentId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      let errorMessage = `Delete failed: ${response.statusText}`;
      try {
        const error = await response.json();
        errorMessage = error.detail || errorMessage;
      } catch (e) {
        // Could not parse error response
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async checkServiceHealth(): Promise<{status: string, service: string, storage_bucket: string, data_store_id: string}> {
    const response = await fetch(`${this.API_BASE}/documents/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Utility method to validate file before upload
  validateFile(file: File, maxSizeMB: number = 10): {valid: boolean, error?: string} {
    const allowedExtensions = ['.pdf', '.txt', '.docx', '.doc'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    // Check file extension
    if (!allowedExtensions.includes(fileExtension)) {
      return {
        valid: false,
        error: `File type ${fileExtension} not allowed. Allowed types: ${allowedExtensions.join(', ')}`
      };
    }
    
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size: ${maxSizeMB}MB`
      };
    }
    
    // Check if file has content
    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty'
      };
    }
    
    return { valid: true };
  }

  // Utility method to format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Monitor upload progress (for future enhancement)
  async uploadWithProgress(
    file: File,
    documentType: string = 'company',
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (e) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.detail || `Upload failed: ${xhr.statusText}`));
          } catch (e) {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      xhr.open('POST', `${this.API_BASE}/documents/upload`);
      xhr.timeout = 300000; // 5 minutes timeout
      xhr.send(formData);
    });
  }
}

export const uploadService = new UploadService();