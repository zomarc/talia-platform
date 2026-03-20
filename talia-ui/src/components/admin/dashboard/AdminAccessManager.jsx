import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { useFocusManagement } from '../../../hooks/useFocusManagement';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import taliaUserService from '../../../services/TaliaUserService';

const ROLE_ORDER = ['GUEST', 'USER', 'MANAGER', 'ADMIN'];
const ROLE_LEVEL = { GUEST: 0, USER: 1, MANAGER: 2, ADMIN: 3 };
const FOCUS_TYPES = ['STANDARD', 'ROLE', 'USER', 'TEMPLATE', 'SHARED'];

const normalizeRole = (role) => String(role || 'USER').toUpperCase();
const normalizeType = (type) => String(type || 'STANDARD').toUpperCase();

const getAssignmentLabel = (focus) => {
  const type = normalizeType(focus.type);
  if (type === 'STANDARD' || type === 'TEMPLATE' || type === 'SHARED') return 'All roles';
  if (type === 'ROLE') return (focus.assignedRoles || []).join(', ') || 'All roles';
  if (type === 'USER') return focus.assignedUserId || 'Unassigned user';
  return 'All roles';
};

const getMinimumRoleFromFocus = (focus) => {
  const type = normalizeType(focus?.type);
  if (type === 'STANDARD' || type === 'TEMPLATE' || type === 'SHARED') return 'GUEST';
  if (type === 'ROLE') {
    const assigned = Array.isArray(focus?.assignedRoles) ? focus.assignedRoles : [];
    if (!assigned.length) return 'GUEST';
    return assigned
      .map(normalizeRole)
      .sort((a, b) => (ROLE_LEVEL[a] ?? 99) - (ROLE_LEVEL[b] ?? 99))[0] || 'GUEST';
  }
  // USER focus does not map to role-floor semantics.
  return 'USER';
};

const getComponentCount = (focus) => {
  const panelCount = focus?.layoutData?.dockviewLayout?.panels
    ? Object.keys(focus.layoutData.dockviewLayout.panels).length
    : 0;
  if (panelCount > 0) return panelCount;

  const sourceComponents = Array.isArray(focus?.layoutData?.components)
    ? focus.layoutData.components
    : Array.isArray(focus?.components)
      ? focus.components
      : [];

  const filtered = sourceComponents.filter((component) => {
    const settings = component?.settings || {};
    const keys = Object.keys(settings);
    // Ignore placeholder component used only to carry dockview layout
    if (keys.length === 1 && keys[0] === '_dockviewLayout') return false;
    return true;
  });

  return filtered.length;
};

const canRoleSeeFocus = (focus, role, userId = null) => {
  const type = normalizeType(focus.type);
  const normalizedRole = normalizeRole(role);

  if (type === 'STANDARD' || type === 'TEMPLATE' || type === 'SHARED') return true;

  if (type === 'ROLE') {
    const assigned = Array.isArray(focus.assignedRoles) ? focus.assignedRoles : [];
    if (!assigned.length) return true;
    const minLevel = Math.min(...assigned.map((r) => ROLE_LEVEL[normalizeRole(r)] ?? 1));
    return (ROLE_LEVEL[normalizedRole] ?? 1) >= minLevel;
  }

  if (type === 'USER') {
    if (normalizedRole === 'ADMIN') return true;
    if (!focus.assignedUserId) return true;
    return Boolean(userId) && focus.assignedUserId === userId;
  }

  return true;
};

const buildEditorFromFocus = (focus) => {
  const type = normalizeType(focus?.type);
  return {
    name: focus?.name || '',
    description: focus?.description || '',
    type,
    role: normalizeRole(focus?.role),
    assignedRoles:
      type === 'STANDARD'
        ? [...ROLE_ORDER]
        : Array.isArray(focus?.assignedRoles)
          ? focus.assignedRoles.map(normalizeRole)
          : [],
    assignedUserId: focus?.assignedUserId || ''
  };
};

const AdminAccessManager = () => {
  const {
    focuses,
    loading,
    error,
    createFocus,
    updateFocus
  } = useFocusManagement();
  const { devUsers = [] } = useSupabaseAuth();

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [selectedFocusId, setSelectedFocusId] = useState(null);
  const [editor, setEditor] = useState(buildEditorFromFocus(null));
  const [saveBusy, setSaveBusy] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [matrixBusy, setMatrixBusy] = useState(false);
  const [message, setMessage] = useState('');

  const focusTableRef = useRef(null);
  const focusTableElRef = useRef(null);
  const matrixTableRef = useRef(null);
  const matrixTableElRef = useRef(null);
  const updateFocusRoleFloorRef = useRef(null);

  const selectedFocus = useMemo(
    () => focuses.find((focus) => focus.id === selectedFocusId) || null,
    [focuses, selectedFocusId]
  );

  const focusRows = useMemo(
    () =>
      (focuses || []).map((focus) => ({
        id: focus.id,
        name: focus.name,
        type: normalizeType(focus.type),
        assignment: getAssignmentLabel(focus),
        components: getComponentCount(focus)
      })),
    [focuses]
  );

  const matrixRows = useMemo(
    () =>
      (focuses || []).map((focus) => ({
        id: focus.id,
        name: focus.name,
        type: normalizeType(focus.type),
        minimumRole: getMinimumRoleFromFocus(focus),
        guest: canRoleSeeFocus(focus, 'GUEST'),
        user: canRoleSeeFocus(focus, 'USER'),
        manager: canRoleSeeFocus(focus, 'MANAGER'),
        admin: canRoleSeeFocus(focus, 'ADMIN')
      })),
    [focuses]
  );

  const updateFocusRoleFloor = useCallback(
    async (focusId, minimumRole) => {
      const focus = (focuses || []).find((item) => item.id === focusId);
      if (!focus) return;

      setMatrixBusy(true);
      setMessage('');
      try {
        const roleUpper = normalizeRole(minimumRole);
        const payload = {
          name: focus.name,
          description: focus.description || '',
          type: 'ROLE',
          role: roleUpper,
          assignedRoles: [roleUpper],
          assignedUserId: null,
          components: focus.layoutData?.components || focus.components || [],
          isPublic: Boolean(focus.isPublic)
        };
        const ok = await updateFocus(focusId, payload);
        setMessage(ok ? `Updated minimum role to ${roleUpper}.` : 'Failed to update role assignment.');
      } catch (updateError) {
        setMessage(updateError?.message || 'Failed to update role assignment.');
      } finally {
        setMatrixBusy(false);
      }
    },
    [focuses, updateFocus]
  );

  useEffect(() => {
    updateFocusRoleFloorRef.current = updateFocusRoleFloor;
  }, [updateFocusRoleFloor]);

  useEffect(() => {
    let cancelled = false;
    const loadUsers = async () => {
      setUsersLoading(true);
      setUsersError('');
      try {
        const list = await taliaUserService.getAllTaliaUsers();
        if (!cancelled) {
          setUsers(list || []);
        }
      } catch (loadError) {
        if (!cancelled) setUsersError(loadError?.message || 'Failed to load users');
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!focuses?.length) {
      setSelectedFocusId(null);
      setEditor(buildEditorFromFocus(null));
      return;
    }
    if (!selectedFocusId || !focuses.some((f) => f.id === selectedFocusId)) {
      const firstId = focuses[0].id;
      setSelectedFocusId(firstId);
      setEditor(buildEditorFromFocus(focuses[0]));
      return;
    }
    if (selectedFocus) {
      setEditor(buildEditorFromFocus(selectedFocus));
    }
  }, [focuses, selectedFocusId, selectedFocus]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!focusTableElRef.current || focusTableRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled || !Tabulator || !focusTableElRef.current) return;

      focusTableRef.current = new Tabulator(focusTableElRef.current, {
        ...getTabulatorOptions({
          layout: 'fitDataFill',
          selectableRows: 1,
          height: '100%',
          data: [],
          columns: [
          { title: 'Focus Name', field: 'name', headerFilter: 'input' },
          { title: 'Type', field: 'type', width: 120, headerFilter: 'list', headerFilterParams: { valuesLookup: true, clearable: true } },
          { title: 'Assignment', field: 'assignment', headerFilter: 'input' },
          { title: 'Components', field: 'components', width: 120, hozAlign: 'center' }
          ]
        })
      });

      focusTableRef.current.on('rowClick', (_, row) => {
        const data = row.getData();
        if (data?.id) setSelectedFocusId(data.id);
      });
    };
    init();
    return () => {
      cancelled = true;
      if (focusTableRef.current) {
        try {
          focusTableRef.current.destroy();
        } catch {
          // no-op
        }
        focusTableRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!focusTableRef.current) return;
    focusTableRef.current.setData(focusRows || []);
  }, [focusRows]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!matrixTableElRef.current || matrixTableRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled || !Tabulator || !matrixTableElRef.current) return;

      matrixTableRef.current = new Tabulator(matrixTableElRef.current, {
        ...getTabulatorOptions({
          layout: 'fitDataFill',
          selectableRows: false,
          height: '100%',
          data: [],
          columns: [
          { title: 'Focus Name', field: 'name', headerFilter: 'input' },
          { title: 'Type', field: 'type', width: 120 },
          {
            title: 'Minimum Role',
            field: 'minimumRole',
            width: 140,
            editor: 'list',
            editorParams: { values: ['GUEST', 'USER', 'MANAGER', 'ADMIN'] },
            cellEdited: (cell) => {
              const data = cell.getRow().getData();
              updateFocusRoleFloorRef.current?.(data.id, cell.getValue());
            }
          },
          {
            title: 'Guest',
            field: 'guest',
            width: 90,
            hozAlign: 'center',
            formatter: 'tickCross',
            cellClick: (_, cell) => updateFocusRoleFloorRef.current?.(cell.getRow().getData().id, 'GUEST')
          },
          {
            title: 'User',
            field: 'user',
            width: 90,
            hozAlign: 'center',
            formatter: 'tickCross',
            cellClick: (_, cell) => updateFocusRoleFloorRef.current?.(cell.getRow().getData().id, 'USER')
          },
          {
            title: 'Manager',
            field: 'manager',
            width: 100,
            hozAlign: 'center',
            formatter: 'tickCross',
            cellClick: (_, cell) => updateFocusRoleFloorRef.current?.(cell.getRow().getData().id, 'MANAGER')
          },
          {
            title: 'Admin',
            field: 'admin',
            width: 90,
            hozAlign: 'center',
            formatter: 'tickCross',
            cellClick: (_, cell) => updateFocusRoleFloorRef.current?.(cell.getRow().getData().id, 'ADMIN')
          }
          ]
        })
      });
    };
    init();
    return () => {
      cancelled = true;
      if (matrixTableRef.current) {
        try {
          matrixTableRef.current.destroy();
        } catch {
          // no-op
        }
        matrixTableRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!matrixTableRef.current) return;
    matrixTableRef.current.setData(matrixRows || []);
  }, [matrixRows]);

  const handleEditorTypeChange = useCallback((nextType) => {
    const upperType = normalizeType(nextType);
    setEditor((prev) => {
      if (upperType === 'STANDARD') {
        return { ...prev, type: upperType, assignedRoles: [...ROLE_ORDER], assignedUserId: '' };
      }
      if (upperType === 'ROLE') {
        return {
          ...prev,
          type: upperType,
          assignedRoles: prev.assignedRoles?.length ? prev.assignedRoles : ['USER'],
          assignedUserId: ''
        };
      }
      if (upperType === 'USER') {
        return { ...prev, type: upperType, assignedRoles: [], assignedUserId: prev.assignedUserId || '' };
      }
      return { ...prev, type: upperType, assignedRoles: [...ROLE_ORDER], assignedUserId: '' };
    });
  }, []);

  const handleSaveFocus = useCallback(async () => {
    if (!selectedFocus) return;
    if (!editor.name?.trim()) {
      setMessage('Focus name is required.');
      return;
    }
    if (editor.type === 'ROLE' && !editor.assignedRoles?.length) {
      setMessage('Select at least one role for ROLE focuses.');
      return;
    }
    if (editor.type === 'USER' && !editor.assignedUserId) {
      setMessage('Select a user for USER focuses.');
      return;
    }

    setSaveBusy(true);
    setMessage('');
    try {
      const payload = {
        name: editor.name.trim(),
        description: editor.description || '',
        type: editor.type,
        role: normalizeRole(editor.role || 'USER'),
        assignedRoles:
          editor.type === 'STANDARD'
            ? [...ROLE_ORDER]
            : editor.type === 'ROLE'
              ? editor.assignedRoles.map(normalizeRole)
              : [],
        assignedUserId: editor.type === 'USER' ? editor.assignedUserId : null,
        components:
          selectedFocus.layoutData?.components
          || selectedFocus.components
          || [],
        isPublic: Boolean(selectedFocus.isPublic)
      };
      const ok = await updateFocus(selectedFocus.id, payload);
      setMessage(ok ? 'Focus saved.' : 'Failed to save focus.');
    } catch (saveError) {
      setMessage(saveError?.message || 'Failed to save focus.');
    } finally {
      setSaveBusy(false);
    }
  }, [editor, selectedFocus, updateFocus]);

  const handleCreateFocus = useCallback(async () => {
    const trimmed = createName.trim();
    if (!trimmed) {
      setMessage('Enter a name for the new focus.');
      return;
    }
    setCreateBusy(true);
    setMessage('');
    try {
      const ok = await createFocus({
        name: trimmed,
        description: '',
        type: 'STANDARD',
        role: 'USER',
        assignedRoles: [...ROLE_ORDER],
        assignedUserId: null,
        components: [],
        isPublic: false
      });
      if (ok) {
        setCreateName('');
        setMessage('Focus created.');
      } else {
        setMessage('Failed to create focus.');
      }
    } catch (createError) {
      setMessage(createError?.message || 'Failed to create focus.');
    } finally {
      setCreateBusy(false);
    }
  }, [createFocus, createName]);

  return (
    <div className="admin-access">
      <div className="admin-access__top">
        <div className="admin-access__intro">
          <h2 className="admin-access__title">Focus Access Management</h2>
          <p className="admin-access__subtitle">
            Manage focus names, assignment type, and role/user visibility from one place.
          </p>
        </div>
        <div className="admin-access__create">
          <input
            className="admin-access__input"
            type="text"
            placeholder="New focus name"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
          <button
            className="talia-btn talia-btn--primary"
            type="button"
            disabled={createBusy}
            onClick={handleCreateFocus}
          >
            {createBusy ? 'Creating...' : 'Create Focus'}
          </button>
        </div>
      </div>

      <div className="admin-access__status" role="status" aria-live="polite">
        {message ? <span className="admin-access__message">{message}</span> : null}
        {!message && error ? <span className="admin-access__error">Focus error: {error}</span> : null}
        {!message && !error && usersError ? <span className="admin-access__error">User error: {usersError}</span> : null}
      </div>

      <div className="admin-access__grid">
        <section className="admin-access__panel">
          <header className="admin-access__panel-header">
            <h3>Focus Catalogue</h3>
          </header>
          <div className="admin-access__table" ref={focusTableElRef} />
        </section>

        <section className="admin-access__panel admin-access__panel--editor">
          <header className="admin-access__panel-header">
            <h3>Selected Focus Editor</h3>
          </header>
          {!selectedFocus ? (
            <div className="admin-access__empty">Select a focus to edit.</div>
          ) : (
            <div className="admin-access__form">
              <label className="admin-access__field">
                <span>Name</span>
                <input
                  className="admin-access__input"
                  type="text"
                  value={editor.name}
                  onChange={(event) => setEditor((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>

              <label className="admin-access__field">
                <span>Description</span>
                <textarea
                  className="admin-access__textarea"
                  value={editor.description}
                  onChange={(event) => setEditor((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>

              <label className="admin-access__field">
                <span>Type</span>
                <select
                  className="admin-access__select"
                  value={editor.type}
                  onChange={(event) => handleEditorTypeChange(event.target.value)}
                >
                  {FOCUS_TYPES.map((focusType) => (
                    <option key={focusType} value={focusType}>
                      {focusType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-access__field">
                <span>Primary Role</span>
                <select
                  className="admin-access__select"
                  value={editor.role}
                  onChange={(event) =>
                    setEditor((prev) => ({ ...prev, role: normalizeRole(event.target.value) }))
                  }
                >
                  {ROLE_ORDER.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              {editor.type === 'ROLE' ? (
                <div className="admin-access__field">
                  <span>Assigned Roles</span>
                  <div className="admin-access__checks">
                    {ROLE_ORDER.map((role) => (
                      <label key={role} className="admin-access__check">
                        <input
                          type="checkbox"
                          checked={editor.assignedRoles.includes(role)}
                          onChange={(event) => {
                            setEditor((prev) => ({
                              ...prev,
                              assignedRoles: event.target.checked
                                ? [...prev.assignedRoles, role]
                                : prev.assignedRoles.filter((item) => item !== role)
                            }));
                          }}
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {editor.type === 'USER' ? (
                <label className="admin-access__field">
                  <span>Assigned User</span>
                  <select
                    className="admin-access__select"
                    value={editor.assignedUserId}
                    onChange={(event) =>
                      setEditor((prev) => ({ ...prev, assignedUserId: event.target.value }))
                    }
                  >
                    <option value="">Select user...</option>
                    {[...devUsers, ...users]
                      .filter((userItem, idx, arr) => idx === arr.findIndex((x) => x.id === userItem.id))
                      .map((userItem) => (
                        <option key={userItem.id} value={userItem.id}>
                          {(userItem.name || userItem.email || userItem.id)} ({normalizeRole(userItem.role || userItem.taliaRole)})
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}

              <div className="admin-access__actions">
                <button
                  className="talia-btn talia-btn--primary"
                  type="button"
                  disabled={saveBusy || loading}
                  onClick={handleSaveFocus}
                >
                  {saveBusy ? 'Saving...' : 'Save Focus'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="admin-access__panel admin-access__panel--full">
          <header className="admin-access__panel-header">
            <h3>Role Access Matrix</h3>
            <span className="admin-access__hint">Click a role cell to set minimum role</span>
          </header>
          <div className="admin-access__table" ref={matrixTableElRef} />
        </section>
      </div>

      {usersLoading ? <div className="admin-access__loading">Loading user previews...</div> : null}
      {matrixBusy ? <div className="admin-access__loading">Updating role assignment...</div> : null}
    </div>
  );
};

export default AdminAccessManager;

