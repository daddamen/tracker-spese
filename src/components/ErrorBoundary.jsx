import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { errore: null }
  static getDerivedStateFromError(errore) { return { errore } }
  render() {
    if (!this.state.errore) return this.props.children
    return (
      <div className="vuoto grande" style={{ margin: 20 }}>
        <h2>Qualcosa è andato storto</h2>
        <p className="piccolo">{String(this.state.errore.message ?? this.state.errore)}</p>
        <button className="btn primario" onClick={() => location.reload()}>Ricarica l'app</button>
        <p className="piccolo">I tuoi dati sono al sicuro nel browser. Se il problema continua, copia il messaggio qui sopra.</p>
      </div>
    )
  }
}
