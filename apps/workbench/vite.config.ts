import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(appDirectory, '../..');
const jobsRoot = path.join(repositoryRoot, 'output', 'authoring-jobs');
const runFile = promisify(execFile);

function safeFilename(value: string): string {
  const decoded = decodeURIComponent(value || 'source.docx');
  const base = path.basename(decoded).replaceAll(/[<>:"/\\|?*]+/g, '_');
  return base.toLowerCase().endsWith('.docx') ? base : `${base}.docx`;
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function authoringApi(): Plugin {
  return {
    name: 'local-authoring-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (request.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
          const relative = url.pathname.slice('/api/jobs/'.length).split('/').map(decodeURIComponent);
          if (relative.length !== 2) return next();
          const [jobId, filename] = relative;
          if (jobId === undefined || filename === undefined || path.basename(filename) !== filename) return next();
          const jobDirectory = path.resolve(jobsRoot, jobId);
          const filePath = path.resolve(jobDirectory, filename);
          if (!filePath.startsWith(`${jobDirectory}${path.sep}`)) return next();
          try {
            const bytes = await fs.readFile(filePath);
            response.statusCode = 200;
            response.setHeader('Content-Type', contentType(filePath));
            response.setHeader('Content-Length', String(bytes.byteLength));
            response.end(bytes);
          } catch {
            response.statusCode = 404;
            response.end('Not found');
          }
          return;
        }
        const rebuildMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/rebuild$/);
        if (request.method === 'POST' && rebuildMatch !== null) {
          try {
            const jobId = decodeURIComponent(rebuildMatch[1] ?? '');
            if (!/^[0-9]+-[a-z0-9]+$/i.test(jobId)) throw new Error('잘못된 작업 번호입니다.');
            const jobDirectory = path.resolve(jobsRoot, jobId);
            if (!jobDirectory.startsWith(`${path.resolve(jobsRoot)}${path.sep}`)) throw new Error('잘못된 작업 경로입니다.');
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of request) {
              const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              size += buffer.byteLength;
              if (size > 2 * 1024 * 1024) throw new Error('페이지 구성 데이터가 너무 큽니다.');
              chunks.push(buffer);
            }
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { plan?: unknown };
            if (payload.plan === undefined) throw new Error('수정할 페이지 구성을 찾지 못했습니다.');
            const sourceFiles = await fs.readdir(jobDirectory);
            const sourceName = sourceFiles.find((name) => name.toLowerCase().endsWith('.docx'));
            if (sourceName === undefined) throw new Error('연결된 원본 문서를 찾지 못했습니다.');
            const basename = path.basename(sourceName, path.extname(sourceName));
            const planPath = path.join(jobDirectory, `${basename}.presentation-plan.json`);
            await fs.writeFile(planPath, `${JSON.stringify(payload.plan, null, 2)}\n`, 'utf8');
            const tsxCli = path.join(repositoryRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
            const rebuildCli = path.join(repositoryRoot, 'packages', 'authoring-cli', 'src', 'rebuild.ts');
            const execution = await runFile(process.execPath, [tsxCli, rebuildCli, '--plan', planPath, '--output-dir', jobDirectory, '--basename', basename], { cwd: repositoryRoot, maxBuffer: 10 * 1024 * 1024 });
            const rebuilt = JSON.parse(execution.stdout) as { plan: unknown; validation: unknown; files: { pptx: string; html: string; pdf: string; pngs: string[] } };
            const toUrl = (filePath: string) => `/api/jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(path.basename(filePath))}`;
            const version = Date.now();
            response.statusCode = 200;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({
              plan: rebuilt.plan,
              validation: rebuilt.validation,
              previews: rebuilt.files.pngs.map((filePath: string) => `${toUrl(filePath)}?v=${version}`),
              downloads: {
                pdf: `${toUrl(rebuilt.files.pdf)}?v=${version}`,
                html: `${toUrl(rebuilt.files.html)}?v=${version}`,
                pptx: `${toUrl(rebuilt.files.pptx)}?v=${version}`,
              },
            }));
          } catch (error) {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
          return;
        }
        if (request.method !== 'POST' || url.pathname !== '/api/author') return next();
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of request) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.byteLength;
            if (size > 50 * 1024 * 1024) throw new Error('DOCX 파일은 50MB 이하만 사용할 수 있습니다.');
            chunks.push(buffer);
          }
          if (size === 0) throw new Error('선택한 DOCX 파일이 비어 있습니다.');
          const jobId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
          const jobDirectory = path.join(jobsRoot, jobId);
          await fs.mkdir(jobDirectory, { recursive: true });
          const filename = safeFilename(String(request.headers['x-file-name'] ?? 'source.docx'));
          const inputPath = path.join(jobDirectory, filename);
          await fs.writeFile(inputPath, Buffer.concat(chunks));
          const tsxCli = path.join(repositoryRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
          const authoringCli = path.join(repositoryRoot, 'packages', 'authoring-cli', 'src', 'main.ts');
          const execution = await runFile(process.execPath, [tsxCli, authoringCli, '--input', inputPath, '--output-dir', jobDirectory], {
            cwd: repositoryRoot,
            maxBuffer: 10 * 1024 * 1024,
          });
          const summary = JSON.parse(execution.stdout) as Record<string, unknown>;
          const files = summary.files as Record<string, string | string[]>;
          const planPath = files.presentationPlan;
          if (typeof planPath !== 'string') throw new Error('생성된 슬라이드 계획을 찾지 못했습니다.');
          const plan = JSON.parse(await fs.readFile(planPath, 'utf8')) as unknown;
          const toUrl = (filePath: string) => `/api/jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(path.basename(filePath))}`;
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({
            jobId,
            filename,
            summary: {
              parsedBlocks: summary.parsedBlocks,
              parsedSections: summary.parsedSections,
              inventoryItems: summary.inventoryItems,
              plannedSlides: summary.plannedSlides,
            },
            plan,
            validation: summary.validation,
            previews: Array.isArray(files.pngs) ? files.pngs.map(toUrl) : [],
            downloads: {
              pdf: typeof files.pdf === 'string' ? toUrl(files.pdf) : undefined,
              html: typeof files.html === 'string' ? toUrl(files.html) : undefined,
              pptx: typeof files.editablePptx === 'string' ? toUrl(files.editablePptx) : undefined,
              inventory: typeof files.contentInventory === 'string' ? toUrl(files.contentInventory) : undefined,
            },
          }));
        } catch (error) {
          response.statusCode = 400;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), authoringApi()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
