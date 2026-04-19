export const USER_APPROVAL_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type UserApprovalStatusValue =
  (typeof USER_APPROVAL_STATUS)[keyof typeof USER_APPROVAL_STATUS];

export function resolveUserApprovalStatus(value: string): UserApprovalStatusValue {
  return Object.values(USER_APPROVAL_STATUS).includes(value as UserApprovalStatusValue)
    ? (value as UserApprovalStatusValue)
    : USER_APPROVAL_STATUS.PENDING;
}
