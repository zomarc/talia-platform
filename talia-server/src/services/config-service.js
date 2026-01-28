/**
 * Configuration Service
 * 
 * Provides access to the talia_config schema for application configuration.
 * All configuration is database-backed and editable from UI without server restart.
 * 
 * Uses public views that expose the talia_config tables.
 */

import { supabase } from './supabase.js';

class ConfigService {
  constructor() {
    // Views in public schema that map to talia_config tables
    this.tables = {
      dateRange: 'integration_date_range',
      dataSource: 'data_source',
      environment: 'config_environment',
      setting: 'config_setting'
    };
  }

  /**
   * Get the active environment configuration
   */
  async getEnvironment() {
    try {
      const { data, error } = await supabase
        .from(this.tables.environment)
        .select('*')
        .eq('is_active', true)
        .single();

      if (error) {
        console.warn('Could not fetch environment config, using default:', error.message);
        return { environment_name: 'local', description: 'Default environment' };
      }

      return data;
    } catch (err) {
      console.warn('Environment fetch failed:', err.message);
      return { environment_name: 'local', description: 'Default environment' };
    }
  }

  /**
   * Get all integration date ranges
   */
  async getIntegrationDateRanges() {
    try {
      const { data, error } = await supabase
        .from(this.tables.dateRange)
        .select('*')
        .order('is_default', { ascending: false })
        .order('integration_name');

      if (error) {
        console.error('Error fetching date ranges:', error);
        throw new Error(`Failed to get date ranges: ${error.message}`);
      }

      return data || [];
    } catch (err) {
      console.error('getIntegrationDateRanges error:', err);
      throw err;
    }
  }

  /**
   * Get the active/default date range for a specific integration
   */
  async getActiveDateRange(integrationName = 'synapse_default') {
    try {
      const { data, error } = await supabase
        .from(this.tables.dateRange)
        .select('*')
        .eq('integration_name', integrationName)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching active date range:', error);
      }

      // If specific integration not found, get the default
      if (!data) {
        const { data: defaultData, error: defaultError } = await supabase
          .from(this.tables.dateRange)
          .select('*')
          .eq('is_default', true)
          .eq('is_active', true)
          .single();

        if (defaultError && defaultError.code !== 'PGRST116') {
          console.error('Error fetching default date range:', defaultError);
        }

        return defaultData;
      }

      return data;
    } catch (err) {
      console.error('getActiveDateRange error:', err);
      return null;
    }
  }

  /**
   * Update an integration date range
   */
  async updateDateRange(id, updates) {
    const { data, error } = await supabase
      .from(this.tables.dateRange)
      .update({
        date_from: updates.dateFrom,
        date_to: updates.dateTo,
        display_name: updates.displayName,
        description: updates.description,
        is_active: updates.isActive,
        is_default: updates.isDefault
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating date range:', error);
      throw new Error(`Failed to update date range: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new integration date range
   */
  async createDateRange(input) {
    const { data, error } = await supabase
      .from(this.tables.dateRange)
      .insert({
        integration_name: input.integrationName,
        display_name: input.displayName,
        description: input.description,
        date_from: input.dateFrom,
        date_to: input.dateTo,
        date_column: input.dateColumn,
        is_active: input.isActive !== false,
        is_default: input.isDefault || false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating date range:', error);
      throw new Error(`Failed to create date range: ${error.message}`);
    }

    return data;
  }

  /**
   * Set a date range as the default
   */
  async setDefaultDateRange(id) {
    // First, unset current default
    await supabase
      .from(this.tables.dateRange)
      .update({ is_default: false })
      .eq('is_default', true);

    // Set new default
    const { data, error } = await supabase
      .from(this.tables.dateRange)
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error setting default date range:', error);
      throw new Error(`Failed to set default date range: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all data sources
   */
  async getDataSources() {
    const { data, error } = await supabase
      .from(this.tables.dataSource)
      .select('*')
      .order('display_name');

    if (error) {
      console.error('Error fetching data sources:', error);
      throw new Error(`Failed to get data sources: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update data source health status
   */
  async updateDataSourceHealth(sourceName, healthStatus, isAvailable) {
    const { data, error } = await supabase
      .from(this.tables.dataSource)
      .update({
        health_status: healthStatus,
        is_available: isAvailable,
        last_health_check: new Date().toISOString()
      })
      .eq('source_name', sourceName)
      .select()
      .single();

    if (error) {
      console.error('Error updating data source health:', error);
    }

    return data;
  }

  /**
   * Get application settings
   */
  async getSettings(category = null) {
    let query = supabase
      .from(this.tables.setting)
      .select('*');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('category').order('setting_key');

    if (error) {
      console.error('Error fetching settings:', error);
      throw new Error(`Failed to get settings: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a specific setting value
   */
  async getSetting(category, settingKey) {
    const { data, error } = await supabase
      .from(this.tables.setting)
      .select('setting_value')
      .eq('category', category)
      .eq('setting_key', settingKey)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching setting:', error);
    }

    return data?.setting_value;
  }

  /**
   * Update a setting
   */
  async updateSetting(category, settingKey, value) {
    const { data, error } = await supabase
      .from(this.tables.setting)
      .update({ setting_value: value })
      .eq('category', category)
      .eq('setting_key', settingKey)
      .select()
      .single();

    if (error) {
      console.error('Error updating setting:', error);
      throw new Error(`Failed to update setting: ${error.message}`);
    }

    return data;
  }

  /**
   * Get complete configuration summary for UI
   */
  async getConfigSummary() {
    const [environment, dateRanges, dataSources, settings] = await Promise.all([
      this.getEnvironment(),
      this.getIntegrationDateRanges(),
      this.getDataSources(),
      this.getSettings()
    ]);

    const defaultDateRange = dateRanges.find(dr => dr.is_default) || dateRanges[0];

    return {
      environment: {
        name: environment.environment_name,
        description: environment.description
      },
      defaultDateRange: defaultDateRange ? {
        id: defaultDateRange.id,
        name: defaultDateRange.integration_name,
        displayName: defaultDateRange.display_name,
        dateFrom: defaultDateRange.date_from,
        dateTo: defaultDateRange.date_to,
        isDefault: defaultDateRange.is_default
      } : null,
      dateRanges: dateRanges.map(dr => ({
        id: dr.id,
        name: dr.integration_name,
        displayName: dr.display_name,
        description: dr.description,
        dateFrom: dr.date_from,
        dateTo: dr.date_to,
        dateColumn: dr.date_column,
        isActive: dr.is_active,
        isDefault: dr.is_default
      })),
      dataSources: dataSources.map(ds => ({
        id: ds.id,
        name: ds.source_name,
        displayName: ds.display_name,
        type: ds.source_type,
        isActive: ds.is_active,
        isAvailable: ds.is_available,
        healthStatus: ds.health_status,
        lastHealthCheck: ds.last_health_check
      })),
      settings: settings.reduce((acc, s) => {
        if (!acc[s.category]) acc[s.category] = {};
        acc[s.category][s.setting_key] = s.setting_value;
        return acc;
      }, {})
    };
  }
}

// Export singleton instance
export const configService = new ConfigService();
