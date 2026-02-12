# AI Agent System

> **Last Updated:** 2026-01-02  
> **Status:** Verified against codebase

## Related Documentation
- [Project Architecture](./project_architecture.md) - Complete system architecture
- [Database Schema](./database_schema.md) - Database structure and relationships
- [Integration Points](./integration_points.md) - External AI provider integrations
- [Vector Embeddings System](./vector-embeddings-system.md) - RAG implementation details

---

## Overview

The platform features a sophisticated AI agent system that powers content generation, business analysis, and automated workflows. The system supports multiple AI providers with automatic fallback, context-rich prompts using RAG (Retrieval Augmented Generation), and persistent agent memory.

### Key Capabilities

- **Multi-Provider Support** - OpenAI, Google Gemini, Anthropic Claude, Perplexity AI
- **Automatic Fallback** - Provider chain with graceful degradation
- **RAG Integration** - Semantic search across knowledge bases
- **Agent Memory** - Persistent conversation history with vector embeddings
- **Streaming Responses** - Real-time AI output for better UX
- **Cost Tracking** - Token usage and cost monitoring per execution
- **Structured Output** - JSON schema validation for predictable responses

---

## Agent Execution Flow

### High-Level Architecture

```
User Request
    ↓
Agent Configuration (ai_agents table)
    ↓
Knowledge Context Collection (pgvector search)
    ↓
Agent Memory Retrieval (pgvector search)
    ↓
Prompt Assembly (system prompt + context + seasonal rules)
    ↓
AI Provider Selection (primary → fallback → ultimate fallback)
    ↓
AI Model Execution (OpenAI/Gemini/Claude/Perplexity)
    ↓
Response Parsing & Validation
    ↓
Storage (ai_agent_runs table)
    ↓
Return to User
```

---

## 1. Agent Configuration

### Agent Definition

**Location:** Database table `ai_agents`

**Configuration Schema:**
```typescript
interface AgentConfig {
  id: string;
  name: string;
  description: string;
  category: string;  // 'linkedin', 'business_analysis', 'client_email', etc.

  // Core Prompt
  system_prompt: string;

  // AI Provider Settings
  model_provider: "openai" | "gemini" | "claude" | "perplexity";
  model_version: string;  // 'gpt-4o', 'gemini-2.0-pro', etc.
  fallback_provider?: string;

  // Knowledge Sources
  knowledge_sources?: string[];  // Array of knowledge category IDs

  // External Data
  external_data_sources?: {
    type: string;
    config: Record<string, unknown>;
  }[];

  // Status
  is_active: boolean;
  created_by: string;
}
```

**Example Agent Configuration:**
```json
{
  "id": "uuid-123",
  "name": "LinkedIn Content Generator",
  "category": "linkedin",
  "system_prompt": "You are an expert LinkedIn content creator for {company_name}...",
  "model_provider": "openai",
  "model_version": "gpt-5-mini-2025-08-07",
  "fallback_provider": "gemini",
  "knowledge_sources": ["category-uuid-1", "category-uuid-2"],
  "is_active": true
}
```

### System Configuration

**Location:** Database table `ai_configurations`

**Global Settings:**
```typescript
interface AIConfiguration {
  business_context: {
    company_name: string;
    industry: string;
    company_policies: string[];
  };

  model_settings: {
    default_model: string;
    temperature: number;
    max_tokens: number;
  };

  prompts: {
    system_prompt: string;
    seasonal_rules: {
      Q1: string;
      Q2: string;
      Q3: string;
      Q4: string;
    };
  };
}
```

---

## 2. Provider Fallback Chain

### buildProviderPreferences Function

**Location:** `supabase/functions/run-ai-agent/index.ts`

**Logic:**
```typescript
function buildProviderPreferences(config: AgentProviderConfig) {
  const list = [];

  // 1. Primary provider (user-configured)
  if (config.model_provider) {
    list.push({
      provider: config.model_provider,
      version: config.model_version
    });
  }

  // 2. Fallback provider (optional)
  if (config.fallback_provider) {
    list.push({
      provider: config.fallback_provider
    });
  }

  // 3. Ultimate fallback (always OpenAI)
  list.push({ provider: "openai" });

  // Deduplicate
  return deduplicatedList;
}
```

**Example Fallback Chain:**
```
Request → Gemini (primary)
         ↓ (if fails)
      → Claude (fallback)
         ↓ (if fails)
      → OpenAI (ultimate fallback)
```

---

## 3. Knowledge Context Collection

### RAG (Retrieval Augmented Generation)

**Purpose:** Enrich agent prompts with relevant context from knowledge bases

**Function:** `collectKnowledgeContext`

**Location:** `supabase/functions/run-ai-agent/index.ts`

**Process:**
```typescript
async function collectKnowledgeContext(
  client: SupabaseClient,
  agent: AgentConfig,
  queryText: string
) {
  // 1. Get agent's knowledge category IDs
  const categoryIds = getAgentKnowledgeCollections(agent);

  // 2. Generate embedding for query
  const { embedding } = await generateEmbedding(queryText);

  // 3. Search knowledge embeddings via pgvector
  const snippets = await searchKnowledgeEmbeddings(
    client,
    queryText,
    categoryIds,
    matchCount: 5,
    similarityThreshold: 0.7
  );

  // 4. Concatenate snippets
  return snippets.join('\n\n');
}
```

**pgvector Search:**
```typescript
async function searchKnowledgeEmbeddings(
  client,
  queryText: string,
  categoryIds: string[],
  matchCount = 5,
  similarityThreshold = 0.7
) {
  // Call PostgreSQL RPC function
  const { data } = await client.rpc('match_knowledge_embeddings', {
    query_embedding: embedding,
    category_ids: categoryIds,
    match_count: matchCount,
    similarity_threshold: similarityThreshold
  });

  // Uses cosine similarity: 1 - (embedding <=> query_embedding)
  return data.map(result => result.content);
}
```

**Knowledge Sources:**
- Company knowledge base (`knowledge_embeddings`)
- Brand-specific documents (`brand_knowledge_embeddings`)
- Project knowledge (`project_knowledge_files`)
- Leader uploads (`leader_uploads`)

---

## 4. Agent Memory

### Persistent Memory with Embeddings

**Purpose:** Maintain conversation history and context across sessions

**Table:** `agent_memories`

**Schema:**
```sql
id                UUID PRIMARY KEY
agent_user_id     UUID  -- Composite: agent_id + user_id
agent_id          UUID REFERENCES ai_agents(id)
memory_text       TEXT NOT NULL
embedding         VECTOR(1536)  -- pgvector
tags              TEXT[]
context           JSONB
created_at        TIMESTAMPTZ
```

**Memory Collection Function:**
```typescript
async function collectMemoryContext(
  client: SupabaseClient,
  agent: AgentConfig,
  queryText: string,
  userId: string
) {
  // 1. Create agent_user_id composite key
  const agentUserId = `${agent.id}_${userId}`;

  // 2. Search agent memories via pgvector
  const snippets = await searchAgentMemories(
    client,
    queryText,
    agentUserId,
    matchCount: 5,
    similarityThreshold: 0.6  // Lower threshold for memories
  );

  // 3. Concatenate memory snippets
  return snippets.join('\n\n');
}
```

**Memory Storage:**
```typescript
async function storeAgentMemory(
  client: SupabaseClient,
  agentId: string,
  userId: string,
  memoryText: string,
  tags?: string[]
) {
  // 1. Generate embedding
  const { embedding } = await generateEmbedding(memoryText);

  // 2. Store in agent_memories table
  await client.from('agent_memories').insert({
    agent_user_id: `${agentId}_${userId}`,
    agent_id: agentId,
    memory_text: memoryText,
    embedding: embedding,
    tags: tags || [],
    context: { timestamp: new Date().toISOString() }
  });
}
```

---

## 5. Prompt Assembly

### assemblePrompt Function

**Purpose:** Build the final system prompt with all context

**Process:**
```typescript
function assemblePrompt(
  agent: AgentConfig,
  businessContext: BusinessContext,
  prompts: SystemPrompts,
  executionContext: any,
  knowledgeContext: string,
  memoryContext: string
) {
  let systemPrompt = agent.system_prompt;

  // 1. Replace business context variables
  systemPrompt = systemPrompt
    .replace('{company_name}', businessContext.company_name)
    .replace('{industry}', businessContext.industry);

  // 2. Add seasonal context (Q1-Q4 rules)
  const currentQuarter = getCurrentQuarter();
  const seasonalRules = prompts.seasonal_rules[currentQuarter];
  if (seasonalRules) {
    systemPrompt += `\n\nSeasonal Context:\n${seasonalRules}`;
  }

  // 3. Add company policies
  if (businessContext.company_policies?.length > 0) {
    systemPrompt += `\n\nCompany Policies:\n${businessContext.company_policies.join('\n')}`;
  }

  // 4. Append knowledge context
  if (knowledgeContext) {
    systemPrompt += `\n\nRelevant Knowledge:\n${knowledgeContext}`;
  }

  // 5. Append agent memories
  if (memoryContext) {
    systemPrompt += `\n\nPrevious Conversations:\n${memoryContext}`;
  }

  return systemPrompt;
}
```

**Example Assembled Prompt:**
```
You are an expert LinkedIn content creator for Acme Marketing...

Seasonal Context:
Q1 Focus: New year planning, goal setting, fresh starts...

Company Policies:
- Always maintain professional tone
- Avoid political topics
- Include call-to-action in every post

Relevant Knowledge:
[Knowledge snippet 1 from vector search]
[Knowledge snippet 2 from vector search]
...

Previous Conversations:
[Memory snippet 1 from previous interactions]
[Memory snippet 2 from previous interactions]
...
```

---

## 6. AI Provider Execution

### OpenAI Provider

**Location:** `supabase/functions/_shared/openai-client.ts`

**Execution:**
```typescript
async function executeOpenAI(
  systemPrompt: string,
  userMessage: string,
  model: string,
  tools?: any[]
) {
  const openai = new OpenAI({ apiKey: OPENAI_KEY });

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage }
  ];

  const completion = await openai.chat.completions.create({
    model: model,
    messages: messages,
    tools: tools,  // For structured output
    temperature: 0.7,
    max_tokens: 2000
  });

  // Extract response
  const response = completion.choices[0].message;

  // Track usage
  const cost = calculateCost(completion.usage, model);

  return {
    content: response.content,
    usage: completion.usage,
    cost: cost
  };
}
```

**Cost Tracking:**
```typescript
const MODEL_PRICING = {
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-4': { prompt: 0.03, completion: 0.06 },
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 }
};

function calculateCost(usage, model) {
  const pricing = MODEL_PRICING[model];
  const promptCost = (usage.prompt_tokens / 1000) * pricing.prompt;
  const completionCost = (usage.completion_tokens / 1000) * pricing.completion;
  return promptCost + completionCost;
}
```

### Gemini Provider

**Execution:**
```typescript
async function executeGemini(
  systemPrompt: string,
  userMessage: string,
  model: string
) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const geminiModel = genAI.getGenerativeModel({
    model: model,
    systemInstruction: systemPrompt
  });

  const result = await geminiModel.generateContent(userMessage);
  const response = result.response.text();

  return {
    content: response,
    usage: {
      prompt_tokens: estimateTokens(systemPrompt + userMessage),
      completion_tokens: estimateTokens(response)
    }
  };
}
```

### Claude Provider

**Execution:**
```typescript
async function executeClaude(
  systemPrompt: string,
  userMessage: string,
  model: string
) {
  const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

  const message = await anthropic.messages.create({
    model: model,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 2000
  });

  return {
    content: message.content[0].text,
    usage: message.usage
  };
}
```

### Perplexity Provider

**Execution:**
```typescript
async function executePerplexity(
  systemPrompt: string,
  userMessage: string,
  model: string,
  externalDataSources?: any[]
) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      external_data_sources: externalDataSources  // Perplexity-specific feature
    })
  });

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage
  };
}
```

---

## 7. Structured Output (OpenAI Function Calling)

### LinkedIn Content Generation

**Use Case:** Generate LinkedIn posts with predictable structure

**Tool Definition:**
```typescript
const linkedinPostTool = {
  type: "function",
  function: {
    name: "generate_linkedin_post",
    description: "Generate a structured LinkedIn post",
    parameters: {
      type: "object",
      properties: {
        post_title: {
          type: "string",
          description: "Catchy title for the post"
        },
        post_body: {
          type: "string",
          description: "Main content of the post"
        },
        carousel_outline: {
          type: "array",
          items: { type: "string" },
          description: "Outline for carousel slides"
        },
        caption_ideas: {
          type: "array",
          items: { type: "string" },
          description: "Alternative caption ideas"
        }
      },
      required: ["post_title", "post_body"]
    }
  }
};
```

**Execution:**
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-5-mini-2025-08-07",
  messages: messages,
  tools: [linkedinPostTool],
  tool_choice: { type: "function", function: { name: "generate_linkedin_post" } }
});

// Extract structured response
const toolCall = completion.choices[0].message.tool_calls[0];
const parsedResponse = JSON.parse(toolCall.function.arguments);

// parsedResponse:
{
  post_title: "5 Ways to Boost Your LinkedIn Engagement",
  post_body: "Engagement is the currency of LinkedIn...",
  carousel_outline: [
    "Slide 1: Introduction",
    "Slide 2: Tip #1 - Consistency",
    "Slide 3: Tip #2 - Storytelling",
    ...
  ],
  caption_ideas: [
    "Want more engagement? Here's how...",
    "LinkedIn secrets nobody talks about...",
    ...
  ]
}
```

---

## 8. Response Storage

### ai_agent_runs Table

**Schema:**
```sql
id                UUID PRIMARY KEY
agent_id          UUID REFERENCES ai_agents(id)
executed_by       UUID REFERENCES users(id)
execution_context JSONB
ai_summary        TEXT
generated_tasks   JSONB
status            TEXT  -- 'completed', 'failed', 'pending'
category          TEXT
output            JSONB
created_at        TIMESTAMPTZ
```

**Storage Logic:**
```typescript
await client.from('ai_agent_runs').insert({
  agent_id: agent.id,
  executed_by: userId,
  execution_context: {
    user_input: userMessage,
    model_provider: usedProvider,
    model_version: usedVersion
  },
  ai_summary: parsedResponse.post_body,
  generated_tasks: extractActionItems(parsedResponse),
  status: 'completed',
  category: agent.category,
  output: {
    provider_meta: {
      provider: usedProvider,
      version: usedVersion,
      tokens: usage,
      cost: calculatedCost
    },
    knowledge_context: knowledgeContext,
    memory_context: memoryContext,
    result: parsedResponse,
    raw_response: completion.choices[0].message.content
  }
});
```

---

## 9. Streaming Responses

### Real-Time AI Output

**Purpose:** Improve UX with progressive rendering

**Edge Function:** `stream-ai-response`

**Implementation:**
```typescript
export default async function handler(req: Request) {
  const { systemPrompt, userMessage, model } = await req.json();

  const openai = new OpenAI({ apiKey: OPENAI_KEY });

  // Create streaming completion
  const stream = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    stream: true
  });

  // Create ReadableStream
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
      }
      controller.close();
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**Frontend Hook:**
```typescript
function useStreamAIResponse() {
  const [content, setContent] = useState('');

  const streamResponse = async (prompt: string) => {
    const response = await fetch('/stream-ai-response', {
      method: 'POST',
      body: JSON.stringify({ systemPrompt, userMessage: prompt })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          setContent(prev => prev + data.content);
        }
      }
    }
  };

  return { content, streamResponse };
}
```

---

## 10. Special: LinkedIn Content Generation

### Enhanced Context Sources

**LinkedIn agents use additional context:**

1. **Thought Leader Profile** (`thought_leaders` table)
   - Name, title, tone, target audience
   - Key topics and expertise areas

2. **Leader-Specific Documents** (`leader_uploads`)
   - Personal writing samples
   - Previous successful posts
   - Brand guidelines

3. **Weekly Trends** (`weekly_trends`)
   - Current trending topics
   - Industry news and insights

4. **Influencer Styles** (`influencer_style_library`)
   - Reference posts from top influencers
   - Tone and style patterns

5. **Company Knowledge** (`knowledge_embeddings`)
   - Company values and messaging
   - Product information
   - Industry expertise

6. **Agent Templates** (`linkedin_agent_templates`)
   - Reusable prompt templates
   - Variable substitution

### Context Assembly for LinkedIn

```typescript
async function buildLinkedInContext(
  leaderId: string,
  sourceType: 'trend' | 'influencer' | 'custom',
  sourceId?: string
) {
  // 1. Fetch leader profile
  const leader = await fetchLeaderProfile(leaderId);

  // 2. Load leader documents
  const leaderDocs = await fetchLeaderUploads(leaderId);

  // 3. Fetch source-specific content
  let sourceContent = '';
  if (sourceType === 'trend') {
    const trend = await fetchWeeklyTrend(sourceId);
    sourceContent = `Trend: ${trend.headline}\n${trend.description}`;
  } else if (sourceType === 'influencer') {
    const influencer = await fetchInfluencerStyle(sourceId);
    sourceContent = `Style Reference: ${influencer.sample_posts.join('\n\n')}`;
  }

  // 4. Search company knowledge
  const knowledgeContext = await searchKnowledgeEmbeddings(
    client,
    `${leader.name} ${leader.key_topics.join(' ')}`,
    leader.knowledge_category_ids,
    5
  );

  // 5. Assemble final context
  return {
    leader_profile: {
      name: leader.name,
      title: leader.title,
      tone: leader.writing_tone,
      audience: leader.target_audience,
      topics: leader.key_topics
    },
    leader_documents: leaderDocs,
    source_content: sourceContent,
    company_knowledge: knowledgeContext
  };
}
```

---

## 11. Best Practices

### Agent Configuration

1. **Be Specific in System Prompts**
   - Define exact output format
   - Specify tone and style
   - Include examples

2. **Use Knowledge Sources Wisely**
   - Only relevant categories
   - Keep knowledge up-to-date
   - Monitor embedding quality

3. **Configure Fallback Providers**
   - Primary for cost/quality balance
   - Fallback for reliability
   - Ultimate fallback always available

### Performance Optimization

1. **Limit Knowledge Context**
   - Use similarity threshold (0.7+)
   - Limit match count (5-10 max)
   - Cache frequent queries

2. **Manage Token Usage**
   - Set appropriate max_tokens
   - Truncate long contexts
   - Monitor costs per agent

3. **Use Streaming for Long Responses**
   - Better UX
   - Lower perceived latency
   - Progressive rendering

### Security

1. **Validate User Input**
   - Sanitize prompts
   - Prevent prompt injection
   - Rate limiting

2. **Protect API Keys**
   - Environment variables only
   - Never in client code
   - Rotate regularly

3. **Implement RLS**
   - Agent access control
   - Knowledge base permissions
   - Memory isolation per user

---

## 12. Monitoring & Debugging

### Cost Tracking

**Monitor via `ai_agent_runs.output`:**
```typescript
{
  provider_meta: {
    provider: "openai",
    version: "gpt-4o",
    tokens: {
      prompt_tokens: 1250,
      completion_tokens: 480,
      total_tokens: 1730
    },
    cost: 0.0135  // USD
  }
}
```

**Aggregate Costs:**
```sql
SELECT
  agent_id,
  SUM((output->'provider_meta'->>'cost')::numeric) as total_cost,
  COUNT(*) as run_count,
  AVG((output->'provider_meta'->>'cost')::numeric) as avg_cost
FROM ai_agent_runs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_id
ORDER BY total_cost DESC;
```

### Error Tracking

**Common Errors:**
- Provider API failures
- Token limit exceeded
- Invalid JSON in structured output
- Knowledge context too large
- Memory retrieval failures

**Debugging:**
```typescript
// Log full execution context
console.log('Agent Execution:', {
  agent_id: agent.id,
  provider: usedProvider,
  knowledge_context_length: knowledgeContext.length,
  memory_context_length: memoryContext.length,
  total_prompt_tokens: estimateTokens(assembledPrompt),
  error: error?.message
});
```

---

## Summary

The AI agent system provides:

1. **Flexibility** - Multiple providers with automatic fallback
2. **Intelligence** - RAG with knowledge bases and agent memory
3. **Reliability** - Provider chain ensures high availability
4. **Cost Control** - Usage tracking and model selection
5. **Structure** - JSON schemas for predictable outputs
6. **Performance** - Streaming for real-time responses
7. **Context-Aware** - Seasonal rules, company policies, memories
8. **Scalable** - Vector search with pgvector for fast retrieval

This architecture enables sophisticated AI-powered workflows while maintaining control, visibility, and cost efficiency.
