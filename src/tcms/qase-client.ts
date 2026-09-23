import type { RemoteCase, TcmsSeam, TcmsCase } from './types';
import type { QaseConfig } from './qase-env';

interface Entity {
  id: number;
  title: string;
  parent_id?: number | null;
  suite_id?: number | null;
}

// Qase caps a listing at 100 per request.
const PAGE = 100;
interface ListResp {
  result: { entities: Entity[] };
}
interface IdResp {
  result: { id: number };
}

// The seam: the ONLY module that knows Qase's REST API. A future Xray/Zephyr/Kiwi
// client implements the same TcmsSeam interface. Auth is the `Token:` header.
//
// Qase allows 200 requests per minute and answers 429 with a `Retry-After` in seconds.
// Waiting the header out is the documented remedy, so this retries rather than failing the
// sync.
// Carries the status so a caller can tell a vanished case (404) from a real failure,
// instead of matching on the text of an error message.
export class QaseHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'QaseHttpError';
  }
}

const RATE_LIMITED = 429;
const MAX_RETRIES = 3;

export class QaseClient implements TcmsSeam {
  // Suite ids are resolved by title+parent, and the same twenty paths repeat across eighty
  // cases. Without this the sync spent 240 GETs re-answering 20 questions, which is most of
  // a 200/minute budget spent on nothing.
  private readonly suiteIds = new Map<string, number>();

  constructor(
    private readonly cfg: QaseConfig,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  private async rpc<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${this.cfg.apiHost}${path}`, {
        method,
        headers: { Token: this.cfg.apiToken, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.ok) return (await res.json()) as T;

      // Only 429 is worth repeating. A 401 or a 422 returns the same answer however long you
      // wait, and retrying them turns a clear error into a slow one.
      if (res.status !== RATE_LIMITED || attempt >= MAX_RETRIES) {
        throw new QaseHttpError(
          res.status,
          `Qase ${method} ${path} → ${res.status} ${await res.text()}`,
        );
      }
      // Trust the server's own number when it gives one; its default is 60 seconds.
      const after = Number(res.headers?.get?.('Retry-After')) || 60;
      console.log(`Qase rate-limited — waiting ${after}s, then retrying ${method} ${path}`);
      await this.sleep(after * 1000);
    }
  }

  async ensureSuitePath(path: string[]): Promise<number> {
    if (path.length === 0) throw new Error('ensureSuitePath: path must not be empty');
    let parentId: number | undefined;
    let suiteId = 0;
    for (const title of path) {
      suiteId = await this.ensureSuite(title, parentId);
      parentId = suiteId;
    }
    return suiteId;
  }

  private async ensureSuite(title: string, parentId?: number): Promise<number> {
    const key = `${parentId ?? 'root'}/${title}`;
    const cached = this.suiteIds.get(key);
    if (cached !== undefined) return cached;

    const id = await this.lookUpOrCreateSuite(title, parentId);
    this.suiteIds.set(key, id);
    return id;
  }

  private async lookUpOrCreateSuite(title: string, parentId?: number): Promise<number> {
    const code = this.cfg.projectCode;
    // Title search is narrow at project scale; 100 is ample, so no pagination.
    const q = new URLSearchParams({ 'filters[search]': title, limit: '100' });
    const found = await this.rpc<ListResp>('GET', `/suite/${code}?${q}`);
    const match = found.result.entities.find(
      (s) => s.title === title && (s.parent_id ?? undefined) === parentId,
    );
    if (match) return match.id;
    const created = await this.rpc<IdResp>('POST', `/suite/${code}`, {
      title,
      parent_id: parentId,
    });
    return created.result.id;
  }

  async listCases(suiteId: number): Promise<RemoteCase[]> {
    const code = this.cfg.projectCode;
    const found: RemoteCase[] = [];
    // Paginated rather than filtered server-side: the suite_id filter's spelling is
    // not something to guess at, and every entity carries its own suite_id.
    for (let offset = 0; ; offset += PAGE) {
      const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      const page = await this.rpc<ListResp>('GET', `/case/${code}?${q}`);
      const entities = page.result.entities;
      for (const e of entities) {
        if (e.suite_id === suiteId) found.push({ id: e.id, title: e.title });
      }
      if (entities.length < PAGE) return found;
    }
  }

  async upsertCase(suiteId: number, c: TcmsCase): Promise<number> {
    return this.findOrCreateCase(suiteId, c, this.caseBody(suiteId, c));
  }

  private async findOrCreateCase(
    suiteId: number,
    c: TcmsCase,
    body: Record<string, unknown>,
  ): Promise<number> {
    const code = this.cfg.projectCode;
    // Title search is narrow at project scale; 100 is ample, so no pagination.
    const q = new URLSearchParams({ 'filters[search]': c.title, limit: '100' });
    const found = await this.rpc<ListResp>('GET', `/case/${code}?${q}`);
    // suiteId always comes from ensureSuitePath (> 0), so a raw === on suite_id is safe here.
    const match = found.result.entities.find((x) => x.title === c.title && x.suite_id === suiteId);
    if (match) {
      await this.rpc('PATCH', `/case/${code}/${match.id}`, body);
      return match.id;
    }
    const created = await this.rpc<IdResp>('POST', `/case/${code}`, body);
    return created.result.id;
  }

  private caseBody(suiteId: number, c: TcmsCase): Record<string, unknown> {
    return {
      title: c.title,
      suite_id: suiteId,
      description: c.description,
      preconditions: c.preconditions,
      automation: 2, // 2 = "automated" (Qase integer enum: 0=not automated, 1=to be automated, 2=automated)
      steps_type: 'classic',
      tags: c.tags,
      steps: c.steps.map((s, i) => ({
        position: i + 1,
        action: s.action,
        expected_result: s.expected,
      })),
    };
  }

  async archiveCase(caseId: number): Promise<void> {
    const code = this.cfg.projectCode;
    // Archive mechanism per the live probe. DELETE is the least-destructive option
    // Qase exposes if no deprecate/status flag exists on a case.
    await this.rpc('DELETE', `/case/${code}/${caseId}`);
  }
}
