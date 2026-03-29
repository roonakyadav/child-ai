# Child-AI: Intelligent Digital Mentor & Behavioral Analytics

Child-AI is a production-grade, AI-powered companion designed to provide children with a safe, educational, and engaging environment while giving parents deep, data-driven insights into their child's learning progress and emotional well-being.

The application leverages the **Groq Llama 3.1** model for high-performance natural language processing, combined with a deterministic logic layer to ensure reliability in critical areas like quiz evaluation and safety enforcement.

---

## 🌟 Core Features

### 1. **Intelligent AI Buddy (The Mentor)**
- **Adaptive Personalities**: Switch between modes like **Kid-Safe** (bubbly & simple), **Learning** (academic & terminology-focused), **Focus** (concise & direct), and **Creative** (storytelling & vivid).
- **Ambiguity Handling**: Unlike standard chatbots, Child-AI detects short or unclear inputs (e.g., "banana") and asks clarifying questions instead of making wrong assumptions.
- **Contextual Memory**: Remembers the last 10 interactions to maintain a coherent conversation flow and avoid repetition.

### 2. **Deterministic Quiz System**
- **Structured State**: Quizzes are generated as JSON objects and stored in global state.
- **Reliable Evaluation**: Correctness is checked via code logic (`userAnswer === correctAnswer`), not by asking the AI, ensuring 100% accuracy.
- **Educational Feedback**: The AI is used only for tone and formatting the explanation, keeping the logic strictly deterministic.

### 3. **Parental Intelligence Dashboard**
- **Learning Intelligence**: A unified view of top interests (Math, Science, etc.), skill development metrics, and academic streaks.
- **Engagement Analytics**: Tracks usage trends, peak activity times, and interaction density across the week.
- **Safety Alerts**: Real-time LLM-based risk detection flags suspicious intent, emotional distress, or harmful content.
- **Deep Analysis**: Parents can click any AI insight to see a domain-scoped behavioral report with evidence messages and recommended actions.

### 4. **Parental Controls & Safety**
- **AI Behavior Toggles**: Granular control over safety filtering, curiosity encouragement, response length, and more.
- **Safety Guardrails**: Interactive slider to adjust the AI's strictness from "Soft" to "Strict".
- **Intelligent Screen Time**: A behavior-aware timer that can grant "Bonus Time" for educational interactions (Learning Mode).
- **Live AI Preview**: Test AI configurations in real-time before applying them to the child's environment.

---

## 🏗️ Technical Architecture

### **Frontend Stack**
- **Framework**: React + Vite + TypeScript
- **Styling**: Tailwind CSS + Framer Motion (for fluid animations)
- **UI Components**: Radix UI + Lucide Icons
- **State Management**: Custom `localStorage` stores (`intentStore`, `configStore`, `conversationStore`) for persistent, data-driven behavior.

### **Backend Stack**
- **Server**: Node.js + Express
- **AI Provider**: Groq API (Llama 3.1 8B/70B)
- **Secret Management**: Environment-based API key handling for secure GitHub deployments.

### **Global Memory & Data Flow**
The app is built on a **fully data-driven architecture**:
1. **Config Store**: All hardcoded strings, thresholds, and AI parameters are centralized in `src/lib/configStore.ts`.
2. **Intent Tracking**: The system tracks if the child is in "Quiz", "Story", or "General" mode to adjust prompt constraints dynamically.
3. **Activity Logger**: Every interaction is logged with sentiment scores and risk categories for parent analytics.

---

## 🚀 Getting Started

### **1. Prerequisites**
- Node.js (v18+)
- A Groq API Key

### **2. Installation**
```bash
# Clone the repository
git clone https://github.com/roonakyadav/child-ai.git
cd child-ai

# Install dependencies for frontend and backend
npm install
cd backend && npm install
```

### **3. Configuration**
Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEY=your_api_key_here
```

### **4. Running the App**
```bash
# Start the backend server (from /backend)
node server.js

# Start the frontend (from root)
npm run dev
```

---

## 📂 Project Structure

- `src/lib/`: Core logic modules (Intelligence Engine, Screen Time, Safety, API).
- `src/pages/`: Frontend views (Chat Interface, Parent Dashboard modules).
- `src/components/`: Reusable UI elements and layouts.
- `backend/`: Express server for AI proxying and PDF report generation.

---

## 🛡️ Security & Privacy
Child-AI is built with a **Safety-First** philosophy. No data is sent to external servers except for the anonymized AI prompts handled by Groq. All behavioral analytics and conversation history are stored **locally** on the device via `localStorage`.

---

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

---

*Built with ❤️ for the next generation of learners.*
