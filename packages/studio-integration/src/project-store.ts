import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

export const ProjectDocumentSchema = z.strictObject({ documentId: z.string().min(1), title: z.string().min(1), mode: z.enum(['document', 'presentation']), updatedAt: z.iso.datetime() });
export const ProjectHistorySchema = z.strictObject({ artifactId: z.string().min(1), documentId: z.string().min(1), title: z.string().min(1), previewPngUrl: z.string().min(1), updatedAt: z.iso.datetime() });
export const StudioProjectSchema = z.strictObject({ schemaVersion: z.literal('0.1'), projectId: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(80), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), documents: z.array(ProjectDocumentSchema), history: z.array(ProjectHistorySchema) });
export type StudioProject = z.infer<typeof StudioProjectSchema>;

export class LocalProjectStore {
  constructor(private readonly root: string) {}
  private indexPath() { return resolve(this.root, 'projects.json'); }
  private projectPath(projectId: string) { if (!/^[a-z0-9-]+$/u.test(projectId)) throw new Error('잘못된 projectId입니다.'); return resolve(this.root, projectId, 'project.json'); }

  async list(query = ''): Promise<StudioProject[]> {
    let ids: string[] = [];
    try { ids = (JSON.parse(await readFile(this.indexPath(), 'utf8')) as { projectIds: string[] }).projectIds; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const projects = await Promise.all(ids.map((id) => this.get(id)));
    const needle = query.trim().toLocaleLowerCase('ko-KR');
    return projects.filter((project) => needle === '' || project.name.toLocaleLowerCase('ko-KR').includes(needle)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async create(name: string, now = new Date().toISOString()): Promise<StudioProject> {
    const clean = name.trim(); if (clean === '') throw new Error('프로젝트 이름이 필요합니다.');
    const project = StudioProjectSchema.parse({ schemaVersion: '0.1', projectId: `project-${randomUUID().slice(0, 8)}`, name: clean, createdAt: now, updatedAt: now, documents: [], history: [] });
    await this.save(project);
    const ids = (await this.list()).map((entry) => entry.projectId);
    await writeFile(this.indexPath(), `${JSON.stringify({ schemaVersion: '0.1', projectIds: [...new Set([...ids, project.projectId])] }, null, 2)}\n`, 'utf8');
    return project;
  }

  async get(projectId: string): Promise<StudioProject> { return StudioProjectSchema.parse(JSON.parse(await readFile(this.projectPath(projectId), 'utf8'))); }

  async save(project: StudioProject): Promise<void> {
    const value = StudioProjectSchema.parse(project); const path = this.projectPath(value.projectId);
    await mkdir(dirname(path), { recursive: true }); await mkdir(this.root, { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  async recordArtifact(input: { projectId: string; artifactId: string; documentId: string; mode: 'document' | 'presentation'; title: string; previewPngUrl: string; updatedAt?: string }): Promise<StudioProject> {
    const project = await this.get(input.projectId); const updatedAt = input.updatedAt ?? new Date().toISOString();
    const documents = [{ documentId: input.documentId, title: input.title, mode: input.mode, updatedAt }, ...project.documents.filter((document) => document.documentId !== input.documentId)];
    const history = [{ artifactId: input.artifactId, documentId: input.documentId, title: input.title, previewPngUrl: input.previewPngUrl, updatedAt }, ...project.history.filter((entry) => entry.artifactId !== input.artifactId)].slice(0, 50);
    const updated = StudioProjectSchema.parse({ ...project, updatedAt, documents, history }); await this.save(updated); return updated;
  }
}
