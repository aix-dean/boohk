import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import { OnboardingTooltip } from '@/components/onboarding-tooltip'

// Mock missing lucide-react icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react')
  return {
    ...actual,
    ArrowRight: () => React.createElement('div', { 'data-testid': 'arrow-right-icon' }),
  }
})

describe('OnboardingTooltip Component', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Tour Display and Animation', () => {
    it('shows tour with initial step after mount delay', async () => {
      render(<OnboardingTooltip onClose={mockOnClose} />)

      // Fast-forward the setTimeout
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Now it should be visible
      await waitFor(() => {
        expect(screen.getByText('Control Bar')).toBeInTheDocument()
      })

      // Verify initial step content
      expect(screen.getByText('1/6')).toBeInTheDocument()
    })

  })

  describe('Tour Navigation', () => {
    it('navigates to next step when next button is clicked', async () => {
      const user = userEvent.setup()
      render(<OnboardingTooltip onClose={mockOnClose} />)

      // Wait for tour to appear
      vi.advanceTimersByTime(100)
      await waitFor(() => {
        expect(screen.getByText('Welcome to your Control Bar!')).toBeInTheDocument()
      })

      // Click next button
      const nextButton = screen.getByRole('button', { name: /arrow-right/i })
      await user.click(nextButton)

      // Should show second step
      await waitFor(() => {
        expect(screen.getByText('Updates Center')).toBeInTheDocument()
        expect(screen.getByText('2/6')).toBeInTheDocument()
      })
    })

    it('navigates back to previous step when back button is clicked', async () => {
      const user = userEvent.setup()
      render(<OnboardingTooltip onClose={mockOnClose} />)

      // Wait for tour to appear
      vi.advanceTimersByTime(100)
      await waitFor(() => {
        expect(screen.getByText('Welcome to your Control Bar!')).toBeInTheDocument()
      })

      // Go to second step
      const nextButton = screen.getByRole('button', { name: /arrow-right/i })
      await user.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText('Updates Center')).toBeInTheDocument()
      })

      // Go back to first step
      const backButton = screen.getByRole('button', { name: /arrow-left/i })
      await user.click(backButton)

      await waitFor(() => {
        expect(screen.getByText('Control Bar')).toBeInTheDocument()
        expect(screen.getByText('1/6')).toBeInTheDocument()
      })
    })

    it('closes tour when completing all steps', async () => {
      const user = userEvent.setup()
      render(<OnboardingTooltip onClose={mockOnClose} />)

      // Wait for tour to appear
      vi.advanceTimersByTime(100)
      await waitFor(() => {
        expect(screen.getByText('Welcome to your Control Bar!')).toBeInTheDocument()
      })

      // Navigate through all 6 steps
      for (let i = 1; i <= 6; i++) {
        const nextButton = screen.getByRole('button', { name: /arrow-right/i })
        await user.click(nextButton)

        if (i < 6) {
          await waitFor(() => {
            expect(screen.getByText(`${i + 1}/6`)).toBeInTheDocument()
          })
        }
      }

      // After 6th step, tour should close
      await waitFor(() => {
        expect(screen.queryByText('Welcome to your Control Bar!')).not.toBeInTheDocument()
      })

      // onClose should have been called once (on completion)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('shows back button only from second step onwards', async () => {
      const user = userEvent.setup()
      render(<OnboardingTooltip onClose={mockOnClose} />)

      // Wait for tour to appear
      vi.advanceTimersByTime(100)
      await waitFor(() => {
        expect(screen.getByText('Welcome to your Control Bar!')).toBeInTheDocument()
      })

      // Back button should not be present on first step
      expect(screen.queryByRole('button', { name: /arrow-left/i })).not.toBeInTheDocument()

      // Go to second step
      const nextButton = screen.getByRole('button', { name: /arrow-right/i })
      await user.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText('Updates Center')).toBeInTheDocument()
      })

      // Back button should now be present
      expect(screen.getByRole('button', { name: /arrow-left/i })).toBeInTheDocument()
    })
  })

  describe('Tour Interaction', () => {
    it('closes tour when clicking outside (on overlay)', async () => {
      const user = userEvent.setup()
      render(<OnboardingTooltip onClose={mockOnClose} />)

      // Wait for tour to appear
      vi.advanceTimersByTime(100)
      await waitFor(() => {
        expect(screen.getByText('Welcome to your Control Bar!')).toBeInTheDocument()
      })

      // Click on the overlay (outside the tooltip content)
      const overlay = screen.getByTestId ? screen.getByTestId('onboarding-overlay') : document.querySelector('.fixed.inset-0')
      if (overlay) {
        await user.click(overlay)
      }

      // Tour should close with animation delay
      vi.advanceTimersByTime(300)
      await waitFor(() => {
        expect(screen.queryByText('Welcome to your Control Bar!')).not.toBeInTheDocument()
      })

      // onClose should have been called once
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('prevents event propagation when clicking on tooltip content', async () => {
      const user = userEvent.setup()
      render(<OnboardingTooltip onClose={mockOnClose} />)

      // Wait for tour to appear
      vi.advanceTimersByTime(100)
      await waitFor(() => {
        expect(screen.getByText('Welcome to your Control Bar!')).toBeInTheDocument()
      })

      // Click on tooltip content - should not close
      const tooltipContent = screen.getByText('Control Bar')
      await user.click(tooltipContent)

      // Tour should still be visible
      expect(screen.getByText('Welcome to your Control Bar!')).toBeInTheDocument()

      // onClose should only have been called once (on mount)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Tour Steps Content', () => {
    it('displays correct content for each step', async () => {
      const user = userEvent.setup()
      render(<OnboardingTooltip onClose={mockOnClose} />)

      // Wait for tour to appear
      vi.advanceTimersByTime(100)
      await waitFor(() => {
        expect(screen.getByText('Welcome to your Control Bar!')).toBeInTheDocument()
      })

      // Step 1: Control Bar
      expect(screen.getByText('Control Bar')).toBeInTheDocument()
      expect(screen.getByText('Welcome to your Control Bar! This is your command deck where you\'ll find your department, notifications, messages, time, and profile all in one place.')).toBeInTheDocument()

      // Navigate to step 2
      await user.click(screen.getByRole('button', { name: /arrow-right/i }))
      await waitFor(() => {
        expect(screen.getByText('Updates Center')).toBeInTheDocument()
      })

      // Step 2: Updates Center
      expect(screen.getByText('This is your Updates Center. This is where all the important updates come together. Whenever something needs your attention, you\'ll see it pop up here, so you\'re always in the loop')).toBeInTheDocument()

      // Navigate to step 3
      await user.click(screen.getByRole('button', { name: /arrow-right/i }))
      await waitFor(() => {
        expect(screen.getByText('To Go Hub')).toBeInTheDocument()
      })

      // Step 3: To Go Hub
      expect(screen.getByText('The To-Go Box is your go-to spot for keeping track of what\'s happening and what\'s ahead. It\'s where you\'ll always find the essentials to stay on top of things.')).toBeInTheDocument()
    })
  })
})