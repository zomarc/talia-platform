export const isEditableTarget = (event) => {
  const target = event?.target;
  if (!target || typeof target !== 'object') return false;
  const tagName = String(target.tagName || '').toUpperCase();
  if (target.isContentEditable) return true;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  if (typeof target.closest === 'function' && target.closest('[contenteditable="true"]')) return true;
  return false;
};
