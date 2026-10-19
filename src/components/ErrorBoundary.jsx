import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("UI error:", error, info);
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="mb-1 text-lg font-semibold">Something went wrong</h2>
        <p className="mb-4 text-sm">This page could not be shown. You can go back to the dashboard and try again.</p>
        <button
          className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
          onClick={() => this.props.onHome?.()}
        >
          Go to dashboard
        </button>
      </div>
    );
  }
}
