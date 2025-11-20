# Transaction Collection Seed Script (Client-side)

This script populates the Firestore `transactions` collection with sample data for testing and development purposes using the regular Firebase client SDK.

## Prerequisites

1. **Firebase Configuration**: Ensure your Firebase client SDK is properly configured in `lib/firebase.js`
2. **Authentication**: You need to be authenticated with Firebase (user logged in) to run the seed script

## Sample Data

The seed script creates 3 sample transactions:

1. **Transaction 001** (`txn_001`)
   - Client: Juan Dela Cruz (Individual)
   - Amount: ₱1,500.00
   - Status: COMPLETED
   - Payment Method: GCash
   - Service: LED Billboard Rental

2. **Transaction 002** (`txn_002`)
   - Client: ABC Corporation (Business)
   - Amount: ₱2,250.00
   - Status: COMPLETED
   - Payment Method: Bank Transfer (BDO)
   - Service: Digital Billboard Package

3. **Transaction 003** (`txn_003`)
   - Client: Maria Garcia (Individual)
   - Amount: ₱750.00
   - Status: PENDING
   - Payment Method: PayMaya
   - Service: Content Update Service

## Usage

### Method 1: Browser Console (Recommended)

1. Start your Next.js development server: `npm run dev`
2. Navigate to your application in the browser
3. Open browser developer tools (F12)
4. Go to the Console tab
5. Run the seeding function:

```javascript
// Import and run the seed function
import('./scripts/seed-transactions-client.js').then(module => {
  module.seedTransactions();
});
```

Or if the script is loaded globally:

```javascript
seedTransactions();
```

### Method 2: Programmatic Import

You can also import and use the function in your application code:

```javascript
import { seedTransactions } from './scripts/seed-transactions-client.js';

// In an async function
await seedTransactions();
```

### Expected Output:
```
🚀 Starting transaction seeding...
✅ Added transaction: txn_001
✅ Added transaction: txn_002
✅ Added transaction: txn_003

📊 Seeding Summary:
✅ Successfully added: 3 transactions
🎉 Transaction seeding completed!
```

## Data Structure

Each transaction document follows the `Transaction` interface from `oh-db-models` and includes:

- **Basic Info**: ID, timestamps, amount, currency, description
- **Payment Details**: Xendit integration data, payment method, status
- **Client Information**: Contact details, business info, billing address
- **Items**: Transaction line items with pricing and metadata
- **Fees**: Platform fees, payment processor fees, net amounts
- **Status History**: Complete audit trail of status changes
- **Company Data**: Branch, department, sales person information
- **Metadata**: Source tracking, UTM parameters, custom fields

## Viewing the Data

After seeding, you can view the transactions in:

1. **Firebase Console**: Go to Firestore Database → transactions collection
2. **Application**: Navigate to `/accounting/transactions` to see the data displayed in the table

## Customization

To add more sample transactions:

1. Add new objects to the `sampleTransactions` array in `seed-transactions-client.js`
2. Ensure each transaction has a unique `id`
3. Follow the `Transaction` interface structure from `oh-db-models`
4. Update company IDs to match your test data

## Cleanup

To remove seeded data:

```javascript
// In Firebase Console or via client code
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';

const transactionsRef = collection(db, 'transactions');
const q = query(transactionsRef, where('id', 'in', ['txn_001', 'txn_002', 'txn_003']));
const snapshot = await getDocs(q);

const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
await Promise.all(deletePromises);
```

## Notes

- All monetary amounts are stored in cents (e.g., ₱1,500.00 = 150000)
- Timestamps use Firestore `Timestamp` objects
- The script uses individual `addDoc` calls (not batch) for simplicity
- Error handling is included for robust execution
- Requires user authentication to write to Firestore