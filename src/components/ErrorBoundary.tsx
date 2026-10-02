import { Component, type ReactNode } from 'react';
import { brand } from '../../shared/brand';
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="empty-state m-6" role="alert">
        <h1>{brand.name} could not load this view.</h1>
        <p className="my-4">Reload the page to recover your session.</p>
        <button className="primary-button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
