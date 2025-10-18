# LangChain Migration Testing Guide

## Overview

The OBT Mentor Companion now supports two AI backend systems:
1. **Legacy System**: OpenAI Assistant API (stable, production-tested)
2. **New System**: LangChain/LangGraph Multi-Agent (GPT-4o with React Agent)

## Feature Flag Control

The `USE_LANGCHAIN` environment variable controls which system is active:

```bash
# Use legacy OpenAI Assistant API (default)
USE_LANGCHAIN=false

# Use new LangChain multi-agent system
USE_LANGCHAIN=true
```

## Architecture Comparison

### Legacy System (OpenAI Assistant API)
- **Threading**: Uses OpenAI Assistant threads for conversation memory
- **Context**: Manual context injection via system prompts
- **Tools**: OpenAI function calling with custom tool handlers
- **Vision**: Native GPT-4o vision support
- **Audio**: Whisper API transcription

### New System (LangChain/LangGraph)
- **Threading**: LangGraph React Agent with message history
- **Context**: Qdrant semantic search + portfolio data injection
- **Tools**: DynamicStructuredTool with Zod validation
- **Vision**: Pending implementation (logged for now)
- **Audio**: Whisper API transcription (same as legacy)

## Portfolio Tools (Both Systems)

1. **add_qualification**: Add courses, certificates, training
2. **add_activity**: Log mentorship activities (language, dates, context)
3. **update_competency**: Update competency status (not_started → advanced)
4. **create_general_experience**: Record general experiences

## Testing Checklist

### 1. Basic Chat Functionality
- [ ] Create new chat
- [ ] Send messages and receive responses
- [ ] View chat history
- [ ] Delete messages
- [ ] Verify embeddings stored in Qdrant

### 2. Portfolio Management
- [ ] Update competency status via chat
- [ ] Add qualifications through conversation
- [ ] Log mentorship activities
- [ ] Create general experiences
- [ ] Verify database updates

### 3. Context Injection
- [ ] Verify facilitator portfolio loaded
- [ ] Test semantic search retrieval
- [ ] Check global memory search
- [ ] Validate recent message history

### 4. Multimodal Inputs
- [ ] Upload images (vision processing)
- [ ] Upload audio files (Whisper transcription)
- [ ] Verify attachments stored
- [ ] Check attachment display

### 5. Admin Features
- [ ] View other facilitators' portfolios
- [ ] Generate quarterly reports
- [ ] Review all users (admin only)

### 6. Performance & Cost
- [ ] Compare response times (legacy vs LangChain)
- [ ] Monitor token usage
- [ ] Check API costs
- [ ] Verify tool execution efficiency

## Known Differences

### LangChain System Advantages
✓ More flexible agent orchestration
✓ Better observability with LangSmith (when enabled)
✓ Easier to add new agents (Report, Supervisor)
✓ Modern React Agent pattern (not deprecated)
✓ Better context management

### LangChain System Capabilities
✓ Full vision processing with GPT-4o Vision
✓ AI-generated quarterly report narratives
✓ Supervisor-based workflow orchestration
✓ Requires facilitator profile (stricter validation for safety)

## Troubleshooting

### LangChain Path Issues

**Error**: "Facilitator profile required"
- **Cause**: User doesn't have a facilitator profile
- **Fix**: Complete profile first or use legacy system

**Error**: "searchGlobalMemories is not a function"
- **Cause**: Wrong import from vector-memory.ts
- **Fix**: Use `searchGlobalMemory` (singular)

**Error**: "AgentExecutor is deprecated"
- **Cause**: Using old LangChain patterns
- **Fix**: Switched to `createReactAgent` from @langchain/langgraph

### Legacy Path Issues

**Error**: OpenAI Assistant thread not found
- **Cause**: Thread was deleted or expired
- **Fix**: System automatically creates new thread

## Implementation Status

1. ✅ **Completed**: Basic LangChain agent with portfolio tools
2. ✅ **Completed**: Feature flag for A/B testing
3. ✅ **Completed**: Qdrant semantic search integration
4. ✅ **Completed**: Report Agent for AI-generated narratives
5. ✅ **Completed**: Supervisor Agent for workflow orchestration
6. ✅ **Completed**: Vision processing with GPT-4o Vision
7. 🔄 **In Progress**: End-to-end testing
8. ⏳ **Pending**: LangSmith observability setup (optional)

## Testing Commands

```bash
# Check current feature flag value
echo $USE_LANGCHAIN

# Switch to LangChain system
export USE_LANGCHAIN=true

# Switch to legacy system
export USE_LANGCHAIN=false

# Restart server to apply changes
npm run dev
```

## Monitoring

Watch server logs for:
- `[LangChain] Processing message with multi-agent system`
- `[OpenAI Assistant] Processing message with Assistant API`
- Tool execution logs
- Qdrant search results
- Error traces

## Success Criteria

✅ Both systems produce accurate responses
✅ Portfolio tools work identically in both systems
✅ Context injection provides relevant information
✅ No regressions in existing features
✅ Performance is acceptable (<10s response time)
✅ Costs are manageable (~$0.01-0.05 per interaction)
