import React from 'react';
import styles from './PluginErrorBoundary.module.css';

interface Props {
  pluginId?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PluginErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[PluginErrorBoundary] Plugin "${this.props.pluginId ?? 'unknown'}" crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorWrap}>
          <p className={styles.title}>Plugin crashed</p>
          <p className={styles.message}>
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className={styles.retryBtn}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
