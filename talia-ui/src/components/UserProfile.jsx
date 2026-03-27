import React, { useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { loadGameScore, loadGameScoreBoard } from '../services/data/gameScores';
import {
  isAdmin,
  canAccessPrivilegedPanels,
  canEditTaliaIntel,
  canUseAdvancedHeader,
  normalizeRole,
} from '../utils/roleUtils';

const UserProfile = ({ isCollapsed }) => {
  const { user, signOut, devUsers = [] } = useSupabaseAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [focuses, setFocuses] = useState(() => {
    const initial = window.__taliaFocusState?.focuses;
    return Array.isArray(initial) ? initial.filter((entry) => entry?.id) : [];
  });
  const [adminTopScores, setAdminTopScores] = useState([]);
  const [adminUserScores, setAdminUserScores] = useState([]);
  const [adminScoresLoading, setAdminScoresLoading] = useState(false);

  if (!user) return null;

  const normalizedRole = normalizeRole(user.role || 'USER');
  const roleDisplay = normalizedRole === 'SUPER_USER' ? 'Super User' : (
    normalizedRole.charAt(0) + normalizedRole.slice(1).toLowerCase()
  );
  const roleClass = `dashboard-user-profile__role dashboard-user-profile__role--${normalizedRole.toLowerCase()}`;

  useEffect(() => {
    const handleFocusState = (event) => {
      const next = event?.detail?.focuses;
      if (!Array.isArray(next)) return;
      setFocuses(next.filter((entry) => entry?.id));
    };
    window.addEventListener('talia:dashboard.focusState', handleFocusState);
    return () => {
      window.removeEventListener('talia:dashboard.focusState', handleFocusState);
    };
  }, []);

  const capabilityRows = useMemo(() => ([
    {
      label: 'Advanced Header',
      enabled: canUseAdvancedHeader(normalizedRole),
    },
    {
      label: 'Privileged Panels',
      enabled: canAccessPrivilegedPanels(normalizedRole),
    },
    {
      label: 'Edit MODEL Curves',
      enabled: canEditTaliaIntel(normalizedRole),
    },
  ]), [normalizedRole]);

  const scoreLabelByGame = useMemo(() => ({
    breakout: 'Breakout',
    pong: 'Pong',
    'pac-man': 'Pac-Man',
    'space-invaders': 'Space Invaders',
    asteroids: 'Asteroids',
    'moon-lander': 'Moon Lander',
  }), []);

  const trackedGameIds = useMemo(() => Object.keys(scoreLabelByGame), [scoreLabelByGame]);

  const activeUserId = useMemo(() => (
    String(
      user?.id
      || user?.userId
      || localStorage.getItem('userId')
      || localStorage.getItem('devUserId')
      || user?.email
      || 'anonymous'
    ).trim()
  ), [user]);

  const userLabelMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(devUsers) ? devUsers : []).forEach((entry) => {
      const name = entry?.name || entry?.email || entry?.id;
      if (!name) return;
      const emailKey = String(entry?.email || '').trim().toLowerCase();
      const idKey = String(entry?.id || '').trim().toLowerCase();
      if (emailKey) map.set(emailKey, String(name));
      if (idKey) map.set(idKey, String(name));
    });
    return map;
  }, [devUsers]);

  const resolveUserLabel = (value) => {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return 'Unknown user';
    return userLabelMap.get(key) || String(value);
  };

  useEffect(() => {
    if (!isAdmin(normalizedRole)) {
      setAdminTopScores([]);
      setAdminUserScores([]);
      setAdminScoresLoading(false);
      return undefined;
    }
    let cancelled = false;
    setAdminScoresLoading(true);
    loadGameScoreBoard({
      gameId: null,
      limitTop: 8,
      limitRecent: 0,
      component: 'UserProfile',
    })
      .then(async (board) => {
        const topRows = Array.isArray(board?.top) ? board.top : [];
        const ownRows = await Promise.all(
          trackedGameIds.map(async (gameId) => {
            try {
              return await loadGameScore({
                gameId,
                userId: activeUserId,
                component: 'UserProfile',
              });
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;
        setAdminTopScores(topRows);
        setAdminUserScores(
          ownRows
            .filter((row) => row && Number(row.highScore || 0) > 0)
            .sort((a, b) => Number(b?.highScore || 0) - Number(a?.highScore || 0))
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAdminTopScores([]);
        setAdminUserScores([]);
      })
      .finally(() => {
        if (!cancelled) setAdminScoresLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeUserId, normalizedRole, trackedGameIds]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="dashboard-user-profile">
      {/* User Info */}
      <div 
        className="dashboard-user-profile__info"
        onClick={() => setShowProfile(!showProfile)}
      >
        {/* Avatar */}
        <div className="dashboard-user-profile__avatar">
          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
        </div>
        
        {!isCollapsed && (
          <div className="dashboard-user-profile__details">
            <div className="dashboard-user-profile__name">
              {user.name || user.email}
            </div>
            <div className={roleClass}>
              {roleDisplay}
            </div>
          </div>
        )}
        
        {/* Dropdown Arrow */}
        {!isCollapsed && (
          <div className={`dashboard-user-profile__dropdown ${showProfile ? 'dashboard-user-profile__dropdown--open' : ''}`}>
            ▼
          </div>
        )}
      </div>

      {/* Profile Dropdown */}
      {showProfile && !isCollapsed && (
        <div className="dashboard-user-profile__dropdown-panel">
          {/* User Details */}
          <div className="dashboard-user-profile__detail-group">
            <div className="dashboard-user-profile__detail-label">Email</div>
            <div className="dashboard-user-profile__detail-value">
              {user.email}
            </div>
          </div>

          {/* Role */}
          <div className="dashboard-user-profile__detail-group">
            <div className="dashboard-user-profile__detail-label">Role</div>
            <div className={roleClass}>
              {roleDisplay}
            </div>
          </div>

          <div className="dashboard-user-profile__detail-group">
            <div className="dashboard-user-profile__detail-label">Capabilities</div>
            <div className="dashboard-user-profile__capabilities">
              {capabilityRows.map((item) => (
                <div key={item.label} className="dashboard-user-profile__capability-row">
                  <span>{item.label}</span>
                  <span className={`dashboard-user-profile__capability-state ${item.enabled ? 'dashboard-user-profile__capability-state--on' : ''}`}>
                    {item.enabled ? 'Available' : 'Not enabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-user-profile__detail-group">
            <div className="dashboard-user-profile__detail-label">Available Focuses ({focuses.length})</div>
            {focuses.length === 0 ? (
              <div className="dashboard-user-profile__hint">No focuses are currently available.</div>
            ) : (
              <div className="dashboard-user-profile__focus-list">
                {focuses.map((focus) => (
                  <div key={focus.id} className="dashboard-user-profile__focus-item">
                    {focus.name || focus.id}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isAdmin(normalizedRole) && (
            <div className="dashboard-user-profile__detail-group">
              <div className="dashboard-user-profile__detail-label">High Scores</div>
              {adminScoresLoading ? (
                <div className="dashboard-user-profile__hint">Loading high scores...</div>
              ) : adminTopScores.length === 0 ? (
                <div className="dashboard-user-profile__hint">No high scores yet.</div>
              ) : (
                <div className="dashboard-user-profile__focus-list">
                  {adminTopScores.map((row, index) => (
                    <div
                      key={`admin-high-${row?.gameId || 'game'}-${row?.userId || 'user'}-${index}`}
                      className="dashboard-user-profile__focus-item dashboard-user-profile__score-item"
                    >
                      <span className="dashboard-user-profile__score-rank">#{index + 1}</span>
                      <span className="dashboard-user-profile__score-game">{scoreLabelByGame[row?.gameId] || row?.gameId || 'Game'}</span>
                      <span className="dashboard-user-profile__score-user">{resolveUserLabel(row?.userId)}</span>
                      <span className="dashboard-user-profile__score-value">{row?.highScore ?? 0}</span>
                    </div>
                  ))}
                </div>
              )}
              {!adminScoresLoading && (
                <>
                  <div className="dashboard-user-profile__detail-label">Your Best Scores</div>
                  {adminUserScores.length === 0 ? (
                    <div className="dashboard-user-profile__hint">No personal scores recorded yet.</div>
                  ) : (
                    <div className="dashboard-user-profile__focus-list">
                      {adminUserScores.map((row, index) => (
                        <div
                          key={`admin-user-score-${row?.gameId || 'game'}-${index}`}
                          className="dashboard-user-profile__focus-item dashboard-user-profile__score-item dashboard-user-profile__score-item--self"
                        >
                          <span className="dashboard-user-profile__score-rank">#{index + 1}</span>
                          <span className="dashboard-user-profile__score-game">{scoreLabelByGame[row?.gameId] || row?.gameId || 'Game'}</span>
                          <span className="dashboard-user-profile__score-user">You</span>
                          <span className="dashboard-user-profile__score-value">{row?.highScore ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="dashboard-user-profile__action-btn dashboard-user-profile__action-btn--danger"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
