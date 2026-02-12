/**
 * Knowledge Base Error Handling Module
 *
 * Provides standardized error codes, user-friendly messages, and error classification
 * for the knowledge base upload and processing system.
 *
 * @module knowledge-errors
 */

// ============================================================================
// Error Codes
// ============================================================================

export enum KnowledgeErrorCode {
  // Upload Errors (1xx)
  UPLOAD_AUTH_REQUIRED = 'KB_101',
  UPLOAD_UNAUTHORIZED = 'KB_102',
  UPLOAD_FORBIDDEN = 'KB_103',
  UPLOAD_INVALID_FILE_TYPE = 'KB_104',
  UPLOAD_FILE_TOO_LARGE = 'KB_105',
  UPLOAD_STORAGE_FAILED = 'KB_106',
  UPLOAD_DB_FAILED = 'KB_107',
  UPLOAD_SOURCE_NOT_FOUND = 'KB_108',
  UPLOAD_BRAND_ACCESS_DENIED = 'KB_109',
  UPLOAD_MISSING_PARAMS = 'KB_110',

  // Processing Errors (2xx)
  PROCESS_DOWNLOAD_FAILED = 'KB_201',
  PROCESS_FILE_EMPTY = 'KB_202',
  PROCESS_BINARY_CONTENT = 'KB_203',
  PROCESS_CHUNKING_FAILED = 'KB_204',
  PROCESS_EMBEDDING_FAILED = 'KB_205',
  PROCESS_DB_INSERT_FAILED = 'KB_206',
  PROCESS_TIMEOUT = 'KB_207',
  PROCESS_MEMORY_LIMIT = 'KB_208',

  // API Errors (3xx)
  API_KEY_MISSING = 'KB_301',
  API_RATE_LIMIT = 'KB_302',
  API_INVALID_RESPONSE = 'KB_303',
  API_NETWORK_ERROR = 'KB_304',
  API_SERVER_ERROR = 'KB_305',
  API_QUOTA_EXCEEDED = 'KB_306',

  // System Errors (4xx)
  SYSTEM_CONFIG_ERROR = 'KB_401',
  SYSTEM_DB_ERROR = 'KB_402',
  SYSTEM_STORAGE_ERROR = 'KB_403',
  SYSTEM_UNKNOWN = 'KB_499',
}

// ============================================================================
// Error Details Interface
// ============================================================================

export interface KnowledgeError {
  code: KnowledgeErrorCode;
  message: string;           // User-friendly message
  technicalMessage: string;  // Technical details for logging
  suggestion: string;        // What the user can do
  isRetryable: boolean;      // Whether the operation can be retried
  retryAfterMs?: number;     // Suggested retry delay
}

// ============================================================================
// Error Definitions
// ============================================================================

const errorDefinitions: Record<KnowledgeErrorCode, Omit<KnowledgeError, 'technicalMessage'>> = {
  // Upload Errors
  [KnowledgeErrorCode.UPLOAD_AUTH_REQUIRED]: {
    code: KnowledgeErrorCode.UPLOAD_AUTH_REQUIRED,
    message: 'Please sign in to upload files.',
    suggestion: 'Sign in and try again.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.UPLOAD_UNAUTHORIZED]: {
    code: KnowledgeErrorCode.UPLOAD_UNAUTHORIZED,
    message: 'Your session has expired.',
    suggestion: 'Please sign in again and retry the upload.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.UPLOAD_FORBIDDEN]: {
    code: KnowledgeErrorCode.UPLOAD_FORBIDDEN,
    message: 'You don\'t have permission to upload files here.',
    suggestion: 'Contact your administrator to request access.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.UPLOAD_INVALID_FILE_TYPE]: {
    code: KnowledgeErrorCode.UPLOAD_INVALID_FILE_TYPE,
    message: 'This file type is not supported.',
    suggestion: 'Please upload a .txt or .md file.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.UPLOAD_FILE_TOO_LARGE]: {
    code: KnowledgeErrorCode.UPLOAD_FILE_TOO_LARGE,
    message: 'This file is too large to upload.',
    suggestion: 'Please upload a file smaller than 10MB, or split it into smaller files.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.UPLOAD_STORAGE_FAILED]: {
    code: KnowledgeErrorCode.UPLOAD_STORAGE_FAILED,
    message: 'Failed to save the file.',
    suggestion: 'Please try again. If the problem persists, contact support.',
    isRetryable: true,
    retryAfterMs: 5000,
  },
  [KnowledgeErrorCode.UPLOAD_DB_FAILED]: {
    code: KnowledgeErrorCode.UPLOAD_DB_FAILED,
    message: 'Failed to register the file.',
    suggestion: 'Please try again. If the problem persists, contact support.',
    isRetryable: true,
    retryAfterMs: 5000,
  },
  [KnowledgeErrorCode.UPLOAD_SOURCE_NOT_FOUND]: {
    code: KnowledgeErrorCode.UPLOAD_SOURCE_NOT_FOUND,
    message: 'The upload destination could not be found.',
    suggestion: 'Please refresh the page and try again.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.UPLOAD_BRAND_ACCESS_DENIED]: {
    code: KnowledgeErrorCode.UPLOAD_BRAND_ACCESS_DENIED,
    message: 'You don\'t have access to this brand.',
    suggestion: 'Please select a brand you have access to.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.UPLOAD_MISSING_PARAMS]: {
    code: KnowledgeErrorCode.UPLOAD_MISSING_PARAMS,
    message: 'Missing required information.',
    suggestion: 'Please select a file and destination, then try again.',
    isRetryable: false,
  },

  // Processing Errors
  [KnowledgeErrorCode.PROCESS_DOWNLOAD_FAILED]: {
    code: KnowledgeErrorCode.PROCESS_DOWNLOAD_FAILED,
    message: 'Could not retrieve the uploaded file.',
    suggestion: 'The file may have been moved or deleted. Try uploading again.',
    isRetryable: true,
    retryAfterMs: 10000,
  },
  [KnowledgeErrorCode.PROCESS_FILE_EMPTY]: {
    code: KnowledgeErrorCode.PROCESS_FILE_EMPTY,
    message: 'The file appears to be empty.',
    suggestion: 'Please upload a file with text content.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.PROCESS_BINARY_CONTENT]: {
    code: KnowledgeErrorCode.PROCESS_BINARY_CONTENT,
    message: 'This file contains non-text content.',
    suggestion: 'Please upload a plain text (.txt) or markdown (.md) file.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.PROCESS_CHUNKING_FAILED]: {
    code: KnowledgeErrorCode.PROCESS_CHUNKING_FAILED,
    message: 'Could not process the file content.',
    suggestion: 'The file may be corrupted. Try uploading a different version.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.PROCESS_EMBEDDING_FAILED]: {
    code: KnowledgeErrorCode.PROCESS_EMBEDDING_FAILED,
    message: 'Failed to analyze the file content.',
    suggestion: 'This is usually temporary. The system will automatically retry.',
    isRetryable: true,
    retryAfterMs: 30000,
  },
  [KnowledgeErrorCode.PROCESS_DB_INSERT_FAILED]: {
    code: KnowledgeErrorCode.PROCESS_DB_INSERT_FAILED,
    message: 'Failed to save the processed content.',
    suggestion: 'This is usually temporary. The system will automatically retry.',
    isRetryable: true,
    retryAfterMs: 10000,
  },
  [KnowledgeErrorCode.PROCESS_TIMEOUT]: {
    code: KnowledgeErrorCode.PROCESS_TIMEOUT,
    message: 'Processing took too long.',
    suggestion: 'Large files may take longer. The system will automatically retry.',
    isRetryable: true,
    retryAfterMs: 60000,
  },
  [KnowledgeErrorCode.PROCESS_MEMORY_LIMIT]: {
    code: KnowledgeErrorCode.PROCESS_MEMORY_LIMIT,
    message: 'The file is too complex to process.',
    suggestion: 'Try splitting the file into smaller parts.',
    isRetryable: false,
  },

  // API Errors
  [KnowledgeErrorCode.API_KEY_MISSING]: {
    code: KnowledgeErrorCode.API_KEY_MISSING,
    message: 'AI service is not configured.',
    suggestion: 'Contact your administrator to configure the AI service.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.API_RATE_LIMIT]: {
    code: KnowledgeErrorCode.API_RATE_LIMIT,
    message: 'AI service is temporarily busy.',
    suggestion: 'Please wait a moment. The system will automatically retry.',
    isRetryable: true,
    retryAfterMs: 60000,
  },
  [KnowledgeErrorCode.API_INVALID_RESPONSE]: {
    code: KnowledgeErrorCode.API_INVALID_RESPONSE,
    message: 'Received an unexpected response from the AI service.',
    suggestion: 'This is usually temporary. The system will automatically retry.',
    isRetryable: true,
    retryAfterMs: 30000,
  },
  [KnowledgeErrorCode.API_NETWORK_ERROR]: {
    code: KnowledgeErrorCode.API_NETWORK_ERROR,
    message: 'Could not connect to the AI service.',
    suggestion: 'Check your internet connection and try again.',
    isRetryable: true,
    retryAfterMs: 10000,
  },
  [KnowledgeErrorCode.API_SERVER_ERROR]: {
    code: KnowledgeErrorCode.API_SERVER_ERROR,
    message: 'The AI service is experiencing issues.',
    suggestion: 'This is usually temporary. The system will automatically retry.',
    isRetryable: true,
    retryAfterMs: 60000,
  },
  [KnowledgeErrorCode.API_QUOTA_EXCEEDED]: {
    code: KnowledgeErrorCode.API_QUOTA_EXCEEDED,
    message: 'AI service quota has been exceeded.',
    suggestion: 'Contact your administrator to increase the quota.',
    isRetryable: false,
  },

  // System Errors
  [KnowledgeErrorCode.SYSTEM_CONFIG_ERROR]: {
    code: KnowledgeErrorCode.SYSTEM_CONFIG_ERROR,
    message: 'System configuration error.',
    suggestion: 'Contact your administrator.',
    isRetryable: false,
  },
  [KnowledgeErrorCode.SYSTEM_DB_ERROR]: {
    code: KnowledgeErrorCode.SYSTEM_DB_ERROR,
    message: 'Database error occurred.',
    suggestion: 'This is usually temporary. Please try again.',
    isRetryable: true,
    retryAfterMs: 10000,
  },
  [KnowledgeErrorCode.SYSTEM_STORAGE_ERROR]: {
    code: KnowledgeErrorCode.SYSTEM_STORAGE_ERROR,
    message: 'Storage service error.',
    suggestion: 'This is usually temporary. Please try again.',
    isRetryable: true,
    retryAfterMs: 10000,
  },
  [KnowledgeErrorCode.SYSTEM_UNKNOWN]: {
    code: KnowledgeErrorCode.SYSTEM_UNKNOWN,
    message: 'An unexpected error occurred.',
    suggestion: 'Please try again. If the problem persists, contact support.',
    isRetryable: true,
    retryAfterMs: 10000,
  },
};

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create a structured KnowledgeError from an error code and technical details
 */
export function createKnowledgeError(
  code: KnowledgeErrorCode,
  technicalMessage: string
): KnowledgeError {
  const definition = errorDefinitions[code];
  return {
    ...definition,
    technicalMessage,
  };
}

/**
 * Parse a raw error and convert it to a KnowledgeError
 * Attempts to classify the error based on the message
 */
export function parseError(error: unknown): KnowledgeError {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Gemini API errors
  if (errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('API key not')) {
    return createKnowledgeError(KnowledgeErrorCode.API_KEY_MISSING, errorMessage);
  }
  if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('RATE_LIMIT')) {
    return createKnowledgeError(KnowledgeErrorCode.API_RATE_LIMIT, errorMessage);
  }
  if (errorMessage.includes('quota') || errorMessage.includes('QUOTA_EXCEEDED')) {
    return createKnowledgeError(KnowledgeErrorCode.API_QUOTA_EXCEEDED, errorMessage);
  }
  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return createKnowledgeError(KnowledgeErrorCode.API_SERVER_ERROR, errorMessage);
  }
  if (errorMessage.includes('invalid embedding response') || errorMessage.includes('invalid batch embedding')) {
    return createKnowledgeError(KnowledgeErrorCode.API_INVALID_RESPONSE, errorMessage);
  }
  if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
    return createKnowledgeError(KnowledgeErrorCode.API_NETWORK_ERROR, errorMessage);
  }

  // File processing errors
  if (errorMessage.includes('Download failed') || errorMessage.includes('No data returned')) {
    return createKnowledgeError(KnowledgeErrorCode.PROCESS_DOWNLOAD_FAILED, errorMessage);
  }
  if (errorMessage.includes('empty') || errorMessage.includes('no readable text')) {
    return createKnowledgeError(KnowledgeErrorCode.PROCESS_FILE_EMPTY, errorMessage);
  }
  if (errorMessage.includes('binary') || errorMessage.includes('cannot be processed as text')) {
    return createKnowledgeError(KnowledgeErrorCode.PROCESS_BINARY_CONTENT, errorMessage);
  }
  if (errorMessage.includes('No content chunks') || errorMessage.includes('chunk')) {
    return createKnowledgeError(KnowledgeErrorCode.PROCESS_CHUNKING_FAILED, errorMessage);
  }
  if (errorMessage.includes('Failed to insert') || errorMessage.includes('insert')) {
    return createKnowledgeError(KnowledgeErrorCode.PROCESS_DB_INSERT_FAILED, errorMessage);
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
    return createKnowledgeError(KnowledgeErrorCode.PROCESS_TIMEOUT, errorMessage);
  }
  if (errorMessage.includes('memory') || errorMessage.includes('Memory limit')) {
    return createKnowledgeError(KnowledgeErrorCode.PROCESS_MEMORY_LIMIT, errorMessage);
  }

  // Upload errors
  if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
    return createKnowledgeError(KnowledgeErrorCode.UPLOAD_UNAUTHORIZED, errorMessage);
  }
  if (errorMessage.includes('Forbidden') || errorMessage.includes('403') || errorMessage.includes('permission')) {
    return createKnowledgeError(KnowledgeErrorCode.UPLOAD_FORBIDDEN, errorMessage);
  }
  if (errorMessage.includes('file extension') || errorMessage.includes('file type') || errorMessage.includes('MIME')) {
    return createKnowledgeError(KnowledgeErrorCode.UPLOAD_INVALID_FILE_TYPE, errorMessage);
  }
  if (errorMessage.includes('too large') || errorMessage.includes('File too large')) {
    return createKnowledgeError(KnowledgeErrorCode.UPLOAD_FILE_TOO_LARGE, errorMessage);
  }
  if (errorMessage.includes('storage') || errorMessage.includes('upload file')) {
    return createKnowledgeError(KnowledgeErrorCode.UPLOAD_STORAGE_FAILED, errorMessage);
  }
  if (errorMessage.includes('Source not found') || errorMessage.includes('Invalid source')) {
    return createKnowledgeError(KnowledgeErrorCode.UPLOAD_SOURCE_NOT_FOUND, errorMessage);
  }

  // Default to unknown error
  return createKnowledgeError(KnowledgeErrorCode.SYSTEM_UNKNOWN, errorMessage);
}

/**
 * Format error for display to users
 */
export function formatErrorForUser(error: KnowledgeError): string {
  return `${error.message} ${error.suggestion}`;
}

/**
 * Format error for logging (includes technical details)
 */
export function formatErrorForLog(error: KnowledgeError): string {
  return `[${error.code}] ${error.message} | Technical: ${error.technicalMessage} | Retryable: ${error.isRetryable}`;
}

/**
 * Create a JSON response for API errors
 */
export function createErrorResponse(error: KnowledgeError): {
  error: string;
  code: string;
  message: string;
  suggestion: string;
  isRetryable: boolean;
  retryAfterMs?: number;
} {
  return {
    error: error.message,
    code: error.code,
    message: error.message,
    suggestion: error.suggestion,
    isRetryable: error.isRetryable,
    retryAfterMs: error.retryAfterMs,
  };
}
