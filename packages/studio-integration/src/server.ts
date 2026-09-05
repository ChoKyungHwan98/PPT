import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InformationPlanSchema, RenderTreeSchema, SlideIRSchema, StudioDesignOutputSchema } from '@game-presentation/contracts';
import { OpenAICompatibleVisualCriticProvider, OpenRouterAIProvider, runVisualCritic } from '@game-presentation/renderer/studio';
import { runStudioDesignJob } from './design-job.js';

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
      const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Record<string, unknown>;
      const requestBody = await body(request) as { provider?: 'local' | 'openrouter' };
      const output = StudioDesignOutputSchema.parse(metadata.output);
      if (!output.validation.hardGatePassed) throw new Error('Hard Gate FAIL 결과는 AI 검토로 보낼 수 없습니다.');
      const slide = SlideIRSchema.parse(metadata.slide);
      const informationPlan = InformationPlanSchema.parse(metadata.informationPlan);
      const tree = RenderTreeSchema.parse(metadata.tree);
      const provider = requestBody.provider === 'openrouter'
        ? new OpenRouterAIProvider({ apiKey: process.env.OPENROUTER_API_KEY ?? '', model: process.env.CRITIC_MODEL_ID ?? '', reasoningEffort: 'medium' })
        : new OpenAICompatibleVisualCriticProvider({ endpoint: process.env.LOCAL_CRITIC_ENDPOINT ?? 'http://127.0.0.1:8000/v1/chat/completions', model: process.env.LOCAL_CRITIC_MODEL ?? 'afx-team/UI-UX', localExecution: true });
      const run = await runVisualCritic({ provider, pngBytes: new Uint8Array(await readFile(resolve(directory, `${artifactId}.png`))), artifactId, goal: informationPlan.message.text, slide, informationPlan, hardGate: metadata.hardGate as never });
      if (run.guardrailIssues.length > 0) throw new Error(`AI 검토 안전 규칙 실패: ${run.guardrailIssues.join(', ')}`);
      const updated = StudioDesignOutputSchema.parse({ ...output, critic: run.report, readiness: run.report.submissionReadiness });
      await writeFile(metadataPath, JSON.stringify({ ...metadata, output: updated, criticRun: run.run, criticInputTrace: run.inputTrace }, null, 2) + '\n');
      json(response, 200, { output: updated, run: run.run }); return;
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) { json(response, 400, { error: error instanceof Error ? error.message : String(error) }); }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`Game PPT Designer service: ${origin}\n`));
