'use client';
import { Component, Fragment } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Class component — getDerivedStateFromError has no hook equivalent. Wraps
// each mode panel so a render crash in one tool doesn't take down the others.
export default class ErrorBoundary extends Component {
  state = { error: null, resetCount: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleReset = () => {
    this.setState((prev) => ({ error: null, resetCount: prev.resetCount + 1 }));
  };

  render() {
    const { isDark, children } = this.props;
    const { error, resetCount } = this.state;

    if (error) {
      return (
        <div
          className={`my-8 rounded-2xl border p-8 text-center ${
            isDark
              ? 'bg-gray-800/60 border-gray-700 text-white'
              : 'bg-white border-gray-200 text-gray-900'
          }`}
        >
          <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-amber-500" />
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {error?.message || 'An unexpected error occurred in this tool.'}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Reset this tool
          </button>
        </div>
      );
    }

    // Key on resetCount so a reset remounts the crashed tree from scratch.
    return <Fragment key={resetCount}>{children}</Fragment>;
  }
}
