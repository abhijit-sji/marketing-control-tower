// These integrations are managed via edge functions and Supabase secrets
// Client-side direct connections are not used

// import { ChromaClient } from 'chromadb';
// import { MemoryClient } from 'mem0ai';

// const ensureClientConfig = (value: string | undefined, name: string) => {
//   if (!value) {
//     throw new Error(`Missing required environment variable: ${name}`);
//   }
//   return value;
// };

// export const chroma = new ChromaClient({
//   path: ensureClientConfig(import.meta.env.VITE_CHROMA_BASE_URL, 'VITE_CHROMA_BASE_URL'),
//   apiKey: ensureClientConfig(import.meta.env.VITE_CHROMA_API_KEY, 'VITE_CHROMA_API_KEY'),
// });

// export const mem0 = new MemoryClient({
//   apiKey: ensureClientConfig(import.meta.env.VITE_MEM0_API_KEY, 'VITE_MEM0_API_KEY'),
//   baseUrl: ensureClientConfig(import.meta.env.VITE_MEM0_BASE_URL, 'VITE_MEM0_BASE_URL'),
// });
