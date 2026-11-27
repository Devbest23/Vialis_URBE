import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[VIALIS] Error no controlado en la interfaz', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-semibold text-rose-300">La interfaz encontró un estado inesperado</p>
          <p className="max-w-md text-[12px] leading-relaxed text-slate-400">
            El módulo falló al renderizarse. Puedes recargar para reiniciar la sesión; el detalle del error está en la consola del navegador.
          </p>
          <pre className="max-h-32 max-w-xl overflow-auto rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-left font-mono text-[11px] text-slate-400">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-sky-500"
          >
            Recargar la aplicación
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
