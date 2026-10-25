/**
 * Delete cloud-confirmation helper (25 Oct 2026 follow-up).
 *
 * Problem: deleteTeacher used to return success unconditionally while the
 * actual cloud write lived in the debounced auto-sync effect, which fails
 * silently (unauthenticated session, offline — only a console.warn). The
 * UI therefore showed "successfully deleted" for a delete that never
 * reached the cloud, and the record came back on the next hydration.
 *
 * confirmDeleteCloudSync runs a caller-supplied write (the targeted
 * main_store teachers/users update) and maps its outcome to the exact
 * return shape deleteTeacher promises: success on write, failure with a
 * plain-language message on any throw. It never touches local state,
 * guards, or any other collection — the caller owns all of that.
 */
export const DELETE_CLOUD_FAILURE_MESSAGE =
  'স্থানীয়ভাবে মুছে ফেলা হয়েছে, কিন্তু cloud sync হয়নি — ইন্টারনেট/লগইন যাচাই করে আবার চেষ্টা করুন।';

export async function confirmDeleteCloudSync(
  write: () => Promise<void>
): Promise<{ success: boolean; message?: string }> {
  try {
    await write();
    return { success: true };
  } catch (err: any) {
    console.warn('Delete cloud sync failed:', err?.message || err);
    return { success: false, message: DELETE_CLOUD_FAILURE_MESSAGE };
  }
}
