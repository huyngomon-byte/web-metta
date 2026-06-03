export interface SalesAssignmentRule {
  salesId: string;
  salesName: string;
  percent: number;
  active: boolean;
  updatedAt?: string;
}

export interface SalesAssignmentPick {
  salesId: string;
  salesName: string;
  targetPercent: number;
}
