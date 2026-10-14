import { Component, type ReactNode } from 'react';

/** Last-resort screen so a bug never leaves a blank app. Data in IndexedDB is untouched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen boot-error">
        <h1>Something went wrong</h1>
        <p>Your data is safe on this phone.</p>
        <div className="stack">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              location.hash = '#/';
              location.reload();
            }}
          >
            Reload LiftLog
          </button>
        </div>
        <p className="hint">{this.state.error.message}</p>
      </div>
    );
  }
}
