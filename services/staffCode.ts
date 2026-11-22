/**
 * Next staff code (MDR-Tnnn) for the add-teacher form.
 *
 * Moved here from StaffManager so the rule is testable in one place
 * (scripts/verify-staff-code-trash.ts). Behaviour kept from the
 * original inline version: max existing numeric suffix + 1 — the old
 * length+1 reused a deleted code whenever the list shrank.
 *
 * Fix #15: the max also covers trashed records. A trashed teacher
 * restores with its original code (restoreFromTrash puts item.data
 * back verbatim), so a code held in the bin is still taken —
 * suggesting it would collide on restore. Only a permanent delete
 * frees the code, because then nothing can come back with it.
 */
export function nextEmployeeCode(
  staff: { employeeCode?: string }[],
  trashBin: { data?: { employeeCode?: string } }[] = []
): string {
  let max = 0;
  const scan = (code?: string) => {
    const m = (code || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  };
  staff.forEach(s => scan(s.employeeCode));
  trashBin.forEach(t => scan(t.data?.employeeCode));
  return `MDR-T${String(max + 1).padStart(3, '0')}`;
}

export interface StaffLink {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * The staff code (employeeCode, e.g. MDR-T001) of the teacher record
 * describing one person — for the topbar profile menu (22 Nov 2026).
 * Same linkage AppContext uses for linkedStaffRecord: login-account id
 * (or Auth uid) first, then email, then phone. A match without a code
 * falls through to the next criterion; no match returns undefined
 * (the owner holds no staff record, so no code is shown).
 */
export function findLinkedEmployeeCode(
  staff: { id?: string; userId?: string; email?: string; phone?: string; employeeCode?: string }[],
  link: StaffLink
): string | undefined {
  const email = (link.email || '').trim().toLowerCase();
  const withCode = (t?: { employeeCode?: string }) => t?.employeeCode || undefined;
  if (link.id) {
    const byId = staff.find(t => t.id === link.id || t.userId === link.id);
    if (withCode(byId)) return byId!.employeeCode;
  }
  if (email) {
    const byEmail = staff.find(t => t.email && t.email.toLowerCase() === email);
    if (withCode(byEmail)) return byEmail!.employeeCode;
  }
  if (link.phone) {
    const byPhone = staff.find(t => t.phone && t.phone === link.phone);
    if (withCode(byPhone)) return byPhone!.employeeCode;
  }
  return undefined;
}
