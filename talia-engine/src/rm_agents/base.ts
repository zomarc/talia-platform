import type { Finding } from '../contracts/finding.js';

export type EvaluationSubject = {
  type: string;
  id: string;
  [key: string]: unknown;
};

export type EvaluationContext = {
  as_of: Date;
  subjects: EvaluationSubject[] | 'all-configured';
  world: Record<string, unknown>;
  config?: Record<string, unknown>;
};

export type RmAgent = {
  id: string;
  name: string;
  evaluate: (ctx: EvaluationContext) => Finding[] | Promise<Finding[]>;
};
