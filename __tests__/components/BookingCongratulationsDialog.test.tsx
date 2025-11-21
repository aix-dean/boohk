import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { BookingCongratulationsDialog } from '../../components/BookingCongratulationsDialog'; // Relative path

// Mock dependencies
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: any }) => <img src={src} alt={alt} {...props} />,
}));

vi.mock('react-barcode', () => ({
  default: ({ value, ...props }: { value: string; [key: string]: any }) => <div data-testid="barcode" data-value={value} {...props}>Mock Barcode: {value}</div>,
}));

// Mock formatBookingDates if needed
vi.mock('../../lib/booking-service', () => ({
  formatBookingDates: vi.fn(() => 'Mock Dates'),
}));

describe('BookingCongratulationsDialog', () => {
  const mockBooking = {
    id: '123',
    reservation_id: 'RES-001',
    start_date: new Date('2023-01-01'),
    end_date: new Date('2023-01-02'),
    client: { name: 'Test Client', company_name: 'Test Company' },
    total_cost: 1000,
    product_name: 'Test Product',
    url: 'https://example.com/image.jpg',
    type: 'image',
    airing_code: 'AIR-001',
  };

  const mockOnOpenChange = vi.fn();

  it('renders without crashing when open', () => {
    render(<BookingCongratulationsDialog open={true} onOpenChange={mockOnOpenChange} booking={mockBooking} />);
    expect(screen.getByRole('heading', { name: 'Congratulations!' })).toBeInTheDocument();
  });

  it('displays the ticket code in the header', () => {
    render(<BookingCongratulationsDialog open={true} onOpenChange={mockOnOpenChange} booking={mockBooking} />);
    expect(screen.getByText(mockBooking.airing_code, { selector: '.ml-auto' })).toBeInTheDocument();
  });

  it('renders the barcode with the correct value', () => {
    render(<BookingCongratulationsDialog open={true} onOpenChange={mockOnOpenChange} booking={mockBooking} />);
    const barcode = screen.getByTestId('barcode');
    expect(barcode).toHaveAttribute('data-value', mockBooking.airing_code);
  });

  it('displays media preview image when URL is provided', () => {
    render(<BookingCongratulationsDialog open={true} onOpenChange={mockOnOpenChange} booking={mockBooking} />);
    expect(screen.getByAltText('Content preview')).toHaveAttribute('src', mockBooking.url);
  });

  it('calls onOpenChange when close button is clicked', () => {
    render(<BookingCongratulationsDialog open={true} onOpenChange={mockOnOpenChange} booking={mockBooking} />);
    fireEvent.click(screen.getByText('+')); // The close button
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange when OK button is clicked', () => {
    render(<BookingCongratulationsDialog open={true} onOpenChange={mockOnOpenChange} booking={mockBooking} />);
    fireEvent.click(screen.getByText('OK'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('uses fallback ticket code if airing_code is missing', () => {
    const bookingWithoutCode = { ...mockBooking, airing_code: undefined };
    render(<BookingCongratulationsDialog open={true} onOpenChange={mockOnOpenChange} booking={bookingWithoutCode} />);
    const barcode = screen.getByTestId('barcode');
    expect(barcode.getAttribute('data-value')).toMatch(/^BH\d+$/);
  });
});