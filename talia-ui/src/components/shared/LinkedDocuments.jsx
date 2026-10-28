import React, { useEffect, useState } from 'react';
import { PROJECT_DOCUMENTS_FOR_QUERY } from '../../graphql/projectAdminOperations';
import { trackedFetchGraphql } from '../../services/data/trackedGraphql';
import './linked-documents.css';

const LinkedDocuments = ({ targetKind, targetId }) => {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    if (!targetKind || !targetId) {
      setDocuments([]);
      return undefined;
    }
    let cancelled = false;
    trackedFetchGraphql({
      query: PROJECT_DOCUMENTS_FOR_QUERY,
      variables: { targetKind, targetId },
      component: 'LinkedDocuments',
      purpose: 'Load documents linked to a project record',
      tableName: 'project_document',
    }).then((data) => {
      if (!cancelled) {
        setDocuments(Array.isArray(data?.projectDocumentsFor) ? data.projectDocumentsFor : []);
      }
    }).catch(() => {
      if (!cancelled) setDocuments([]);
    });
    return () => {
      cancelled = true;
    };
  }, [targetKind, targetId]);

  if (!documents.length) return null;

  return (
    <p className="linked-documents">
      <span className="linked-documents__label">Documents</span>
      {documents.map((doc) => `${doc.referenceCode} ${doc.title}`).join(' · ')}
    </p>
  );
};

export default LinkedDocuments;
