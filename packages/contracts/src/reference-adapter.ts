import { ReferenceRecordSchema, type ReferenceRecord } from './reference.js';

export type ReferenceDiscoveryQuery = {
  cursor?: string;
  limit: number;
};

export type ReferenceDiscoveryPage = {
  records: ReferenceRecord[];
  nextCursor?: string;
};

export interface ReferenceAdapter {
  readonly adapterId: string;
  discover(query: ReferenceDiscoveryQuery): Promise<ReferenceDiscoveryPage>;
}

export class FakeReferenceAdapter implements ReferenceAdapter {
  readonly adapterId = 'fake-seed';

  constructor(private readonly records: ReferenceRecord[]) {}

  async discover(query: ReferenceDiscoveryQuery): Promise<ReferenceDiscoveryPage> {
    const start = query.cursor === undefined ? 0 : Number.parseInt(query.cursor, 10);
    const records = this.records
      .slice(start, start + query.limit)
      .map((record) => ReferenceRecordSchema.parse(record));
    const next = start + records.length;
    return {
      records,
      ...(next < this.records.length ? { nextCursor: String(next) } : {}),
    };
  }
}
