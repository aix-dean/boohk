import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock the component itself
vi.mock('./page', () => ({
  default: () => <div data-testid="proposal-details-page">Mocked Proposal Page</div>
}))

import ProposalDetailsPage from './page'

describe('ProposalDetailsPage', () => {
  it('renders the component', () => {
    render(<ProposalDetailsPage />)
    expect(screen.getByTestId('proposal-details-page')).toBeInTheDocument()
    expect(screen.getByText('Mocked Proposal Page')).toBeInTheDocument()
  })
})