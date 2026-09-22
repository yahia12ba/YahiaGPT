# YahiaGPT 🤖🎙️

An intelligent, conversational AI companion featuring voice-to-voice communication, active memory & context recall, and an interactive animated character.

---

## Features

- **Voice-to-Voice Interaction**: Seamless speech recognition (STT) and text-to-speech (TTS) with natural male voice tuning.
- **Active Memory & Context**: Remembers user identity, conversation topics, and custom facts across messages.
- **Gemini Powered**: Uses Google's Gemini models via `@google/genai` for intelligent, context-aware responses.
- **Modern Responsive UI**: Built with React, Tailwind CSS, Lucide icons, and Motion animations.

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Google Gemini API Key**: Get one free at [Google AI Studio](https://aistudio.google.com/)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/yahiagpt.git
cd yahiagpt
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

*(See `.env.example` for reference. Never commit your `.env` file to version control.)*

### 3. Run Locally

```bash
# Start development server
npm run dev
```

Open your browser to `http://localhost:3000`.

---

## Production Build & Deployment

### Build the Application

```bash
npm run build
npm start
```

### Deployment Options

Because YahiaGPT includes a Node.js / Express backend to keep your `GEMINI_API_KEY` secure:

#### 1. Cloud Run / Render / Railway / Fly.io (Recommended)
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment Variables**: Add `GEMINI_API_KEY` in the hosting platform's environment settings.

#### 2. Docker
A standard Node.js Docker container can run YahiaGPT:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### 3. Important Note for Microphone Access
Web browsers require a secure context (**HTTPS** or `localhost`) to grant microphone permissions. Ensure your deployed production domain has SSL/HTTPS enabled.

---

## License

MIT
