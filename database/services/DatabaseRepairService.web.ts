import {
  type ChildSpec,
  REPAIR_DESCRIPTORS,
  type TableGroupDescriptor,
} from '@/constants/database';

export type { ChildSpec, TableGroupDescriptor }; // TODO: is this necessary?
export { REPAIR_DESCRIPTORS }; // TODO: is this necessary?

type IntegrityIssue = {
  table: string;
  message: string;
  rowId?: number;
};

export interface DatabaseRepairResult {
  attempted: boolean;
  repaired: boolean;
  reindexed: boolean;
  deletedRootIds: string[];
  issues: IntegrityIssue[];
}

const NO_OP_RESULT: DatabaseRepairResult = {
  attempted: false,
  repaired: false,
  reindexed: false,
  deletedRootIds: [],
  issues: [],
};

export class DatabaseRepairService {
  static async repairIfNeeded(
    _error: unknown,
    _descriptor: TableGroupDescriptor
  ): Promise<DatabaseRepairResult> {
    return NO_OP_RESULT;
  }
}

export async function retryAfterRepair<T>(
  _error: unknown,
  _descriptor: TableGroupDescriptor,
  _retry: () => Promise<T>
): Promise<T | undefined> {
  return undefined;
}
