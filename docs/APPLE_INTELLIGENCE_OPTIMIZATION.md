# Apple Intelligence Technical Specification: Performance Optimization & Chat Loop Resolution

## 1. Overview
This specification addresses two critical areas of the Musclog AI experience:
1. **Chat Loop Resolution**: Eliminating repetitive, canned responses and language confusion through advanced prompt engineering and meta-conversation logic.
2. **On-Device Optimization**: Managing hardware limitations (memory/tokens) for Apple Intelligence via character-budgeted context windows and tiered prompt injection.

---

## 2. Architecture: Provider-Aware Configuration
To maintain performance across different environments, AI providers are governed by a `PROVIDER_CONFIGS` registry in `utils/coachAI.ts`.

| Feature | On-Device (Apple Intelligence) | Cloud (Standard) |
| :--- | :--- | :--- |
| **maxCharBudget** | ~2,000 chars (~500 tokens) | 16,000+ chars |
| **Prompt Complexity** | Minimal / Compressed | Full "Loggy PhD" Persona |
| **Foundation Foods** | Disabled (Schema reduction) | Enabled |
| **Memories** | Disabled (Context preservation) | Enabled |
| **Response Diversity** | Active (Local tracking) | Active (Server/Local) |

---

## 3. System Prompt Redesign (The "Loggy" Persona)

### 3.1 Tiered Prompt Injection
We utilize a compressed version of the "Loggy" persona to prevent "prompt bloat" while maintaining the core personality requirements.

* **Persona Core**: Specialized fitness/nutrition assistant.
* **User Stats (Compressed)**: Injected as a tag: `[User: Male, 85kg, 15%BF, hypertrophy]`.
* **Workout Summaries**: One-line summaries instead of JSON: `User finished "Push Day" on 2026-04-22: 5400 kg volume, 18 sets.`

### 3.2 Conversation & Meta-Rules
To solve the repetitive loop behavior, the system prompt includes specific logic for meta-conversation and self-awareness:

```swift
// CORE CONVERSATION GUIDELINES
- If asked about topics outside your domain, politely explain your specialization.
- Never repeat the exact same response consecutively.
- Acknowledge and respond to meta-questions about your behavior ("Why are you repeating yourself?").
- Detect language automatically; default to the user's language (no unprompted mentions of Portuguese/English).
- If you notice repetition, explicitly acknowledge it: "You're right, I'm repeating myself. Let's try a different approach."
```

---

## 4. Context & Loop Management

### 4.1 Budget-Based Truncation
Instead of message counts, `truncateHistoryByBudget` traverses history backwards until the `maxCharBudget` is reached. This ensures the model receives the most recent data without exceeding the 4,096 token hardware limit or the tighter 2,000 char on-device cap.

### 4.2 Response Diversity System
To prevent the "Canned Response" loop, we implement a similarity checker to monitor outbound messages.

```swift
class ResponseDiversityChecker {
    private var recentResponses: [String] = []
    private let maxHistorySize = 3

    func isRepetitive(_ newResponse: String) -> Bool {
        return recentResponses.contains { response in
            similarity(newResponse, response) > 0.8 // 80% similarity threshold
        }
    }

    func processOutbound(response: String) -> String {
        if isRepetitive(response) {
            return "I apologize, I'm getting stuck in a loop. Let's pivot: how else can I help with your [User Goal]?"
        }
        updateHistory(response)
        return response
    }
}
```

---

## 5. Feature Degradation & Reliability

### 5.1 On-Device Feature Toggles
When Apple Intelligence is active, the following features are disabled via `AISettingsModal.tsx` to prevent memory-related crashes:
* **Foundation Foods Database**: Reduces system prompt size by several thousand characters.
* **Historical Memories**: Preserves the narrow context window for current conversation flow.

### 5.2 Error Handling & Fallbacks
* **No Cloud Fallback**: Per user directive, the local model is treated as a specialized, air-gapped tool; it does not failover to cloud providers.
* **Graceful Refusal**: Refusals must be personalized. Avoid: "I can't help with that." Use: "I'm focused on your fitness logs right now; I can't help with [topic], but we could adjust your Push Day volume?"

---

## 6. Implementation & Testing Plan

### Phase 1: Optimization (Architecture)
1. Implement `PROVIDER_CONFIGS` registry.
2. Integrate `truncateHistoryByBudget` logic.
3. Apply compressed User/Workout tag injection.

### Phase 2: Chat Loop Fix (Logic)
1. Update system prompts with Meta-Conversation rules.
2. Deploy `ResponseDiversityChecker`.
3. Fix language detection logic (removing unprompted capability mentions).

### Phase 3: Success Metrics
* **Repetition Rate**: Target < 2%.
* **On-Device Crash Rate**: Target 0% (Memory-bound).
* **Response Latency**: Ensure budget-based truncation keeps time-to-first-token low.

---

## 7. Conclusion
By combining **Character Budgets** for hardware efficiency with **Diversity Tracking** for conversational quality, Musclog provides a private, fast, and intelligent experience. The focus shifts from "technical limitations" to "intentional prompt design," ensuring the AI remains helpful without falling into repetitive cycles.
