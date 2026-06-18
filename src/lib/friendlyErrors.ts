export function describeFriendlyDataError(error: unknown, target = 'dữ liệu') {
  const err = error as { code?: string; message?: string } | undefined;
  const code = err?.code || '';
  const message = err?.message || String(error || '');

  if (code === 'permission-denied' || /missing or insufficient permissions/i.test(message)) {
    return `Tài khoản hiện tại chưa có quyền đọc ${target}. Vui lòng đăng xuất rồi đăng nhập lại, hoặc kiểm tra phân quyền tài khoản.`;
  }

  if (code === 'unauthenticated' || /unauthenticated|auth/i.test(message)) {
    return `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tải ${target}.`;
  }

  if (code === 'unavailable' || /offline|network|fetch/i.test(message)) {
    return 'Chưa kết nối được hệ thống dữ liệu. Vui lòng kiểm tra mạng và thử tải lại trang.';
  }

  return `Chưa tải được ${target}. Vui lòng thử lại sau ít phút.`;
}
