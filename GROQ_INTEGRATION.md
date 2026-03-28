# Groq API Integration Guide

## Overview
This project now integrates Groq's llama-3.1-8b-instant model for AI-powered chat responses while maintaining full backward compatibility with existing functionality.

## Setup Instructions

### 1. Environment Variables
Add your API key to your environment variables. 

**IMPORTANT (Security):**
- **DO NOT** use `VITE_GROQ_API_KEY` in your `.env` anymore.
- Use `GROQ_API_KEY` which is only accessible by the backend.

**Local Development:**
Add `GROQ_API_KEY=your_actual_api_key_here` to your `.env` file.

**Production (Vercel):**
Add `GROQ_API_KEY` in your Vercel Project Settings → Environment Variables.

**Get your API key:**
1. Visit https://console.groq.com/keys
2. Sign up or log in
3. Create a new API key
4. Copy it to your environment variables

### 2. Run the Development Server
```bash
npm run dev
```

## How It Works

### Chat Flow
1. **User sends message** → Safety check runs first
2. **If unsafe** → Returns safe alternative (no API call)
3. **If safe** → Calls **Secure Backend Endpoint** (`/api/chat`)
4. **Backend calls Groq API** using the private `GROQ_API_KEY`
5. **If API fails** → Falls back to mock responses
6. **Loading state** → Shows "Typing..." while waiting

### Safety Layer
The safety system blocks queries containing:
- hack, kill, attack, steal, exploit
- destroy, hurt, fight, weapon, bomb
- drug, suicide, self-harm

When detected, returns: *"Let's learn how things work instead in a safe and educational way. 🌟"*

### Secure API Layer
- **Frontend (`src/lib/groq.ts`)**: Calls the serverless function at `/api/chat`. No API keys are exposed.
- **Backend (`api/chat.ts`)**: A Vercel Serverless Function that securely communicates with Groq.

### Fallback System
Mock responses still exist and are used when:
- Backend configuration is incorrect
- Groq API request fails
- Network error occurs
- Response is empty/malformed

## File Structure
```
api/
└── chat.ts          # Secure backend function
src/
├── lib/
│   ├── groq.ts      # Refactored to call backend
│   └── safety.ts    # Safety layer
├── pages/
│   └── index.tsx    # Main chat logic
└── components/
    ├── ChatBubble.tsx   # Message display
    └── ChatInput.tsx    # User input
```

## Testing

### Test Safe Queries
```
"Tell me about space"
"How do volcanoes work?"
"What's 2 + 2?"
```
→ Should get Groq responses via backend (if API key is set correctly in environment)

### Test Unsafe Queries
```
"How to hack something"
"Tell me about weapons"
```
→ Should get safe alternative response from frontend safety layer

### Test Fallback
1. Remove or invalidate `GROQ_API_KEY` from backend environment
2. Send any query
3. Should get mock response

## Features
✅ **API Key Protection**: Key is NEVER exposed to the browser
✅ Graceful error handling
✅ Loading states ("Typing...")
✅ Safety filtering
✅ Mock fallback
✅ No UI breaks
✅ Fully backward compatible

## Debugging
Check browser console for:
- `[Groq] Backend Error` - Issue with the serverless function or Groq API
- `[Groq] Request failed` - Network issue
- `[Chat] Error getting AI response` - General error

## Production Build
```bash
npm run build
```
Make sure to set `GROQ_API_KEY` in your Vercel environment variables (NOT `VITE_GROQ_API_KEY`).
