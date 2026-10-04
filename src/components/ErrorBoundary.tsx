import { I18n } from './Localized';
import { Component, type ReactNode } from 'react';
import { brand } from '../../shared/brand';
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <I18n.main className="empty-state m-6" role="alert">
        <I18n.h1>{brand.name} could not load this view.</I18n.h1>
        <I18n.p className="my-4">Reload the page to recover your session.</I18n.p>
        <I18n.button className="primary-button" onClick={() => window.location.reload()}>
          Reload
        </I18n.button>
      </I18n.main>
    ) : (
      this.props.children
    );
  }
}
