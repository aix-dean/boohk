import * as XLSX from 'xlsx';
import { Booking } from 'oh-db-models';

export async function exportTransactionsToExcel(
  transactions: Booking[],
  companyName?: string
) {
  // Transform transactions data for Excel export
  const excelData = transactions.map((transaction) => {
    const formatDate = (date: Date | any) => {
      if (!date) return 'N/A';
      const d = date instanceof Date ? date : new Date(date.seconds * 1000);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const formatCurrency = (amount: number, currency: string = 'PHP') => {
      return `${currency === 'IDR' ? 'Rp' : '₱'}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getMillis = (date: Date | any): number => {
      if (!date) return 0

      if (date instanceof Date) {
        return date.getTime()
      } else if (typeof date === 'number') {
        // Assume it's already milliseconds
        return date
      } else if (date && typeof date === 'object' && date.seconds) {
        // Handle Firestore timestamp
        return date.seconds * 1000
      } else if (date && typeof date === 'object' && date.toMillis) {
        // Handle Firestore timestamp with toMillis
        return date.toMillis()
      } else {
        // Try to parse as string or other format
        const d = new Date(date)
        return isNaN(d.getTime()) ? 0 : d.getTime()
      }
    }

    return {
      'Date': formatDate(transaction.created),
      'Site': transaction.items?.name || 'Unknown',
      'Airing Ticket': transaction.airing_code || '-',
      'Total Days': transaction.start_date && transaction.end_date ? Math.ceil((getMillis(transaction.end_date) - getMillis(transaction.start_date)) / (1000 * 60 * 60 * 24)) : transaction.costDetails?.days || 1,
      'Gross Amount': formatCurrency(transaction.transaction?.amount || 0, 'PHP'),
      'Fees': formatCurrency(transaction.transaction?.fees?.totalFee || 0, 'PHP'),
      'Tax (12%)': formatCurrency(transaction.tax?.taxAmount || 0, 'PHP'),
      'Discount': formatCurrency(transaction.discount?.discountTotal || 0, 'PHP'),
      'Payout Amount': formatCurrency((transaction.transaction?.amount || 0) - ((transaction.tax?.taxAmount || 0) + (transaction.transaction?.fees?.totalFee || 0) + (transaction.discount?.discountTotal || 0)), 'PHP'),
      'Status': transaction.status || 'Unknown'
    };
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for better readability
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 20 }, // Site
    { wch: 15 }, // Airing Ticket
    { wch: 10 }, // Total Days
    { wch: 15 }, // Gross Amount
    { wch: 12 }, // Fees
    { wch: 12 }, // Tax (12%)
    { wch: 12 }, // Discount
    { wch: 15 }, // Payout Amount
    { wch: 12 }  // Status
  ];
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  // Generate filename with current date
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const filename = `transactions-${currentDate}.xlsx`;

  // Write file and trigger download
  XLSX.writeFile(wb, filename);
}