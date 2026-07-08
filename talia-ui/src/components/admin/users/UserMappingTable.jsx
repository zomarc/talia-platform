import React, { useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import taliaUserService from '../../../services/TaliaUserService';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import '../admin.css';

const UserMappingTable = () => {
  const { devUsers = [] } = useSupabaseAuth();
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const tableElRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const users = await taliaUserService.getAllTaliaUsers();
      const mappedData = (users || []).map(user => ({
        taliaUserId: user.taliaUserId,
        supabaseAuthId: user.id,
        email: user.email
      }));

      if (mappedData.length === 0 && devUsers.length > 0) {
        setMappings(
          devUsers.map((devUser) => ({
            taliaUserId: devUser.talia_user_id,
            supabaseAuthId: devUser.id,
            email: devUser.email
          }))
        );
        return;
      }

      setMappings(mappedData);
    } catch (err) {
      console.error('Error loading user mappings:', err);
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const rows = useMemo(
    () =>
      (mappings || []).map((mapping) => ({
        taliaUserId: mapping.taliaUserId,
        supabaseAuthId: mapping.supabaseAuthId,
        email: mapping.email
      })),
    [mappings]
  );

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!tableElRef.current || tableRef.current) return;
      const Tabulator = await initTabulator();
      if (!Tabulator || cancelled || !tableElRef.current) return;
      tableRef.current = new Tabulator(tableElRef.current, {
        ...getTabulatorOptions({
          selectableRows: false,
          height: '100%',
          data: [],
          columns: [
          { title: 'Talia User ID', field: 'taliaUserId', width: 120, hozAlign: 'center' },
          { title: 'Supabase Auth ID', field: 'supabaseAuthId', headerFilter: 'input' },
          { title: 'Email', field: 'email', headerFilter: 'input' }
          ]
        })
      });
    };
    init();
    return () => {
      cancelled = true;
      if (tableRef.current) {
        try {
          tableRef.current.destroy();
        } catch {
          // noop
        }
        tableRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!tableRef.current) return;
    tableRef.current.setData(rows || []);
  }, [rows]);

  return (
    <div className="talia-report" role="region" aria-label="Legacy user mappings">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">User Mappings (Legacy)</h2>
          <p className="talia-report__subtitle">External auth to internal Talia user mapping reference</p>
        </div>
      </header>
      <div className="talia-report__actions-bar" aria-label="User mapping actions">
        <button className="talia-btn talia-btn--secondary" type="button" onClick={loadMappings} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      <main className="talia-report__content">
        {error ? <div className="admin-access__error">Error: {error}</div> : null}
        <div className="admin-access__table" ref={tableElRef} />
      </main>
      <div className="admin-access__loading">
        Total mappings: {rows.length}
      </div>
    </div>
  );
};

export default UserMappingTable;
