import React from 'react';

/**
 * Top-level ErrorBoundary — catches any unhandled render error
 * and shows a friendly UI instead of a blank white screen.
 *
 * The root cause of the old "insertBefore" error was portals rendered
 * into document.body competing with React's #root tree.
 * Fixed by: all portals now render into #loqa-portals (see index.html).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Loqa ErrorBoundary]', error.message);
    if (info?.componentStack) console.error(info.componentStack);
  }

  handleReload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A0A0F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'Inter',-apple-system,sans-serif",
      }}>
        <div style={{
          background: '#13131A',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 20,
          padding: '40px 36px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,.5)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#F0F0FF', margin: '0 0 10px' }}>
            Something went wrong
          </h2>

          <p style={{ color: '#9090B0', fontSize: 14, margin: '0 0 8px', lineHeight: 1.6 }}>
            {error?.message || 'An unexpected error occurred.'}
          </p>

          <p style={{ color: '#5A5A7A', fontSize: 12, margin: '0 0 24px' }}>
            Your playlists and liked songs are safely stored and will be restored after reload.
          </p>

          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg,#6C63FF,#B06AFF)',
              border: 'none', borderRadius: 12,
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Reload App
          </button>

          {this.props.showDetails && error?.stack && (
            <details style={{ marginTop: 24, textAlign: 'left' }}>
              <summary style={{ color: '#5A5A7A', fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                Technical details
              </summary>
              <pre style={{
                color: '#5A5A7A', fontSize: 11, marginTop: 10,
                overflow: 'auto', background: 'rgba(255,255,255,.04)',
                padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap',
                maxHeight: 240,
              }}>
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
