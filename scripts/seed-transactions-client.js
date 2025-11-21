// Client-side seed script for transactions collection
// Run this in the browser console or as a client-side script

import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Sample transaction data
const sampleTransactions = [
  {
    id: 'txn_001',
    userId: 'user_123',
    companyId: 'company_456',
    createdAt: Timestamp.fromDate(new Date('2024-11-15T10:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2024-11-15T10:00:00Z')),
    amount: 150000, // 1500.00 in cents
    currency: 'PHP',
    description: 'Payment for LED billboard advertising services',
    merchantName: 'OH Media Solutions',
    paymentMethod: {
      type: 'EWALLET',
      channel: 'GCASH',
      channelProperties: {}
    },
    xendit: {
      paymentId: 'xendit_payment_001',
      externalId: 'ext_001',
      status: 'PAID',
      created: Timestamp.fromDate(new Date('2024-11-15T10:00:00Z')),
      updated: Timestamp.fromDate(new Date('2024-11-15T10:05:00Z')),
      paymentMethod: {
        type: 'EWALLET',
        channel_code: 'PH_GCASH',
        channel_properties: {}
      },
      response: {
        initial: {},
        callback: {},
        error: null
      },
      webhookReceived: true,
      webhookTimestamp: Timestamp.fromDate(new Date('2024-11-15T10:05:00Z')),
      checkoutUrl: '',
      qrCode: '',
      virtualAccountNumber: ''
    },
    client: {
      id: 'client_001',
      type: 'individual',
      name: 'Juan Dela Cruz',
      email: 'juan.delacruz@email.com',
      phone: '+639123456789',
      business: {
        name: '',
        taxId: '',
        type: ''
      },
      address: {
        street: '123 Rizal Street',
        city: 'Manila',
        state: 'Metro Manila',
        postalCode: '1000',
        country: 'PH'
      },
      contactPerson: {
        name: '',
        position: '',
        email: '',
        phone: ''
      },
      billingAddress: {
        street: '123 Rizal Street',
        city: 'Manila',
        state: 'Metro Manila',
        postalCode: '1000',
        country: 'PH'
      },
      metadata: {
        customerSince: Timestamp.fromDate(new Date('2024-01-01T00:00:00Z')),
        totalTransactions: 5,
        lifetimeValue: 750000,
        segment: 'premium'
      }
    },
    items: [
      {
        id: 'item_001',
        name: 'LED Billboard Rental - Ayala Mall',
        description: '7-day rental of LED billboard at Ayala Mall location',
        quantity: 1,
        price: 150000,
        total: 150000,
        category: 'advertising',
        metadata: {
          siteCode: 'AYL001',
          duration: 7,
          location: 'Ayala Mall'
        }
      }
    ],
    fees: {
      platformFee: 7500,
      xenditFee: 2250,
      totalFee: 9750,
      netAmount: 140250
    },
    status: 'COMPLETED',
    statusHistory: [
      {
        status: 'PENDING',
        timestamp: Timestamp.fromDate(new Date('2024-11-15T10:00:00Z')),
        reason: 'Payment initiated',
        updatedBy: 'system'
      },
      {
        status: 'COMPLETED',
        timestamp: Timestamp.fromDate(new Date('2024-11-15T10:05:00Z')),
        reason: 'Payment confirmed',
        updatedBy: 'webhook'
      }
    ],
    company: {
      id: 'company_456',
      name: 'OH Media Corp',
      branch: 'Manila Branch',
      department: 'Sales',
      salesPerson: 'Maria Santos'
    },
    metadata: {
      source: 'web',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      device: 'desktop',
      campaign: 'q4_promotion',
      utmParameters: {
        source: 'email',
        medium: 'newsletter',
        campaign: 'black_friday',
        term: '',
        content: 'cta_button'
      },
      customFields: {
        bookingId: 'BK#2024001',
        campaignType: 'brand_awareness'
      }
    }
  },
  {
    id: 'txn_002',
    userId: 'user_124',
    companyId: 'company_456',
    createdAt: Timestamp.fromDate(new Date('2024-11-16T14:30:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2024-11-16T14:30:00Z')),
    amount: 225000,
    currency: 'PHP',
    description: 'Digital billboard campaign payment',
    merchantName: 'OH Media Solutions',
    paymentMethod: {
      type: 'BANK_TRANSFER',
      channel: 'BDO',
      channelProperties: {}
    },
    xendit: {
      paymentId: 'xendit_payment_002',
      externalId: 'ext_002',
      status: 'PAID',
      created: Timestamp.fromDate(new Date('2024-11-16T14:30:00Z')),
      updated: Timestamp.fromDate(new Date('2024-11-16T15:00:00Z')),
      paymentMethod: {
        type: 'BANK_TRANSFER',
        channel_code: 'PH_BDO',
        channel_properties: {}
      },
      response: {
        initial: {},
        callback: {},
        error: null
      },
      webhookReceived: true,
      webhookTimestamp: Timestamp.fromDate(new Date('2024-11-16T15:00:00Z')),
      checkoutUrl: '',
      qrCode: '',
      virtualAccountNumber: '1234567890'
    },
    client: {
      id: 'client_002',
      type: 'business',
      name: 'ABC Corporation',
      email: 'accounting@abc-corp.com',
      phone: '+639876543210',
      business: {
        name: 'ABC Corporation',
        taxId: '123-456-789',
        type: 'corporation'
      },
      address: {
        street: '456 Business Avenue',
        city: 'Makati',
        state: 'Metro Manila',
        postalCode: '1200',
        country: 'PH'
      },
      contactPerson: {
        name: 'Jane Smith',
        position: 'Finance Manager',
        email: 'jane.smith@abc-corp.com',
        phone: '+639876543211'
      },
      billingAddress: {
        street: '456 Business Avenue',
        city: 'Makati',
        state: 'Metro Manila',
        postalCode: '1200',
        country: 'PH'
      },
      metadata: {
        customerSince: Timestamp.fromDate(new Date('2023-06-01T00:00:00Z')),
        totalTransactions: 12,
        lifetimeValue: 2700000,
        segment: 'enterprise'
      }
    },
    items: [
      {
        id: 'item_002',
        name: 'Digital Billboard Package - Multiple Locations',
        description: '10-day campaign across 3 premium locations',
        quantity: 1,
        price: 225000,
        total: 225000,
        category: 'advertising',
        metadata: {
          locations: ['EDSA', ' BGC', 'Podium'],
          duration: 10,
          packageType: 'premium'
        }
      }
    ],
    fees: {
      platformFee: 11250,
      xenditFee: 3375,
      totalFee: 14625,
      netAmount: 210375
    },
    status: 'COMPLETED',
    statusHistory: [
      {
        status: 'PENDING',
        timestamp: Timestamp.fromDate(new Date('2024-11-16T14:30:00Z')),
        reason: 'Payment initiated',
        updatedBy: 'user_124'
      },
      {
        status: 'COMPLETED',
        timestamp: Timestamp.fromDate(new Date('2024-11-16T15:00:00Z')),
        reason: 'Bank transfer confirmed',
        updatedBy: 'webhook'
      }
    ],
    company: {
      id: 'company_456',
      name: 'OH Media Corp',
      branch: 'Makati Branch',
      department: 'Sales',
      salesPerson: 'Pedro Reyes'
    },
    metadata: {
      source: 'web',
      ipAddress: '10.0.0.50',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      device: 'desktop',
      campaign: 'enterprise_q4',
      utmParameters: {
        source: 'linkedin',
        medium: 'social',
        campaign: 'b2b_campaign',
        term: 'digital_billboard',
        content: 'case_study'
      },
      customFields: {
        bookingId: 'BK#2024002',
        contractId: 'CTR#2024001',
        poNumber: 'PO-ABC-001'
      }
    }
  },
  {
    id: 'txn_003',
    userId: 'user_125',
    companyId: 'company_456',
    createdAt: Timestamp.fromDate(new Date('2024-11-17T09:15:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2024-11-17T09:15:00Z')),
    amount: 75000,
    currency: 'PHP',
    description: 'LED billboard maintenance and content update',
    merchantName: 'OH Media Solutions',
    paymentMethod: {
      type: 'EWALLET',
      channel: 'PAYMAYA',
      channelProperties: {}
    },
    xendit: {
      paymentId: 'xendit_payment_003',
      externalId: 'ext_003',
      status: 'PENDING',
      created: Timestamp.fromDate(new Date('2024-11-17T09:15:00Z')),
      updated: Timestamp.fromDate(new Date('2024-11-17T09:15:00Z')),
      paymentMethod: {
        type: 'EWALLET',
        channel_code: 'PH_PAYMAYA',
        channel_properties: {}
      },
      response: {
        initial: {},
        callback: {},
        error: null
      },
      webhookReceived: false,
      webhookTimestamp: null,
      checkoutUrl: 'https://checkout.xendit.co/...',
      qrCode: '',
      virtualAccountNumber: ''
    },
    client: {
      id: 'client_003',
      type: 'individual',
      name: 'Maria Garcia',
      email: 'maria.garcia@email.com',
      phone: '+639112233445',
      business: {
        name: '',
        taxId: '',
        type: ''
      },
      address: {
        street: '789 Residential St',
        city: 'Quezon City',
        state: 'Metro Manila',
        postalCode: '1100',
        country: 'PH'
      },
      contactPerson: {
        name: '',
        position: '',
        email: '',
        phone: ''
      },
      billingAddress: {
        street: '789 Residential St',
        city: 'Quezon City',
        state: 'Metro Manila',
        postalCode: '1100',
        country: 'PH'
      },
      metadata: {
        customerSince: Timestamp.fromDate(new Date('2024-08-01T00:00:00Z')),
        totalTransactions: 2,
        lifetimeValue: 150000,
        segment: 'new'
      }
    },
    items: [
      {
        id: 'item_003',
        name: 'Content Update Service',
        description: 'LED billboard content update and maintenance service',
        quantity: 1,
        price: 75000,
        total: 75000,
        category: 'service',
        metadata: {
          serviceType: 'content_update',
          priority: 'standard'
        }
      }
    ],
    fees: {
      platformFee: 3750,
      xenditFee: 1125,
      totalFee: 4875,
      netAmount: 70125
    },
    status: 'PENDING',
    statusHistory: [
      {
        status: 'PENDING',
        timestamp: Timestamp.fromDate(new Date('2024-11-17T09:15:00Z')),
        reason: 'Payment initiated via PayMaya',
        updatedBy: 'user_125'
      }
    ],
    company: {
      id: 'company_456',
      name: 'OH Media Corp',
      branch: 'Quezon City Branch',
      department: 'Operations',
      salesPerson: 'Ana Lopez'
    },
    metadata: {
      source: 'mobile_app',
      ipAddress: '172.16.0.25',
      userAgent: 'OH Media App/1.2.3 (iOS 17.0; iPhone)',
      device: 'mobile',
      campaign: '',
      utmParameters: {
        source: '',
        medium: '',
        campaign: '',
        term: '',
        content: ''
      },
      customFields: {
        bookingId: 'BK#2024003',
        serviceRequestId: 'SR#2024001'
      }
    }
  }
];

export async function seedTransactions() {
  console.log('🚀 Starting transaction seeding...');

  try {
    const transactionsRef = collection(db, 'transactions');
    let successCount = 0;
    let errorCount = 0;

    for (const transaction of sampleTransactions) {
      try {
        await addDoc(transactionsRef, transaction);
        console.log(`✅ Added transaction: ${transaction.id}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to add transaction ${transaction.id}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Seeding Summary:`);
    console.log(`✅ Successfully added: ${successCount} transactions`);
    if (errorCount > 0) {
      console.log(`❌ Failed to add: ${errorCount} transactions`);
    }
    console.log(`🎉 Transaction seeding completed!`);

    return { successCount, errorCount };

  } catch (error) {
    console.error('💥 Error during seeding process:', error);
    throw error;
  }
}

// For browser console usage
if (typeof window !== 'undefined') {
  window.seedTransactions = seedTransactions;
  console.log('💡 Transaction seeding function available as: seedTransactions()');
  console.log('💡 Run: seedTransactions() to seed the database');
}