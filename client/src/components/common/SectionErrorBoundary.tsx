import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--ink-mute)',
          }}>
            Could not load {this.props.title}
          </span>
        </div>
      )
    }
    return this.props.children
  }
}
