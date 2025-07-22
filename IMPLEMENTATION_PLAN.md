# AI Retrospective Food Tracking Implementation Plan

## Overview
Add a new feature that allows users to track food retrospectively using AI by describing what they ate in natural language for any past date.

## Feature Requirements
- [ ] Add a button with letter icon (A/AI) in dashboard and food tracking screens
- [ ] Create modal with date picker and textarea for user input
- [ ] Integrate with existing LLM API to parse nutrition from text
- [ ] Show AI results preview before saving
- [ ] Allow user confirmation before committing data
- [ ] Support different meal types (breakfast, lunch, dinner, snack)

## Implementation Checklist

### 1. Create New Components
- [x] Create `RetrospectiveFoodTrackingModal.tsx` component
- [x] Create `AiNutritionPreview.tsx` component for displaying parsed results (integrated into main modal)

### 2. Update Existing Components
- [x] Add AI tracking button to dashboard (`app/dashboard.tsx`)
- [x] Add AI tracking button to food log screen (`app/foodLog.tsx`)
- [x] Update FAB actions in food log to include retrospective tracking

### 3. API Integration
- [x] Extend existing nutrition parsing functions to support retrospective tracking
- [x] Add date parameter to nutrition parsing API calls
- [x] Ensure proper meal type categorization in AI responses

### 4. Database Integration
- [x] Batch insert multiple nutrition entries from AI response
- [x] Handle date-specific nutrition tracking
- [x] Ensure proper meal type assignment

### 5. UI/UX Implementation
- [x] Design and implement modal UI with date picker
- [x] Add textarea for user food description input
- [x] Create preview interface for AI parsed results
- [x] Add confirmation/edit interface before saving

### 6. Testing & Integration
- [ ] Test with various text inputs
- [ ] Verify date picker functionality
- [ ] Test AI response parsing and display
- [ ] Validate database insertion
- [ ] Test on both web and mobile platforms

### 7. Constants & Types
- [x] Add new modal state types
- [x] Add retrospective tracking constants
- [x] Update nutrition tracking types if needed

### 8. Localization
- [x] Add translation keys for new modal text
- [x] Update language files (en-us.json)

### 9. Final Testing & PR
- [ ] Comprehensive testing of the full feature
- [ ] Code review and cleanup
- [ ] Create pull request with detailed description

## Technical Architecture

### New Files to Create:
1. `components/RetrospectiveFoodTrackingModal.tsx` - Main modal component
2. `components/AiNutritionPreview.tsx` - AI results preview component

### Files to Modify:
1. `app/dashboard.tsx` - Add AI tracking button
2. `app/foodLog.tsx` - Add AI tracking to FAB actions
3. `utils/ai.ts` - Extend nutrition parsing if needed
4. `lang/locales/en-us.json` - Add new translations

### Dependencies:
- Utilize existing AI infrastructure (OpenAI/Gemini)
- Use existing date picker components
- Leverage current nutrition tracking database functions
- Build on existing modal and UI components

## Icon & Button Design
- Use letter "A" or "AI" icon (FontAwesome5: "robot" or "brain")
- Position consistently with other tracking buttons
- Maintain app's design language and theming
