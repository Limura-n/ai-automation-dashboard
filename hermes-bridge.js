#!/usr/bin/env node
/**
 * Hermes Chat Bridge — HTTP API on port 8000 that bridges to Hermes CLI.
 * Uses a file-based request/response pattern since Hermes doesn't have a REST API.
 * 
 * Request flow: HTTP POST -> chat-request.json -> Hermes reads -> chat-response.json -> HTTP response
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { createServer } from 'http';

const PORT = 8000;
const REQUEST_FILE = '/home/nazmul/Documents/AI_Tasks/chat-request.json';
const RESPONSE_FILE = '/home/nazmul/Documents/AI_Tasks/chat-response.json';
const REQUEST_DIR = '/home/nazmul/Documents/AI_Tasks';

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function doneSSE(res) {
  res.write(`data: [DONE]\n\n`);
  res.end();
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const url = req.url;

  // Health check
  if (url === '/' && req.method === 'GET') {
    return json(res, 200, { status: 'ok', service: 'hermes-bridge', version: '1.0' });
  }

  // OpenAI-compatible models
  if (url === '/v1/models' && req.method === 'GET') {
    return json(res, 200, {
      object: 'list',
      data: [{ id: 'hermes-agent', object: 'model', created: 1700000000, owned_by: 'hermes', permission: [], root: 'hermes-agent' }]
    });
  }

  // OpenAI-compatible chat completions (streaming)
  if (url === '/v1/chat/completions' && req.method === 'POST') {
    let body;
    try {
      body = await parseBody(req);
    } catch {
      return json(res, 400, { error: { message: 'Invalid JSON body' } });
    }

    const messages = body.messages || [];
    const isStreaming = body.stream !== false;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const userMessage = lastUserMsg?.content || 'Hello';
    const requestId = `chatcmpl-${Date.now()}`;

    // Write request to file
    const request = {
      id: requestId,
      prompt: userMessage,
      messages: messages,
      timestamp: new Date().toISOString(),
    };

    try {
      writeFileSync(REQUEST_FILE, JSON.stringify(request, null, 2));
    } catch (e) {
      console.error('Failed to write request file:', e.message);
      return json(res, 503, { error: { message: 'Failed to queue message' } });
    }

    if (!isStreaming) {
      // Non-streaming: wait for response file
      const maxWait = 45000; // 45s timeout
      const pollInterval = 200;
      let waited = 0;

      const waitForResponse = () => {
        return new Promise((resolve) => {
          const check = () => {
            waited += pollInterval;
            if (existsSync(RESPONSE_FILE)) {
              try {
                const response = JSON.parse(readFileSync(RESPONSE_FILE, 'utf-8'));
                unlinkSync(RESPONSE_FILE);
                resolve(response.content || response.text || '');
              } catch (e) {
                resolve('');
              }
            } else if (waited >= maxWait) {
              resolve('[No response received]');
            } else {
              setTimeout(check, pollInterval);
            }
          };
          check();
        });
      };

      waitForResponse().then(text => {
        return json(res, 200, {
          id: requestId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'hermes-agent',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: 'stop',
          }],
        });
      });
      return;
    }

    // Streaming response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    // Start Hermes in background and poll for response
    const { spawn } = await import('child_process');
    const hermes = spawn('hermes', ['chat', '-e', userMessage], {
      cwd: '/home/nazmul',
      env: { ...process.env, HOME: '/home/nazmul' },
      shell: true,
    });

    let output = '';
    hermes.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    hermes.stderr.on('data', (chunk) => {
      // Ignore stderr
    });
    hermes.on('close', () => {
    // Stream the output word by word for a streaming feel
    const words = output.trim().split(/(\s+)/);
    let i = 0;
    let chunkIndex = 0;
    const streamWord = () => {
      if (i < words.length) {
        const chunk = {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'hermes-agent',
          choices: [{
            index: 0,
            delta: { content: words[i] },
            finish_reason: null,
          }],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        i++;
        chunkIndex++;
        setTimeout(streamWord, 20);
      } else {
        const finalChunk = {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'hermes-agent',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
          }],
        };
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    };
      if (words.length > 0) {
        streamWord();
      } else {
        doneSSE(res);
      }
    });
    hermes.on('error', () => {
      sendSSE(res, { type: 'error', error: 'Hermes CLI error' });
      doneSSE(res);
    });

    // Timeout
    setTimeout(() => {
      hermes.kill();
      if (!res.writableEnded) doneSSE(res);
    }, 55000);
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Hermes bridge running on http://127.0.0.1:${PORT}`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use.`);
    process.exit(1);
  }
  throw err;
});
