import { GraphQLUtils } from './apolloClient.js';

/** Same Talia user scope as ThemeContext / sidebar appearance persistence. */
export function resolveTaliaAppearanceUserId(user) {
  const fromUser = user?.taliaUserId ?? user?.talia_user_id ?? user?.taliaUser?.talia_user_id;
  const fromStorage = GraphQLUtils.getTaliaUserId();
  const rawTaliaId =
    fromUser != null && fromUser !== ''
      ? fromUser
      : fromStorage != null && fromStorage !== ''
        ? fromStorage
        : null;
  return rawTaliaId != null && String(rawTaliaId).trim() !== '' ? String(rawTaliaId).trim() : null;
}
