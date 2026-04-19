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

export function isMissingApprovalStatusSchema(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : String(error);

  return (
    code === "P2022" ||
    (message.includes("approvalStatus") &&
      (message.includes("does not exist") || message.includes("column"))) ||
    (message.includes("UserApprovalStatus") &&
      (message.includes("does not exist") || message.includes("type")))
  );
}
