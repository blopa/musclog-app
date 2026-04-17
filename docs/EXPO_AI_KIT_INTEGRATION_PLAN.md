# Plan: Integrate `expo-ai-kit` (on-device AI) with Musclog

This document describes how to add **on-device AI** via [`expo-ai-kit`](https://expo-ai-kit.dev/) and surface it in **`components/modals/AISettingsModal.tsx`**, showing the option **only when the device reports support**. It aligns with the existing stack described in `AGENTS.md` (Expo, `SettingsService`, `coachAI`, translations).

---

## 1. Goals

1. **Install and configure** `expo-ai-kit` for native iOS/Android builds (not web).
2. **Persist a user preference** to prefer on-device AI when available (new WatermelonDB setting + `SettingsService` + `SettingsContext` + `useDebouncedSettings`).
3. **Expose the toggle in `AISettingsModal`** only when `expo-ai-kit` reports availability (`isAvailable()`), with clear copy about privacy and limitations.
4. **Route AI calls** through a single decision point (today: `AiService.getAiConfig()` → `utils/coachAI.ts`) so coach/nutrition flows can use on-device inference where appropriate.

**Non-goals (unless you explicitly expand scope):**

- Replacing every cloud LLM path in one release (function-calling, vision, structured JSON for meal tracking differ greatly from a local prompt API).
- Supporting **web** via `expo-ai-kit` (the library is native; web would stay on existing providers or show “not available”).

---

## 2. What `expo-ai-kit` provides (summary)

Per the [expo-ai-kit README](https://github.com/laraelmas/expo-ai-kit) and [npm package](https://www.npmjs.com/package/expo-ai-kit):

| Platform              | Backend                                                                                     | Notes                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **iOS 26+**           | Apple Foundation Models                                                                     | Full support.                                                                                             |
| **iOS &lt; 26**       | —                                                                                           | Fallback behavior (not suitable for production on-device UX).                                             |
| **Android**           | ML Kit **Prompt API** (on-device; Google documents this on top of **AICore / Gemini Nano**) | Only on **Google-listed supported devices** (see §4). First use may trigger model availability on device. |
| **Android (broader)** | Optional **Gemma 4** via LiteRT-LM                                                          | Downloadable models; separate code path from “system” ML Kit prompt.                                      |

**API surface (typical):**

- `isAvailable()` — use this to **gate the settings UI** and runtime.
- `sendMessage` / `streamMessage` — chat-style messages + optional `systemPrompt`.
- Helpers: summarization, rewrite, etc. (see package docs).

**Requirements:** Expo SDK **54+** (this repo uses **Expo 55**, which satisfies that). Android **minSdkVersion 26+** and `expo-build-properties` as documented by the package.

**Official platform doc:** [expo-ai-kit — Platform support](https://expo-ai-kit.dev/guides/platform-support) (if the site is a SPA with little static HTML, treat the [GitHub README](https://github.com/laraelmas/expo-ai-kit/blob/main/README.md) as the source of truth—it matches npm.)

---

## 3. Current app integration points (for implementers)

| Area                                    | Role                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `services/AiService.ts`                 | Resolves `CoachAIConfig`: Gemini key → OpenAI key → `null`.                                        |
| `utils/coachAI.ts`                      | `CoachAIProvider` is `'gemini' \| 'openai'`; all model calls branch on provider.                   |
| `components/modals/AISettingsModal.tsx` | Gemini/OpenAI cards, insights toggles, debounced settings via `useDebouncedSettings`.              |
| `hooks/useDebouncedSettings.ts`         | Optimistic UI + debounced `SettingsService` writes; extend keys + `flushAllPendingChanges` switch. |
| `context/SettingsContext.tsx`           | Loads settings into React context; add new type + default + map from DB.                           |
| `constants/settings.ts`                 | Setting type string constants.                                                                     |
| `database/services/SettingsService.ts`  | Getters/setters for each setting.                                                                  |
| `lang/*.json`                           | All user-visible strings (per `AGENTS.md`).                                                        |

---

## 4. Which phones are “supported”? (Android + iOS)

### 4.1 Runtime truth: `isAvailable()`

**Recommendation:** Treat **`await isAvailable()` from `expo-ai-kit`** as the **only** hard gate for showing the toggle and enabling the feature. OEM lists drift; OS updates can widen or narrow support.

Optionally cache the result for the session (e.g. React state set once when `AISettingsModal` opens) to avoid repeated native calls.

### 4.2 Android: ML Kit Prompt API device lists (reference)

Google maintains an explicit list under **Device support → Prompt API** in [ML Kit GenAI overview](https://developers.google.com/ml-kit/genai#prompt-device). As of documentation captured for this plan, devices are grouped by **nano-v2** vs **nano-v3** (model generation on device). Examples include (not exhaustive—see Google’s page for the canonical table):

- **nano-v2:** Pixel 9 family, several Honor / iQOO / Motorola / OnePlus / OPPO / POCO / realme / Samsung (e.g. Z Fold7) / Xiaomi / vivo devices.
- **nano-v3:** Pixel 10 family, additional Honor / iQOO / Motorola / OnePlus / OPPO / realme / Samsung Galaxy S26 family / vivo / Xiaomi devices.

**Implication:** Many Android 26+ devices **do not** have Prompt API support; they will get **empty/fallback** behavior if called—hence **`isAvailable()` before UI**.

**Also note Google’s constraints:** GenAI inference is **foreground-only**; per-app **quotas** and errors like `BUSY` / battery quota may apply—see the same ML Kit page.

### 4.3 iOS

- **iOS 26+** with Apple Foundation Models: aligned with expo-ai-kit “full support.”
- Older iOS: expo-ai-kit documents **limited/fallback** behavior—**do not** show the on-device option unless `isAvailable()` is true (or you additionally require `Platform.Version` ≥ 26).

### 4.4 Web

- **Hide** on-device section on web (`Platform.OS === 'web'` or `isStaticExport` if applicable). No native module.

---

## 5. Implementation phases

### Phase A — Dependencies & native project

1. **`npx expo install expo-ai-kit`** (pin version in `package.json`).
2. **Android:** Ensure `expo-build-properties` sets **`minSdkVersion: 26`** if not already (expo-ai-kit README shows `app.json` plugin snippet).
3. **Run prebuild / EAS dev client** — `expo-ai-kit` requires **native code**; **Expo Go is insufficient** for real validation. Document for the team: use **development build**.
4. **`pod install`** / iOS prebuild after install.
5. **CI / typecheck:** ensure `expo-ai-kit` types resolve; add **lazy `import()`** or a thin wrapper module if you need to avoid bundling on web (see Phase E).

### Phase B — Settings persistence

1. **`constants/settings.ts`**
   - Add e.g. `USE_ON_DEVICE_AI_SETTING_TYPE = 'use_on_device_ai'` (boolean).
   - Optionally add `ON_DEVICE_AI_AVAILABLE_CACHE_SETTING_TYPE` — **not recommended** for long-term truth; prefer in-session memory. If you cache “last known availability,” handle OS upgrades gracefully.

2. **`SettingsService.ts`**
   - `getUseOnDeviceAi()` / `setUseOnDeviceAi(boolean)` (mirror existing patterns).

3. **`SettingsContext.tsx`**
   - Add field to state, defaults, loading from `Setting` rows, and `UseSettingsResult` / `SettingsContextType` if defined in `constants/settings.ts`.

4. **`hooks/useDebouncedSettings.ts`**
   - Include the new key in initial `keys` array, add `handleUseOnDeviceAiChange`, and a **`flushAllPendingChanges`** case.

5. **`constants/exportImport.ts`** (if settings are exported)
   - Include the new type so backups stay consistent.

6. **Schema/migrations**
   - If new setting rows need defaults via migration, follow existing WatermelonDB migration patterns used for other boolean settings.

### Phase C — `AISettingsModal.tsx` UI

1. **On modal open (or `useEffect` when `visible`):**
   - If `Platform.OS === 'web'`, skip.
   - Else call **`isAvailable()`**; store in `useState`. Handle loading and errors (default to “not available” on error).

2. **Render:**
   - New section (e.g. “On-device AI”) **only if** `isOnDeviceAiAvailable === true`.
   - **Toggle:** “Use on-device AI when possible” bound to debounced setting.
   - **Copy:** No API keys; data stays on device; **may be lower quality** than cloud; **foreground-only** on Android per Google; **not for all coach features** until Phase D scopes them.

3. **UX interaction with existing toggles:**
   - **Decision for product:**
     - **Option 1 — Independent:** User can enable on-device + keep API keys for features that still need cloud.
     - **Option 2 — Priority:** If on-device enabled and available, `AiService` prefers it; cloud is fallback when on-device unsupported or fails.
     - **Option 3 — Mutual exclusion:** Enabling on-device disables Gemini/OpenAI (simplest mentally, may frustrate power users).
   - The plan recommends **Option 2** unless you want strict privacy (then Option 3).

4. **Icons / layout:** Reuse patterns from existing `ToggleInput` blocks in the same file.

### Phase D — Runtime: `AiService` + `coachAI`

This is the largest design choice.

1. **Extend `CoachAIConfig`** in `utils/coachAI.ts`, e.g.  
   `provider: 'gemini' | 'openai' | 'on-device'`  
   with **no API key** for on-device.

2. **`AiService.getAiConfig()`** resolution order (example):
   - If `SettingsService.getUseOnDeviceAi()` and **`await isAvailable()`** → return `{ provider: 'on-device', model: 'on-device', language }`.
   - Else existing Gemini → OpenAI → `null`.

3. **Implement on-device execution path** in `coachAI.ts` (or a dedicated `services/OnDeviceAiService.ts` called from coach):
   - Map “coach” prompts to **`sendMessage` / `streamMessage`** with `systemPrompt` from `utils/prompts.ts` where feasible.
   - **Critical:** On-device models **do not** replicate OpenAI function calling / strict JSON tool use. Features that rely on **`makeSchemaStrict`**, tool calls, or vision **must** either:
     - **Fall back** to cloud when on-device is selected but the feature requires tools, or
     - **Disable** those actions with a user-visible message.

4. **Structured outputs (meal tracking, workout plans, etc.):**
   - Plan either:
     - **Heuristic JSON parse** with validation + retry (fragile), or
     - **Hybrid:** on-device only for **free-text** coach chat; cloud for structured flows.
   - Document the chosen split in code comments and user-facing strings.

5. **Streaming UI:** If coach UI already streams for cloud, mirror with `streamMessage` from expo-ai-kit for parity.

### Phase E — Web / static export safety

- Guard **all** imports of `expo-ai-kit` so **web bundles** do not load the native module (Metro may still try to resolve). Common patterns:
  - `if (Platform.OS !== 'web') { const { isAvailable } = await import('expo-ai-kit'); ... }`
  - Or a **`native/onDeviceAi.ts`** + **`onDeviceAi.web.ts`** stub exporting `isAvailable: async () => false`.

### Phase F — Localization

- Add keys under `settings.aiSettings.*` (or a nested `onDeviceAi.*`) in **all** locale files in `lang/`.
- Run `npm run check-translations` after adding keys.

### Phase G — Testing & QA

| Case                                | Expectation                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| iOS 26+ supported device            | `isAvailable()` true; toggle visible; responses return text.                                    |
| iOS &lt; 26                         | Toggle hidden or false; no crash.                                                               |
| Android supported (see Google list) | Toggle visible after `isAvailable()` true.                                                      |
| Android API 26+ unsupported         | Toggle hidden; no native crash if user somehow had old setting—fallback in `AiService`.         |
| Web                                 | No on-device section.                                                                           |
| Airplane mode                       | On-device still works (subject to model already on device).                                     |
| Background / Android quota          | Handle errors gracefully; optionally surface “try again” per Google docs.                       |
| Imperial + i18n                     | Unrelated to AI kit but keep **number formatting** rules from `AGENTS.md` for any numeric copy. |

---

## 6. Risks and mitigations

| Risk                                     | Mitigation                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Feature parity**                       | Hybrid routing: on-device for chat-only; cloud for tools/vision/JSON.                                                   |
| **Expo Go**                              | Document dev builds; optional runtime check + message.                                                                  |
| **False negatives from `isAvailable()`** | Rare; user can still use cloud providers.                                                                               |
| **False positives**                      | If `isAvailable()` true but calls fail, catch and fall back to cloud or show error.                                     |
| **App Store / Play policy**              | On-device is generally privacy-positive; still disclose in privacy policy if you log errors containing prompts (avoid). |

---

## 7. Open questions (for you)

1. **Scope:** Should on-device AI apply to **all** coach/nutrition LLM entry points, or only **e.g. coach chat** first?
2. **Fallback:** When on-device is enabled but a feature needs **function calling** or **images**, should the app **automatically use Gemini/OpenAI** if keys exist, or **block** the action?
3. **Gemma 4:** Do you want the **downloadable Gemma** path from expo-ai-kit on Android (larger binary / first-run download) in v1, or **ML Kit only**?
4. **Default:** Should new installs default `use_on_device_ai` to **false** until user opts in (recommended for predictable behavior)?
5. **iOS 26:** Is your minimum iOS deployment target going to track **26** soon, or will many users stay below—driving mostly-Android adoption of this toggle?

---

## 8. Reference links

- [expo-ai-kit documentation](https://expo-ai-kit.dev/)
- [expo-ai-kit — Platform support](https://expo-ai-kit.dev/guides/platform-support)
- [expo-ai-kit source / README](https://github.com/laraelmas/expo-ai-kit)
- [Google ML Kit GenAI — device support (Prompt API)](https://developers.google.com/ml-kit/genai#prompt-device)
- [Gemini Nano / AICore (Android)](https://developer.android.com/ai/gemini-nano)

---

## 9. Suggested checklist (execution order)

- [ ] Install `expo-ai-kit` + Android `minSdkVersion` / plugins.
- [ ] Verify **dev client** on one **iOS 26+** device and one **ML Kit Prompt–listed** Android device (`isAvailable()` + `sendMessage`).
- [ ] Add setting type + `SettingsService` + context + debounced hook + export list.
- [ ] `AISettingsModal`: async `isAvailable()`, conditional section + translations.
- [ ] `AiService` + `CoachAIConfig` + `coachAI` branches + hybrid/fallback policy.
- [ ] Web stub / dynamic import.
- [ ] `npm run lint:all` / `check-translations` / targeted manual QA.

Once you answer the **open questions (§7)**, an implementer can lock the **routing policy** in Phase D without rework.
