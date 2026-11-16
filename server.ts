import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!getApps().length && firebaseConfig.projectId) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function resolveOptionalUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

function buildLanguageInstruction(language: string): string {
  if (language === 'hausa') {
    return (
      'Respond entirely in clear, natural, modern standard Hausa (Hausa mai kyau da saukin fahimta). ' +
      'Keep mathematical equations, chemical formulas, and programming syntax in standard notation while explaining every step clearly in Hausa.'
    );
  }
  if (language === 'bilingual') {
    return (
      'Provide a clear, structured explanation in English first, followed by a section titled "## Fassarar Hausa (Hausa Summary)" ' +
      'that summarizes the core explanation and final answer in clear, natural Hausa.'
    );
  }
  return 'Respond in clear, encouraging, academic English suitable for Nigerian secondary school and university students.';
}

function buildExamInstruction(examFocus: string): string {
  switch (examFocus) {
    case 'jamb':
      return 'Tailor explanations to JAMB UTME speed, accuracy, common distractor traps, and quick solving methods.';
    case 'waec':
      return 'Tailor explanations to WAEC / NECO theory and objective marking schemes, showing full working steps for maximum marks.';
    case 'university':
      return 'Tailor explanations to Nigerian university undergraduate depth (100L-400L) with rigorous definitions and worked derivations.';
    case 'coding':
      return 'Tailor explanations to software engineering, computer science, and practical product building.';
    default:
      return 'Tailor explanations to Nigerian secondary and tertiary students preparing for WAEC, NECO, JAMB, or coursework.';
  }
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('not configured')) {
    return {
      status: 400,
      message: 'Gemini API key is missing or invalid. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit reached. Please wait a moment and try again.',
    };
  }
  return {
    status: 500,
    message: raw || 'An unexpected error occurred while generating the AI response.',
  };
}

function initSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

function sendSSE(res: Response, payload: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: "Scorer's Study AI" });
  });

  // 1. Streaming Study Chat (English / Hausa / Bilingual)
  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    await resolveOptionalUser(req);
    const body = req.body as {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      language?: string;
      examFocus?: string;
      explanationDepth?: string;
    };

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      res.status(400).json({ error: 'At least one message is required.' });
      return;
    }

    const language = body.language || 'english';
    const examFocus = body.examFocus || 'general';
    const explanationDepth = body.explanationDepth || 'step-by-step';

    const depthInstruction =
      explanationDepth === 'concise'
        ? 'Keep answers crisp, direct, and easy to scan quickly.'
        : 'Break down answers step by step with clear headings, bullet points, and a quick key takeaway.';

    const systemInstruction = [
      'You are Scorer\'s Study AI ("Score Higher, Study Smarter"), an expert, supportive academic tutor built for Nigerian students.',
      buildLanguageInstruction(language),
      buildExamInstruction(examFocus),
      depthInstruction,
      'Format responses in clean Markdown. Never fabricate citations or pretend to run external tools.',
    ].join(' ');

    const contents = messages.slice(-20).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(msg.content || '').slice(0, 16000) }],
    }));

    initSSE(res);

    try {
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          sendSSE(res, { text: chunk.text });
        }
      }
      sendSSE(res, { done: true });
      res.end();
    } catch (err) {
      const formatted = formatGeminiError(err);
      sendSSE(res, { error: formatted.message });
      res.end();
    }
  });

  // 2. Streaming Image-to-Answer (Gemini Vision)
  app.post('/api/vision/solve', async (req: Request, res: Response) => {
    await resolveOptionalUser(req);
    const body = req.body as {
      imageBase64?: string;
      mimeType?: string;
      prompt?: string;
      language?: string;
      examFocus?: string;
    };

    const imageBase64 = body.imageBase64;
    const mimeType = body.mimeType || 'image/jpeg';
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Please upload or capture an image of your question.' });
      return;
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(mimeType)) {
      res.status(400).json({ error: 'Supported image formats are JPEG, PNG, and WebP.' });
      return;
    }

    const language = body.language || 'english';
    const examFocus = body.examFocus || 'general';
    const userPrompt = (body.prompt || '').trim();

    const systemInstruction = [
      'You are Scorer\'s Study AI Vision Solver, helping Nigerian students solve textbook pages, past questions, and handwritten assignments from photos.',
      buildLanguageInstruction(language),
      buildExamInstruction(examFocus),
      'Structure your response clearly with these sections:',
      '1. **Question Recognized** (transcribe or summarize the exact question(s) visible in the image; if blurry or unreadable, clearly state which part is unclear).',
      '2. **Concept & Formula** (identify the core topic and relevant formulas/laws).',
      '3. **Step-by-Step Solution** (show every calculation or reasoning step cleanly).',
      '4. **Final Answer** (bold and unambiguous).',
      '5. **Exam Tip** (one practical tip to avoid common mistakes).',
    ].join(' ');

    const textPrompt = userPrompt
      ? `Student instruction: ${userPrompt}\n\nPlease examine the uploaded assignment or textbook image and provide a complete step-by-step solution.`
      : 'Please examine the uploaded assignment or textbook image, transcribe the question(s), and provide a complete step-by-step solution.';

    initSSE(res);

    try {
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            { text: textPrompt },
          ],
        },
        config: {
          systemInstruction,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          sendSSE(res, { text: chunk.text });
        }
      }
      sendSSE(res, { done: true });
      res.end();
    } catch (err) {
      const formatted = formatGeminiError(err);
      sendSSE(res, { error: formatted.message });
      res.end();
    }
  });

  // 3. Streaming Prompt Generator (Lovable / Bolt.new)
  app.post('/api/prompt-generator/stream', async (req: Request, res: Response) => {
    await resolveOptionalUser(req);
    const body = req.body as {
      idea?: string;
      targetTool?: string;
      complexity?: string;
      stack?: string;
    };

    const idea = (body.idea || '').trim();
    if (!idea) {
      res.status(400).json({ error: 'Please describe the app you want to build.' });
      return;
    }

    const targetTool = body.targetTool || 'lovable-bolt';
    const complexity = body.complexity || 'production';
    const stack = body.stack || 'React + TypeScript + Tailwind CSS + Supabase';

    const toolLabel =
      targetTool === 'lovable'
        ? 'Lovable.dev'
        : targetTool === 'bolt'
        ? 'Bolt.new'
        : 'Lovable.dev and Bolt.new';

    const systemInstruction = [
      `You are a Principal Product Architect writing ready-to-paste, production-grade build prompts specifically optimized for ${toolLabel}.`,
      'Take the user\'s short app idea and expand it into a comprehensive, unambiguous engineering prompt they can paste directly into Lovable or Bolt.',
      'Your generated prompt MUST include these well-structured Markdown sections:',
      '1. **App Identity & Goal** (product name suggestion, target users, core value proposition)',
      '2. **Tech Stack & Architecture**',
      '3. **Design System & Aesthetic Direction** (color palette, typography, mobile-first layout, responsive behavior)',
      '4. **Database Schema & Auth** (exact tables/collections, columns/types, relationships, RLS/security rules)',
      '5. **Core Pages & User Flows** (detailed feature-by-feature breakdown with interactive states, forms, and APIs)',
      '6. **Edge Cases, Validation & Empty/Error States**',
      '7. **Build Constraints** (clean code, no mock/placeholder data, mobile responsiveness, accessibility)',
      `Target complexity: ${complexity === 'mvp' ? 'Focused Lean MVP (fast to ship)' : 'Full Production-Ready Application'}.`,
      `Preferred stack: ${stack}.`,
      'Write the output directly as the ready-to-copy prompt inside clean Markdown so the user can copy and paste it right away.',
    ].join(' ');

    initSSE(res);

    try {
      const ai = getGeminiClient();
      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents: `App Idea: ${idea}\n\nGenerate the complete, detailed ${toolLabel} build prompt.`,
        config: {
          systemInstruction,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          sendSSE(res, { text: chunk.text });
        }
      }
      sendSSE(res, { done: true });
      res.end();
    } catch (err) {
      const formatted = formatGeminiError(err);
      sendSSE(res, { error: formatted.message });
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Scorer's Study AI server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
