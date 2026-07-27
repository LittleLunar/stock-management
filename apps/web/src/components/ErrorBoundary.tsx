import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center text-slate-900">
          <h1 className="text-xl font-semibold">
            {i18n.t("errorBoundary.title", { ns: "common" })}
          </h1>
          <p className="max-w-md text-sm text-slate-600">
            {i18n.t("errorBoundary.description", { ns: "common" })}
          </p>
          <button
            type="button"
            className="rounded bg-teal-800 px-4 py-2 text-sm text-white"
            onClick={() => window.location.reload()}
          >
            {i18n.t("actions.reload", { ns: "common" })}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
