import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../../../src/components/ErrorBoundary'

function BuggyComponent(): JSX.Element {
  throw new Error('Test crash!')
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <p>Hello world</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('shows fallback error message when a child component crashes', () => {
    // Suppress React's console.error for the expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test crash!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload App' })).toBeInTheDocument()

    spy.mockRestore()
  })
})
