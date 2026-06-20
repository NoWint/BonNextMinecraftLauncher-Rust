import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../../../shared/i18n';
import { useAIAssistant } from '../../../../shared/stores/aiAssistantStore';
import { ChatMessage } from './ChatMessage';
import { ModpackPreview } from './ModpackPreview';
import { WorkflowProgress } from './WorkflowProgress';
import { CrashAnalysisPanel } from './CrashAnalysisPanel';
import { ConfirmDialog } from './ConfirmDialog';
import { workflowApi } from '../../../../shared/api/workflow';
import type { ModpackPlan } from '../../../../shared/ai/types';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import styles from './ChatPanel.module.css';

const SUGGESTIONS: Array<{ text: string; icon: IconName }> = [
  { text: '我的游戏崩溃了，帮我分析', icon: 'search' },
  { text: '帮我装 Fabric 1.21.1', icon: 'bolt' },
  { text: '我想玩养老种田整合包', icon: 'sparkles' },
  { text: '推荐一些好用的优化模组', icon: 'lightbulb' },
  { text: '我的世界 TPS 很低怎么办', icon: 'wrench' },
  { text: '搜索并安装 JEI 和 Sodium', icon: 'cube' },
];

export const ChatPanel: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state, sendMessage, setPanelOpen, confirmTask, cancelTask, retryTask, clearMessages, dismissCrashAlert, abortWorkflow, abortAgent } = useAIAssistant();
  const [input, setInput] = useState('');
  const [pendingPlan, setPendingPlan] = useState<ModpackPlan | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // 崩溃告警出现时自动打开 AI 面板,确保用户可见
  useEffect(() => {
    if (state.crashAlert && !state.isOpen) {
      setPanelOpen(true);
    }
  }, [state.crashAlert, state.isOpen, setPanelOpen]);

  const handleSend = async () => {
    if (!input.trim() || state.isLoading) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setPanelOpen(false);
  };

  const handleOpenSettings = () => {
    navigate('/settings');
    setPanelOpen(false);
  };

  return (
    <>
      <ConfirmDialog />
      <div className={`${styles.rainbowBorder} ${state.isOpen ? styles['rainbowBorder--visible'] : ''}`}>
        <div className={`${styles.rainbowBorder__edge} ${styles['rainbowBorder__edge--right']}`} />
        <div className={`${styles.rainbowBorder__edge} ${styles['rainbowBorder__edge--top']}`} />
        <div className={`${styles.rainbowBorder__edge} ${styles['rainbowBorder__edge--bottom']}`} />
        <div className={`${styles.rainbowBorder__edge} ${styles['rainbowBorder__edge--left']}`} />
      </div>

      <div
        className={`${styles.panel__overlay} ${state.isOpen ? styles['panel__overlay--visible'] : ''}`}
        onClick={handleClose}
      />
      <div className={`${styles.panel} ${state.isOpen ? styles['panel--open'] : ''}`} />

      <div className={`${styles.controlsCard} ${state.isOpen ? styles['controlsCard--open'] : ''}`}>
        <div className={styles.controlsCard__header}>
          <span className={styles.controlsCard__title}>{t('ai.title')}</span>
          <div className={styles.controlsCard__actions}>
            {state.isLoading && (
              <button className={styles.controlsCard__actionBtn} onClick={abortAgent} title="Stop">
                ■ Stop
              </button>
            )}
            <button className={styles.controlsCard__actionBtn} onClick={clearMessages} title={t('ai.clear')}>
              {t('ai.clear')}
            </button>
            <button className={styles.controlsCard__actionBtn} onClick={handleOpenSettings} title={t('ai.settings')}>
              {t('ai.settings')}
            </button>
            <button className={styles.controlsCard__actionBtn} onClick={handleClose} title={t('ai.close')}>
              {t('ai.close')}
            </button>
          </div>
        </div>

        <div className={styles.controlsCard__messages}>
          {state.messages.length === 0 && (
            <div className={styles.controlsCard__empty}>
              <div className={styles.controlsCard__emptyIcon}>AI</div>
              <div className={styles.controlsCard__emptyText}>
                {t('ai.empty.line1')}
                <br />
                {t('ai.empty.line2')}
              </div>
              <div className={styles.controlsCard__suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    className={styles.controlsCard__suggestionChip}
                    onClick={() => handleSuggestionClick(s.text)}
                    disabled={state.isLoading || !state.config.enabled}
                  >
                    <span className={styles.controlsCard__suggestionIcon}><Icon name={s.icon} size={14} /></span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {state.messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              tasks={state.tasks}
              onConfirm={confirmTask}
              onCancel={cancelTask}
              onRetry={retryTask}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {Object.keys(state.activeWorkflows).length > 0 && (
          <div className={styles.controlsCard__workflows}>
            {Object.values(state.activeWorkflows).map((wf) => (
              <WorkflowProgress
                key={wf.id}
                workflowId={wf.id}
                step={wf.step}
                totalSteps={wf.totalSteps}
                stepName={wf.stepName}
                status="running"
                onAbort={abortWorkflow}
                onRetry={() => {}}
              />
            ))}
          </div>
        )}

        {pendingPlan && (
          <ModpackPreview
            plan={pendingPlan}
            onInstall={async (plan) => {
              try { await workflowApi.executeModpackPlan(plan); } catch { /* error handled by event */ }
              setPendingPlan(null);
            }}
            onCancel={() => setPendingPlan(null)}
          />
        )}

        {state.crashAlert && (
          <CrashAnalysisPanel
            instanceId={state.crashAlert.instanceId}
            crashReportPath={state.crashAlert.crashReportPath}
            severity={state.crashAlert.severity}
            onFix={(instanceId, crashReportPath) => {
              sendMessage(`Analyze and fix the crash for instance ${instanceId}. The crash report is at ${crashReportPath}. Apply the fix automatically.`);
              dismissCrashAlert();
            }}
            onDismiss={dismissCrashAlert}
          />
        )}

        {state.error && <div className={styles.controlsCard__error}>{state.error}</div>}

        <div className={styles.controlsCard__inputArea}>
          <div className={styles.controlsCard__inputWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.controlsCard__input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={state.config.enabled ? t('ai.placeholder.enabled') : t('ai.placeholder.disabled')}
              disabled={state.isLoading || !state.config.enabled}
              rows={1}
            />
            <button
              className={styles.controlsCard__sendBtn}
              onClick={handleSend}
              disabled={state.isLoading || !input.trim() || !state.config.enabled}
            >
              {t('ai.send')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
