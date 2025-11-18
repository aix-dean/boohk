import * as XLSX from 'xlsx';
import { Transaction } from 'oh-db-models';

export async function exportTransactionsToExcel(
  transactions: Transaction[],
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
      return `${currency === 'IDR' ? 'Rp' : '₱'}${amount.toLocaleString()}`;
    };

    return {
      'Date': formatDate(transaction.createdAt),
      'Site': transaction.client?.name || transaction.merchantName || 'Unknown',
      'Site Name': transaction.id?.slice(-6) || 'N/A',
      'Booking ID': `BK${transaction.id?.slice(-4) || '0000'}`,
      'Total Days': transaction.items?.length || 1,
      'Gross Amount': formatCurrency(transaction.amount || 0, transaction.currency),
      'Fees': formatCurrency(transaction.fees?.platformFee || 0, transaction.currency),
      'Tax (12%)': formatCurrency((transaction.amount || 0) * 0.12, transaction.currency),
      'Discount': '₱0',
      'Payout Amount': formatCurrency(transaction.fees?.netAmount || (transaction.amount || 0), transaction.currency),
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
    { wch: 15 }, // Site Name
    { wch: 12 }, // Booking ID
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