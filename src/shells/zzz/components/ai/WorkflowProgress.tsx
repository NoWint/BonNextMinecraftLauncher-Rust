import React from 'react';
import styles from './WorkflowProgress.module.css';

interface WorkflowProgressProps {
  workflowId: string;
  step: number;
  totalSteps: number;
  stepName: string;
  detail?: string;
  status: string;
  onAbort: (id: string) => void;
  onRetry: (id: string) => void;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  workflowId,
  step,
  totalSteps,
  stepName,
  detail,
  status,
  onAbort,
  onRetry,
}) => {
  const progress = totalSteps > 0 ? (step / totalSteps) * 100 : 0;

  return (
    <div className={styles.container}>
      <div className={styles.stepInfo}>
        <span className={styles.stepName}>{stepName}</span>
        <span className={styles.stepCount}>{step}/{totalSteps}</span>
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
      {detail && <div className={styles.detail}>{detail}</div>}
      <div className={styles.actions}>
        {(status === 'running' || status === 'pending') && (
          <button className={styles.abortBtn} onClick={() => onAbort(workflowId)}>Abort</button>
        )}
        {status === 'failed' && (
          <button className={styles.retryBtn} onClick={() => onRetry(workflowId)}>Retry</button>
        )}
      </div>
    </div>
  );
};
