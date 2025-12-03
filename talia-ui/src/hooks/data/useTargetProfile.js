/**
 * Custom hooks for target profile data
 * Provides hooks for fetching and managing target profiles
 */

import { useState, useEffect } from 'react';
import targetProfileService from '../../services/data/targetProfileService';

/**
 * Hook for fetching all target profiles
 * @param {Object} filters - Filter options
 * @returns {Object} { data, loading, error, refetch }
 */
export const useTargetProfiles = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await targetProfileService.fetchAll(filters);
      setData(result);
    } catch (err) {
      console.error('[useTargetProfiles] Error:', err);
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [JSON.stringify(filters)]); // Re-fetch when filters change

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};

/**
 * Hook for fetching single target profile
 * @param {string} id - Target profile ID
 * @returns {Object} { data, loading, error, refetch }
 */
export const useTargetProfile = (id) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!id) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await targetProfileService.fetchById(id);
      setData(result);
    } catch (err) {
      console.error('[useTargetProfile] Error:', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};

/**
 * Hook for target profile mutations (create, update, delete)
 * @returns {Object} { create, update, delete, loading, error }
 */
export const useTargetProfileMutation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = async (input) => {
    setLoading(true);
    setError(null);
    try {
      const result = await targetProfileService.create(input);
      return result;
    } catch (err) {
      console.error('[useTargetProfileMutation] Create error:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const update = async (id, input) => {
    setLoading(true);
    setError(null);
    try {
      const result = await targetProfileService.update(id, input);
      return result;
    } catch (err) {
      console.error('[useTargetProfileMutation] Update error:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteProfile = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const result = await targetProfileService.delete(id);
      return result;
    } catch (err) {
      console.error('[useTargetProfileMutation] Delete error:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    create,
    update,
    delete: deleteProfile,
    loading,
    error
  };
};

