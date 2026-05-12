import { useContext } from 'react';
import { FocusManagementContext } from '../contexts/focusManagementContext';

export function useTaliaFocusManagement() {
  const ctx = useContext(FocusManagementContext);
  if (ctx == null) {
    throw new Error(
      'useTaliaFocusManagement must be used within FocusManagementProvider. Wrap the app shell in main.jsx.'
    );
  }
  return ctx;
}
