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
