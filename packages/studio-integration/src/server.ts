import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenAICompatibleVisualCriticProvider, OpenRouterAIProvider } from '@game-presentation/renderer/studio';
import { recordStudioUserDecision, runStudioDesignJob, runStudioVisualCritic } from './design-job.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const port = Number(process.env.PPT_DESIGNER_PORT ?? '8766');
const origin = `http://127.0.0.1:${port}`;

function json(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

function cors(response: ServerResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 2 * 1024 * 1024) throw new Error('요청이 너무 큽니다.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (request, response) => {
  cors(response);
  if (request.method === 'OPTIONS') { response.statusCode = 204; response.end(); return; }
  const url = new URL(request.url ?? '/', origin);
  try {
    if (request.method === 'GET' && url.pathname === '/api/designer/health') {
      json(response, 200, { ok: true, service: 'game-ppt-designer-v1', localCriticEndpoint: process.env.LOCAL_CRITIC_ENDPOINT ?? 'http://127.0.0.1:8000/v1/chat/completions', localCriticModel: process.env.LOCAL_CRITIC_MODEL ?? 'afx-team/UI-UX', openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY) });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/designer/jobs') {
      const job = await runStudioDesignJob(await body(request) as never, { repositoryRoot, publicBaseUrl: origin });
      json(response, 200, job.output);
      return;
    }
    const fileMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/([^/]+)$/u);
    if (request.method === 'GET' && fileMatch) {
      const artifactId = decodeURIComponent(fileMatch[1]!);
      const filename = decodeURIComponent(fileMatch[2]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId) || basename(filename) !== filename) throw new Error('잘못된 파일 경로입니다.');
      const path = resolve(repositoryRoot, 'output/studio-jobs', artifactId, filename);
      const bytes = await readFile(path);
      const extension = filename.split('.').at(-1)?.toLowerCase();
      const types: Record<string, string> = { png: 'image/png', html: 'text/html; charset=utf-8', pdf: 'application/pdf', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
      response.statusCode = 200; response.setHeader('Content-Type', types[extension ?? ''] ?? 'application/octet-stream'); response.end(bytes); return;
    }
    const criticMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/critic$/u);
    if (request.method === 'POST' && criticMatch) {
      const artifactId = decodeURIComponent(criticMatch[1]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId)) throw new Error('잘못된 작업 번호입니다.');
      const directory = resolve(repositoryRoot, 'output/studio-jobs', artifactId);
      const metadataPath = resolve(directory, 'job.json');
      const requestBody = await body(request) as { provider?: 'local' | 'openrouter' };
      const provider = requestBody.provider === 'openrouter'
        ? new OpenRouterAIProvider({ apiKey: process.env.OPENROUTER_API_KEY ?? '', model: process.env.CRITIC_MODEL_ID ?? '', reasoningEffort: 'medium' })
        : new OpenAICompatibleVisualCriticProvider({ endpoint: process.env.LOCAL_CRITIC_ENDPOINT ?? 'http://127.0.0.1:8000/v1/chat/completions', model: process.env.LOCAL_CRITIC_MODEL ?? 'afx-team/UI-UX', localExecution: true });
      const result = await runStudioVisualCritic({ metadataPath, provider });
      json(response, 200, { output: result.output, run: result.run }); return;
    }
    const decisionMatch = url.pathname.match(/^\/api\/designer\/jobs\/([^/]+)\/decision$/u);
    if (request.method === 'POST' && decisionMatch) {
      const artifactId = decodeURIComponent(decisionMatch[1]!);
      if (!/^slide-[0-9]+-[a-z0-9]+$/iu.test(artifactId)) throw new Error('잘못된 작업 번호입니다.');
      const metadataPath = resolve(repositoryRoot, 'output/studio-jobs', artifactId, 'job.json');
      const result = await recordStudioUserDecision({ metadataPath, event: await body(request) as never });
      json(response, 200, { output: result.output, eventId: result.event.eventId }); return;
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) { json(response, 400, { error: error instanceof Error ? error.message : String(error) }); }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`Game PPT Designer service: ${origin}\n`));
