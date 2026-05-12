import { createContext } from 'react';

/** Raw focus API from {@link useTaliaFocusManagementImpl} — one Provider instance per app shell. */
export const FocusManagementContext = createContext(null);
