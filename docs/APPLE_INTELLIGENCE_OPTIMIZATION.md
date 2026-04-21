# Apple Intelligence Optimization Technical Specification

## Overview

This document outlines the technical improvements needed to optimize Apple Intelligence performance in the Musclog app. Current issues include context overload, prompt bloat, and poor response quality due to on-device AI limitations.

## Current Issues Identified

### Symptoms
- AI responses are incoherent and repetitive
- Model frequently says "Sorry, I can't assist with that"
- Responses get cut off mid-sentence
- Poor conversational context retention

### Root Causes
1. **System Prompt Bloat**: Comprehensive Loggy persona + dynamic context injection
2. **Unrestricted Message History**: Full conversation history sent to on-device model
3. **Apple Intelligence Limitations**: Smaller context windows and less tolerance for complexity

## Technical Solutions

### 1. Provider-Aware Configuration System

#### 1.1 Enhanced AiService Configuration
```typescript
// In services/AiService.ts
interface ProviderConfig {
  provider: CoachAIProvider;
  maxHistoryLength: number;
  promptComplexity: 'minimal' | 'standard' | 'full';
  enableContextInjection: boolean;
  enableFoundationFoods: boolean;
}

const PROVIDER_CONFIGS: Record<CoachAIProvider, ProviderConfig> = {
  'on-device': {
    maxHistoryLength: 6,
    promptComplexity: 'minimal',
    enableContextInjection: false,
    enableFoundationFoods: false,
  },
  'gemini': {
    maxHistoryLength: 20,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
  },
  'openai': {
    maxHistoryLength: 20,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
  },
  // ... other providers
};
```

#### 1.2 Context Window Management
```typescript
// In utils/coachAI.ts
function truncateHistory(history: ChatHistoryEntry[], maxLength: number): ChatHistoryEntry[] {
  return history.slice(-maxLength);
}

function normalizeHistoryForProvider(history: ChatHistoryEntry[], provider: CoachAIProvider): ChatHistoryEntry[] {
  const config = PROVIDER_CONFIGS[provider];
  return truncateHistory(history, config.maxHistoryLength);
}
```

### 2. Tiered Prompt System

#### 2.1 Minimal Prompt for Apple Intelligence
```typescript
// In utils/prompts.ts
export const getMinimalSystemPrompt = async (
  language: string = 'en-US',
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  return `You are Loggy, a friendly fitness coach.
Respond in ${language}. Be helpful and concise.
Focus only on fitness and nutrition topics.
Keep responses under 100 words.`;
};

export const getStandardSystemPrompt = async (
  language: string = 'en-US',
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  // Current implementation with full persona
  return await getBaseSystemPrompt(language, context);
};
```

#### 2.2 Context-Aware Prompt Selection
```typescript
export const getSystemPromptForProvider = async (
  provider: CoachAIProvider,
  language: string = 'en-US',
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> => {
  const config = PROVIDER_CONFIGS[provider];
  
  switch (config.promptComplexity) {
    case 'minimal':
      return await getMinimalSystemPrompt(language, context);
    case 'standard':
      return await getStandardSystemPrompt(language, context);
    case 'full':
      return await getBaseSystemPrompt(language, context);
    default:
      return await getMinimalSystemPrompt(language, context);
  }
};
```

### 3. Conditional Context Injection

#### 3.1 Smart User Details Injection
```typescript
// In utils/prompts.ts
const shouldInjectUserDetails = (
  userMessage: string,
  context: string,
  provider: CoachAIProvider
): boolean => {
  const config = PROVIDER_CONFIGS[provider];
  if (!config.enableContextInjection) return false;
  
  // Only inject for specific queries
  const nutritionKeywords = ['calorie', 'protein', 'carb', 'fat', 'weight', 'diet'];
  const exerciseKeywords = ['weight', 'rep', 'set', 'lift', 'strength'];
  
  const keywords = context === 'nutrition' ? nutritionKeywords : exerciseKeywords;
  return keywords.some(keyword => userMessage.toLowerCase().includes(keyword));
};

export const getUserDetailsPromptConditional = async (
  user: User | null,
  userMessage: string,
  context: string,
  provider: CoachAIProvider
): Promise<string> => {
  if (!shouldInjectUserDetails(userMessage, context, provider)) {
    return '';
  }
  
  return await getUserDetailsPrompt(user, context);
};
```

#### 3.2 Foundation Foods Toggle
```typescript
// In utils/coachAI.ts
export async function trackMeal(
  config: CoachAIConfig,
  userMessage: string,
  base64Image?: string
): Promise<TrackMealResponse | null> {
  const providerConfig = PROVIDER_CONFIGS[config.provider];
  
  // Skip foundation foods for on-device AI
  const includeFoundationFoods = providerConfig.enableFoundationFoods 
    ? await SettingsService.getSendFoundationFoodsToLlm()
    : false;
    
  const systemPrompt = await getMealAnalysisPrompt(includeFoundationFoods, config.language);
  // ... rest of implementation
}
```

### 4. Enhanced sendViaOnDevice Function

#### 4.1 Optimized On-Device Implementation
```typescript
// In utils/coachAI.ts
async function sendViaOnDevice(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<CoachResponse> {
  // Use minimal prompt
  const systemPrompt = await getMinimalSystemPrompt(config.language, context);
  
  // Truncate history to last 6 messages
  const truncatedHistory = truncateHistory(history, 6);
  
  // Skip complex response schema for on-device
  const simplifiedSchema = {
    type: 'object',
    properties: {
      msg4User: { type: 'string' },
      sumMsg: { type: 'string' },
    },
    required: ['msg4User', 'sumMsg'],
    additionalProperties: false,
  };

  try {
    const messages = [
      ...truncatedHistory.map((e) => ({
        role: (e.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: e.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const raw = await sendOnDeviceMessage(messages, systemPrompt);
    return {
      msg4User: raw || 'I apologize, but I need more information to help you.',
      sumMsg: raw?.slice(0, 120) || 'Unable to process request',
    };
  } catch (error) {
    handleError(error, 'coachAI.sendViaOnDevice');
    return {
      msg4User: 'I apologize, but I can only help with fitness and nutrition topics.',
      sumMsg: 'Error processing request',
    };
  }
}
```

### 5. Memory System Optimization

#### 5.1 Memory Limits for On-Device
```typescript
// In database/services/AiCustomPromptService.ts
static async getActiveMemories(
  context: 'nutrition' | 'exercise' | 'general',
  provider: CoachAIProvider
): Promise<string> {
  const config = PROVIDER_CONFIGS[provider];
  
  // Skip memories for on-device AI to reduce context
  if (provider === 'on-device') {
    return '';
  }
  
  try {
    const memories = await this.getActivePrompts(context, 'memory');
    if (memories.length === 0) {
      return '';
    }

    // Limit to 3 most recent memories
    const recentMemories = memories.slice(0, 3);
    const memoryList = recentMemories.map((m) => `- ${m.content}`).join('\n');
    return `This is your memory about the convo with this user:\n${memoryList}`;
  } catch (error) {
    console.error('[prompts] Error fetching active memories:', error);
    return '';
  }
}
```

### 6. Custom Prompt Management

#### 6.1 Provider-Specific Custom Prompts
```typescript
// In utils/prompts.ts
export const getActiveCustomPrompts = async (
  context?: 'nutrition' | 'exercise' | 'general',
  provider?: CoachAIProvider
): Promise<string> => {
  const config = provider ? PROVIDER_CONFIGS[provider] : null;
  
  // Skip custom prompts for on-device AI
  if (config?.promptComplexity === 'minimal') {
    return '';
  }
  
  try {
    const activePrompts = await AiCustomPromptService.getActivePrompts(context, 'system');
    if (activePrompts.length === 0) {
      return '';
    }
    
    // Limit custom prompts for standard complexity
    const promptLimit = config?.promptComplexity === 'standard' ? 3 : activePrompts.length;
    const limitedPrompts = activePrompts.slice(0, promptLimit);
    
    return limitedPrompts.map((p) => p.content).join('\n\n');
  } catch (error) {
    console.error('[prompts] Error fetching active custom prompts:', error);
    return '';
  }
};
```

## Implementation Plan

### Phase 1: Immediate Fixes (1-2 days)
1. **Implement history truncation** for on-device AI (last 6 messages)
2. **Create minimal system prompt** for Apple Intelligence
3. **Disable foundation foods** for on-device meal tracking
4. **Update sendViaOnDevice** with simplified schema

### Phase 2: Enhanced Architecture (3-5 days)
1. **Implement provider-aware configuration system**
2. **Create tiered prompt system** (minimal/standard/full)
3. **Add conditional context injection**
4. **Optimize memory system** for different providers

### Phase 3: Testing & Refinement (2-3 days)
1. **A/B testing** with different prompt complexities
2. **Performance benchmarking** across providers
3. **User feedback collection** and iteration
4. **Documentation updates** and team training

## Success Metrics

### Technical Metrics
- **Response coherence**: 90%+ coherent responses for Apple Intelligence
- **Context retention**: Maintain conversation context across 6+ turns
- **Response time**: <2 seconds for on-device responses
- **Error rate**: <5% failed responses

### User Experience Metrics
- **User satisfaction**: Improved AI coach ratings
- **Conversation completion**: Higher rate of successful interactions
- **Feature adoption**: Increased usage of on-device AI

## Testing Strategy

### Unit Tests
```typescript
describe('Apple Intelligence Optimization', () => {
  test('should truncate history to 6 messages for on-device', () => {
    const longHistory = Array(20).fill({ role: 'user', content: 'test' });
    const truncated = truncateHistory(longHistory, 6);
    expect(truncated).toHaveLength(6);
  });

  test('should use minimal prompt for on-device', async () => {
    const prompt = await getMinimalSystemPrompt('en-US', 'general');
    expect(prompt.length).toBeLessThan(200);
  });
});
```

### Integration Tests
- Test full conversation flow with Apple Intelligence
- Verify context injection behavior across providers
- Validate meal tracking without foundation foods

### User Testing
- A/B test different history lengths (4, 6, 8 messages)
- Test prompt complexity variations
- Collect feedback on response quality

## Rollout Plan

### Stage 1: Internal Testing
- Deploy to development environment
- Test with internal team members
- Gather feedback and iterate

### Stage 2: Beta Release
- Release to beta users
- Monitor performance metrics
- Collect user feedback

### Stage 3: Full Release
- Deploy to production
- Monitor system performance
- Continue optimization based on usage data

## Future Considerations

### Advanced Optimizations
1. **Dynamic context window sizing** based on conversation complexity
2. **Smart summarization** for older messages
3. **Provider-specific prompt templates**
4. **Machine learning-based prompt optimization**

### Platform Expansion
1. **Android on-device AI** support
2. **Web-based local AI** integration
3. **Cross-platform consistency** improvements

## Conclusion

These optimizations should significantly improve Apple Intelligence performance by reducing context overload and tailoring the experience to on-device AI capabilities. The tiered approach ensures that more powerful cloud providers continue to offer full functionality while on-device AI provides a streamlined, responsive experience.

The key insight is that **Apple Intelligence requires a different approach** than cloud models - focused, concise interactions rather than complex, context-heavy conversations.
