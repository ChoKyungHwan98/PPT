import {
  ReferenceRecordSchema,
  type ReferenceAdapter,
  type ReferenceDiscoveryPage,
  type ReferenceDiscoveryQuery,
  type ReferenceRecord,
} from '@game-presentation/contracts';
import { assertAssetUrlAllowed, type SourcePolicy } from './policy.js';

export class CuratedManifestAdapter implements ReferenceAdapter {
  constructor(
    readonly adapterId: string,
    private readonly records: ReferenceRecord[],
    private readonly policy: SourcePolicy,
  ) {
    if (adapterId !== policy.adapterId) {
      throw new Error('adapter와 source policy id가 일치하지 않습니다.');
    }
  }

  async discover(query: ReferenceDiscoveryQuery): Promise<ReferenceDiscoveryPage> {
    const start = query.cursor === undefined ? 0 : Number.parseInt(query.cursor, 10);
    const validated = this.records.map((record) => {
      const parsed = ReferenceRecordSchema.parse(record);
      if (parsed.source.assetUrl !== undefined) {
        assertAssetUrlAllowed(parsed.source.assetUrl, this.policy);
      }
      return parsed;
    });
    const records = validated.slice(start, start + query.limit);
    const next = start + records.length;
    return {
      records,
      ...(next < validated.length ? { nextCursor: String(next) } : {}),
    };
  }
}
