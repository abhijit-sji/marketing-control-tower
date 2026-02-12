declare module 'mem0ai' {
  interface MemoryClientOptions {
    apiKey: string;
    baseUrl: string;
    projectId?: string | null;
  }

  export class MemoryClient {
    constructor(options: MemoryClientOptions);
    healthCheck(): Promise<unknown>;
  }
}

declare module 'chromadb' {
  interface ChromaClientOptions {
    path: string;
    apiKey: string;
  }

  export class ChromaClient {
    constructor(options: ChromaClientOptions);
    listCollections(): Promise<unknown>;
  }
}
