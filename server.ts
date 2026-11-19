import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { sanitizeServerOrderPayload } from './src/utils/catalogNormalization';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '8mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
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

// In-memory demo session order buffer (guest demo checkout orders; authenticated orders also persist to Firestore)
const sessionDemoOrders: Record<string, unknown>[] = [];

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'complex-storefront' });
});

// Brazilian CEP lookup with graceful fallback for offline/hermetic environments
app.get('/api/cep/:cep', async (req, res) => {
  const raw = String(req.params.cep || '').replace(/\D/g, '');
  if (raw.length !== 8) {
    return res.status(400).json({ error: 'CEP deve conter 8 dígitos.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`https://viacep.com.br/ws/${raw}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      if (!data.erro) {
        return res.json({
          cep: `${raw.slice(0, 5)}-${raw.slice(5)}`,
          street: String(data.logradouro || ''),
          neighborhood: String(data.bairro || ''),
          city: String(data.localidade || ''),
          state: String(data.uf || ''),
          source: 'viacep',
        });
      }
    }
  } catch {
    // Fallback below if network lookup is unavailable
  }

  const first = Number(raw[0]);
  const fallbackRegion =
    first === 0 || first === 1
      ? { city: 'São Paulo', state: 'SP' }
      : first === 2
      ? { city: 'Rio de Janeiro', state: 'RJ' }
      : first === 3
      ? { city: 'Belo Horizonte', state: 'MG' }
      : first === 8
      ? { city: 'Curitiba', state: 'PR' }
      : { city: 'Brasília', state: 'DF' };

  return res.json({
    cep: `${raw.slice(0, 5)}-${raw.slice(5)}`,
    street: '',
    neighborhood: '',
    city: fallbackRegion.city,
    state: fallbackRegion.state,
    source: 'region-estimate',
  });
});

// Demo checkout order registration (prepared for future Mercado Pago / payment gateway integration)
app.post('/api/orders', (req, res) => {
  const result = sanitizeServerOrderPayload(req.body as Record<string, unknown>);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  const record = result.order;
  sessionDemoOrders.unshift(record as unknown as Record<string, unknown>);
  if (sessionDemoOrders.length > 50) sessionDemoOrders.pop();

  return res.status(201).json(record);
});

// Multi-turn Style & Fit Assistant (server-side Gemini)
app.post('/api/ai/style-advisor', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'Consultoria inteligente indisponível no momento: configure GEMINI_API_KEY no ambiente do servidor.',
    });
  }

  try {
    const { messages, catalogSummary, deepMode } = req.body as {
      messages: { role: 'user' | 'model'; text: string }[];
      catalogSummary?: string;
      deepMode?: boolean;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Envie uma mensagem para iniciar a consulta.' });
    }

    const systemInstruction = `Você é o consultor de estilo, modelagem e caimento da marca independente COMPLEX (streetwear contemporâneo, paleta Bone #F1EEE8, Carbon #171717, Olive #6A705C, Taupe #B6A18C).
Responda sempre em português do Brasil, com tom discreto, direto, editorial e preciso — sem exageros comerciais, sem emojis e sem inventar certificações ou políticas que não existem.
Ajude o cliente a escolher tamanho (XS a XL ou numeração 38-46), entender proporções oversized/boxy e combinar peças do catálogo abaixo:
${catalogSummary || 'Moletom Essencial Estonado, Camiseta Boxy Pesada, Camiseta Oversized Diária, Calça Jeans Wide Arquitetônica, Moletom Canguru Areia 500g, Calça Cargo Utilitária Ripstop, Jaqueta Corta-Vento Cropped, Jaqueta Puffer Volume, Moletom Careca Boxy Tingido, Boné Sarja 6 Gomos & Ecobag Lona.'}`;

    const lastUserMessage = messages[messages.length - 1]?.text || '';
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const model = deepMode ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';
    const chat = ai.chats.create({
      model,
      history,
      config: {
        systemInstruction,
        ...(deepMode ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } } : {}),
      },
    });

    const response = await chat.sendMessage({ message: lastUserMessage });
    return res.json({ reply: response.text || '', model });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao consultar assistente.';
    console.error('Style advisor error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// Outfit / Garment Image Understanding (server-side Gemini multimodal)
app.post('/api/ai/analyze-garment', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'Análise visual indisponível: configure GEMINI_API_KEY no servidor.',
    });
  }

  try {
    const { imageBase64, mimeType, question, catalogSummary } = req.body as {
      imageBase64: string;
      mimeType: string;
      question?: string;
      catalogSummary?: string;
    };

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Imagem obrigatória para análise.' });
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          },
          {
            text: `${
              question ||
              'Analise as proporções, paleta de cores e estilo desta peça ou look e sugira até 3 peças do catálogo COMPLEX que criam uma composição coerente.'
            }\n\nCatálogo COMPLEX disponível:\n${catalogSummary || ''}`,
          },
        ],
      },
      config: {
        systemInstruction:
          'Você é o diretor criativo e estilista da COMPLEX. Responda em português do Brasil de forma concisa, técnica e editorial, sem emojis.',
      },
    });

    return res.json({ analysis: response.text || '' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro na análise da imagem.';
    console.error('Analyze garment error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// Admin copy assistant (server-side Gemini)
app.post('/api/ai/catalog-copy', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'Assistente editorial indisponível: configure GEMINI_API_KEY no servidor.',
    });
  }

  try {
    const { productName, category, fitNotes } = req.body as {
      productName?: string;
      category?: string;
      fitNotes?: string;
    };

    if (!productName?.trim() || !category?.trim()) {
      return res.status(400).json({ error: 'Nome e categoria do produto são obrigatórios.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Escreva uma descrição de produto sóbria, técnica e editorial (máximo 2 frases) em português do Brasil para a peça "${productName.trim().slice(0, 140)}" da categoria "${category.trim().slice(0, 60)}". Notas de modelagem: ${(fitNotes || 'oversized contemporâneo').slice(0, 300)}. Não invente certificações ou dados falsos.`,
    });

    return res.json({ description: (response.text || '').trim() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao gerar descrição.';
    return res.status(500).json({ error: msg });
  }
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const enableHmr = process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';
    if (!enableHmr) {
      process.env.DISABLE_HMR = 'true';
      // When HMR is disabled, serve a lightweight /@vite/client shim that handles
      // CSS style injection and HMR hooks without opening a WebSocket to port 24678.
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(`const sheetsMap = new Map();
let lastInsertedStyle;
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement('afterend', style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const data = {};
  return {
    data,
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: enableHmr ? { server: httpServer } : false,
        ws: enableHmr ? undefined : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          const normalized = filePath.replace(/\\/g, '/');
          if (normalized.endsWith('/sw.js') || normalized.endsWith('/index.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          } else if (
            normalized.includes('/assets/') ||
            normalized.includes('/src/assets/images/optimized/')
          ) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`COMPLEX storefront server listening on http://localhost:${port}`);
  });
}

startServer();
