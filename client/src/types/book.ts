export interface BookAllocation {
  id: string;
  bookNumber: string;
  sevakId: string;
  status: 'ASSIGNED' | 'SUBMITTED' | 'PARTIALLY_SUBMITTED';
  assignedAt: string;
}
