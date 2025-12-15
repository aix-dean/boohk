/**
 * Mobile Responsiveness Verification Script
 * This script analyzes the transactions page code to verify responsive patterns
 * match the price-listing implementation
 */

const fs = require('fs');
const path = require('path');

// Read the component files
const transactionsPagePath = './components/transactions-page.tsx';
const transactionsTablePath = './components/transactions-table.tsx';
const priceListingPath = './components/PriceListingContent.tsx';

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

function checkResponsivePattern(content, pattern, description) {
  const regex = new RegExp(pattern);
  const found = regex.test(content);
  console.log(`${found ? '✓' : '✗'} ${description}: ${pattern}`);
  return found;
}

function verifyTransactionsPage(content) {
  console.log('\n=== Transactions Page Responsive Patterns ===');
  
  const patterns = [
    {
      pattern: 'h-full pb-4 overflow-hidden flex flex-col',
      description: 'Main container structure matches price-listing'
    },
    {
      pattern: 'hidden sm:inline',
      description: 'Search label hidden on mobile'
    },
    {
      pattern: 'relative w-full sm:w-auto',
      description: 'Search container responsive width'
    },
    {
      pattern: 'w-full sm:w-80',
      description: 'Search input full-width on mobile, fixed on desktop'
    },
    {
      pattern: 'flex-col sm:flex-row',
      description: 'Controls stack vertically on mobile'
    },
    {
      pattern: 'gap-2 sm:gap-4',
      description: 'Controls gap adjusts for mobile/desktop'
    }
  ];

  let allPassed = true;
  patterns.forEach(({ pattern, description }) => {
    const passed = checkResponsivePattern(content, pattern, description);
    if (!passed) allPassed = false;
  });

  return allPassed;
}

function verifyTransactionsTable(content) {
  console.log('\n=== Transactions Table Responsive Patterns ===');
  
  const patterns = [
    {
      pattern: 'overflow-x-auto',
      description: 'Table has horizontal scrolling for mobile'
    },
    {
      pattern: 'min-w-\\[1000px\\]',
      description: 'Table minimum width to force horizontal scroll'
    },
    {
      pattern: 'flex flex-col sm:flex-row',
      description: 'Pagination stacks vertically on mobile'
    },
    {
      pattern: 'hidden sm:inline',
      description: 'Page info hidden on mobile'
    },
    {
      pattern: 'gap-4',
      description: 'Pagination gap for mobile layout'
    }
  ];

  let allPassed = true;
  patterns.forEach(({ pattern, description }) => {
    const passed = checkResponsivePattern(content, pattern, description);
    if (!passed) allPassed = false;
  });

  return allPassed;
}

function compareWithPriceListing(transactionsContent, priceListingContent) {
  console.log('\n=== Comparison with Price Listing Patterns ===');
  
  // Extract key patterns from price listing
  const priceListingPatterns = [
    'h-full pb-4 overflow-hidden flex flex-col',
    'hidden sm:inline',
    'w-full sm:w-80',
    'flex-col sm:flex-row'
  ];

  let allMatched = true;
  priceListingPatterns.forEach(pattern => {
    const inPriceListing = new RegExp(pattern).test(priceListingContent);
    const inTransactions = new RegExp(pattern).test(transactionsContent);
    
    console.log(`${inTransactions && inPriceListing ? '✓' : '✗'} Pattern "${pattern}" ${inTransactions && inPriceListing ? 'matches' : 'does not match'}`);
    
    if (!inTransactions || !inPriceListing) {
      allMatched = false;
    }
  });

  return allMatched;
}

function checkForPotentialIssues(content) {
  console.log('\n=== Potential Issues Check ===');
  
  const issues = [];
  
  // Check for missing responsive patterns
  if (!/flex-col sm:flex-row/.test(content)) {
    issues.push('Missing flex-col sm:flex-row for mobile stacking');
  }
  
  if (!/hidden sm:inline/.test(content)) {
    issues.push('Missing hidden sm:inline for mobile label hiding');
  }
  
  if (!/w-full sm:w-/.test(content)) {
    issues.push('Missing responsive width classes');
  }
  
  // Check for problematic patterns
  if (/w-\d+/.test(content) && !/sm:w-/.test(content)) {
    issues.push('Found fixed width without responsive counterpart');
  }
  
  if (issues.length === 0) {
    console.log('✓ No obvious responsive issues detected');
  } else {
    issues.forEach(issue => console.log(`✗ ${issue}`));
  }
  
  return issues;
}

function main() {
  console.log('🔍 Transactions Page Mobile Responsiveness Verification');
  console.log('==================================================');
  
  const transactionsPageContent = readFile(transactionsPagePath);
  const transactionsTableContent = readFile(transactionsTablePath);
  const priceListingContent = readFile(priceListingPath);
  
  if (!transactionsPageContent || !transactionsTableContent || !priceListingContent) {
    console.error('❌ Failed to read required files');
    return;
  }
  
  const pagePassed = verifyTransactionsPage(transactionsPageContent);
  const tablePassed = verifyTransactionsTable(transactionsTableContent);
  const comparisonPassed = compareWithPriceListing(transactionsPageContent, priceListingContent);
  
  const pageIssues = checkForPotentialIssues(transactionsPageContent);
  const tableIssues = checkForPotentialIssues(transactionsTableContent);
  
  console.log('\n=== Summary ===');
  console.log(`Transactions Page: ${pagePassed ? '✅ All patterns verified' : '❌ Some patterns missing'}`);
  console.log(`Transactions Table: ${tablePassed ? '✅ All patterns verified' : '❌ Some patterns missing'}`);
  console.log(`Pattern Comparison: ${comparisonPassed ? '✅ Matches price-listing' : '❌ Does not match price-listing'}`);
  
  const totalIssues = pageIssues.length + tableIssues.length;
  if (totalIssues === 0 && pagePassed && tablePassed && comparisonPassed) {
    console.log('\n🎉 SUCCESS: All mobile responsiveness patterns are correctly implemented!');
    console.log('✅ The transactions page now has the same level of mobile responsiveness as the price-listing page');
  } else {
    console.log(`\n⚠️  Found ${totalIssues} potential issues that need attention`);
  }
}

// Run the verification
main();