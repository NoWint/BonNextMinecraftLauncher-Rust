import React from 'react';
import { log } from '../../../shared/utils/logger';
import { I18nContext } from '../../../shared/i18n';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  static contextType = I18nContext;
  declare context: React.ContextType<typeof I18nContext>;

  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });
    log('error', 'ErrorBoundary', error.message, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const t = this.context?.t ?? ((key: string) => key);
      const isDev = import.meta.env.DEV;
      const errorMessage = this.state.error?.message || t('error.defaultMessage');
      const stackTrace = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className={styles.wrap}>
          <div className={styles.bar} />
          <div className={styles.title}>{t('error.title')}</div>
          <div className={styles.message}>{errorMessage}</div>
          <div className={styles.actions}>
            <button className={styles.retryBtn} onClick={this.handleRetry}>
              {t('error.retry')}
            </button>
            <button
              className={styles.homeBtn}
              onClick={() => {
                this.handleRetry();
                window.location.hash = '#/';
              }}
            >
              {t('error.returnHome')}
            </button>
          </div>
          {isDev && (stackTrace || componentStack) && (
            <details className={styles.details}>
              <summary className={styles.summary}>{t('error.details')}</summary>
              {stackTrace && <pre className={styles.stack}>{stackTrace}</pre>}
              {componentStack && (
                <>
                  <div className={styles.stackLabel}>{t('error.componentStack')}</div>
                  <pre className={styles.stack}>{componentStack}</pre>
                </>
              )}
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
