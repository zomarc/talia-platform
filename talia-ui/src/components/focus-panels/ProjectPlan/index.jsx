/**
 * Project plan — ADMIN+ container.
 * Phases match the functionality matrix. Milestones match requirement target versions.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { FUNCTIONALITY_MATRIX_ITEMS_QUERY } from '../../../graphql/functionalityMatrixOperations';
import {
  PROJECT_DOCUMENTS_QUERY,
  PROJECT_PLAN_CALENDAR_QUERY,
  RISK_REGISTER_ITEMS_QUERY,
  SAVE_PROJECT_PLAN_MUTATION,
} from '../../../graphql/projectAdminOperations';
import { REQUIREMENT_ITEMS_QUERY } from '../../../graphql/taliaRequirementLogOperations';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { VIEW_DETAILS, VIEW_PROVENANCE } from '../../../lib/componentOptionsCatalog';
import { linkedElements } from '../../../lib/projectPlan';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import PanelDataState from '../../shared/PanelDataState';
import ProjectPlanPresenter from './ProjectPlanPresenter';

const COMPONENT = 'project-plan';
const PLAN_OPTIONS = {
  views: [
    { ...VIEW_DETAILS, default: true },
    VIEW_PROVENANCE,
  ],
  operations: [],
};

const emptyDraft = () => ({ name: '', targetOn: '', phaseCode: '' });

const ProjectPlanContainer = ({ panelInstanceId = null, panelComponentId = null }) => {
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || 'USER');
  const allowed = canAccessPrivilegedPanels(role);
  const {
    showDetails,
    showProvenance,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId || COMPONENT, panelInstanceId, PLAN_OPTIONS);

  const [phases, setPhases] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [matrixItems, setMatrixItems] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [risks, setRisks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState('0');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadRef = useRef(null);

  const applyCalendar = (calendar) => {
    setPhases(calendar?.phases || []);
    setMilestones(calendar?.milestones || []);
  };

  const load = useCallback(async () => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [plan, matrix, log, riskData, docs] = await Promise.all([
        fetchGraphql({
          query: PROJECT_PLAN_CALENDAR_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load project plan',
          tableName: 'project_phase',
        }),
        fetchGraphql({
          query: FUNCTIONALITY_MATRIX_ITEMS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load matrix for the plan',
          tableName: 'functionality_matrix_item',
        }),
        fetchGraphql({
          query: REQUIREMENT_ITEMS_QUERY,
          variables: { filters: { includeDone: true, limit: 2000 } },
          component: panelComponentId || COMPONENT,
          purpose: 'Load requirements for the plan',
          tableName: 'talia_requirement_item',
        }),
        fetchGraphql({
          query: RISK_REGISTER_ITEMS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load risks for the plan',
          tableName: 'risk_register_item',
        }),
        fetchGraphql({
          query: PROJECT_DOCUMENTS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load documents for the plan',
          tableName: 'project_document',
        }),
      ]);
      applyCalendar(plan?.projectPlanCalendar);
      setMatrixItems(matrix?.functionalityMatrixItems || []);
      setRequirements(log?.requirementItems || []);
      setRisks(riskData?.riskRegisterItems || []);
      setDocuments(docs?.projectDocuments || []);
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchGraphql, panelComponentId, shouldSkipRefresh]);

  loadRef.current = load;

  useEffect(() => {
    onResumeFetch(() => { loadRef.current?.(); });
    return () => onResumeFetch(null);
  }, [onResumeFetch]);

  useEffect(() => { load(); }, [load]);

  const selectedMilestone = milestones.find((item) => item.id === selectedMilestoneId) || null;
  const phaseCode = selectedMilestone?.phaseCode || selectedPhase;
  const linked = useMemo(() => linkedElements({
    phaseCode,
    milestoneName: selectedMilestone?.name || null,
    milestones,
    matrixItems,
    requirements,
    risks,
    documents,
  }), [phaseCode, selectedMilestone, milestones, matrixItems, requirements, risks, documents]);

  const phaseMilestones = milestones.filter((item) => item.phaseCode === phaseCode);
  const unplaced = milestones.filter((item) => !item.phaseCode);

  const selectPhase = (code) => {
    setSelectedPhase(code);
    setSelectedMilestoneId(null);
    setDraft({ ...emptyDraft(), phaseCode: code });
    setMessage(null);
  };

  const selectMilestone = (milestone) => {
    setSelectedMilestoneId(milestone.id);
    if (milestone.phaseCode) setSelectedPhase(milestone.phaseCode);
    setDraft({
      name: '',
      targetOn: '',
      phaseCode: milestone.phaseCode || selectedPhase,
    });
    setMessage(null);
  };

  const save = async (event) => {
    event?.preventDefault();
    const phase = phases.find((item) => item.code === phaseCode) || phases[0];
    if (!phase) return;
    const rows = milestones.map((item) => ({
      id: item.id,
      name: item.name,
      phaseCode: item.phaseCode,
      targetOn: item.targetOn || null,
      sortOrder: item.sortOrder,
    }));
    const draftName = draft.name.trim();
    if (draftName) {
      rows.push({
        name: draftName,
        phaseCode: draft.phaseCode || phase.code,
        targetOn: draft.targetOn || null,
        sortOrder: rows.length,
      });
    }
    setBusy(true);
    setMessage(null);
    try {
      const data = await fetchGraphql({
        query: SAVE_PROJECT_PLAN_MUTATION,
        variables: {
          input: {
            phaseCode: phase.code,
            targetOn: phase.targetOn || null,
            milestones: rows,
          },
        },
        component: panelComponentId || COMPONENT,
        purpose: 'Save project plan dates',
        tableName: 'project_phase',
      });
      applyCalendar(data?.saveProjectPlan);
      setDraft({ ...emptyDraft(), phaseCode: phase.code });
      setMessage('Saved');
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const updatePhaseDate = (targetOn) => {
    setPhases((current) => current.map((item) => (
      item.code === phaseCode ? { ...item, targetOn } : item
    )));
  };

  const updateMilestone = (id, patch) => {
    setMilestones((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  if (!allowed) {
    return (
      <div className="focus-panel-empty">
        <p>Admin or Super User access required for the project plan.</p>
      </div>
    );
  }

  return (
    <PanelDataState
      loading={loading && phases.length === 0 && !error}
      loadingMessage="Loading project plan..."
      error={error && phases.length === 0 ? error : null}
      errorTitle="Failed to load project plan"
      empty={false}
      onRetry={load}
    >
      <ProjectPlanPresenter
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || COMPONENT}
        reportShellClassName={reportShellClassName}
        showDetails={showDetails}
        showProvenance={showProvenance}
        phases={phases}
        milestones={milestones}
        phaseMilestones={phaseMilestones}
        unplaced={unplaced}
        phaseCode={phaseCode}
        selectedMilestoneId={selectedMilestoneId}
        linked={linked}
        draft={draft}
        busy={busy}
        message={message}
        onSelectPhase={selectPhase}
        onSelectMilestone={selectMilestone}
        onPhaseDate={updatePhaseDate}
        onMilestoneChange={updateMilestone}
        onDraftChange={setDraft}
        onSave={save}
        onRefresh={load}
      />
    </PanelDataState>
  );
};

export default ProjectPlanContainer;
