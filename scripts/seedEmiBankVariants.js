import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../src/config/database.js';
import CalculatorType from '../src/models/CalculatorType.js';
import Calculator from '../src/models/Calculator.js';

const genericFaqs = [
  {
    question: 'What sort of loans can I use the EMI calculator for?',
    answer: 'Personal loans, home loans, car loans, and education loans — just adjust the amount, rate, and tenure to match your loan type.',
  },
  {
    question: 'How does the debt-to-income ratio affect my chances of getting a loan?',
    answer: 'Lenders generally prefer your total EMI obligations to stay below 40-50% of your monthly income. A lower ratio improves your approval chances and may get you a better rate.',
  },
  {
    question: 'What does an EMI consist of?',
    answer: 'Each EMI payment includes two components: a portion that goes toward repaying the principal amount borrowed, and a portion that covers the interest charged by the lender.',
  },
  {
    question: 'What happens if I fail to pay my EMIs?',
    answer: 'Missed EMIs attract late payment fees and can negatively impact your credit score. Contact your lender immediately if you anticipate missing a payment to discuss options.',
  },
];

const banks = [
  {
    slug: 'sbi-emi-calculator',
    bankName: 'SBI',
    title: 'SBI EMI Calculator',
    metaTitle: 'SBI EMI Calculator - Calculate SBI Loan EMI Online | Cashlo',
    metaDescription: "Use Cashlo's free SBI EMI calculator to estimate your monthly State Bank of India loan installment instantly.",
    blurb: 'SBI offers personal loans starting at 10.9% p.a. for salaried applicants, with tenures up to 6 years.',
    defaults: { amount: 500000, rate: 10.9, minRate: 10.9, maxRate: 15.5, years: 5, minYears: 1, maxYears: 6 },
  },
  {
    slug: 'icici-bank-emi-calculator',
    bankName: 'ICICI Bank',
    title: 'ICICI Bank EMI Calculator',
    metaTitle: 'ICICI Bank EMI Calculator - Calculate Loan EMI Online | Cashlo',
    metaDescription: "Use Cashlo's free ICICI Bank EMI calculator to estimate your monthly loan installment instantly.",
    blurb: 'ICICI Bank personal loans start at 10.75% p.a. with quick disbursal for eligible applicants.',
    defaults: { amount: 500000, rate: 10.75, minRate: 10.75, maxRate: 19, years: 5, minYears: 1, maxYears: 6 },
  },
  {
    slug: 'axis-bank-emi-calculator',
    bankName: 'Axis Bank',
    title: 'Axis Bank EMI Calculator',
    metaTitle: 'Axis Bank EMI Calculator - Calculate Loan EMI Online | Cashlo',
    metaDescription: "Use Cashlo's free Axis Bank EMI calculator to estimate your monthly loan installment instantly.",
    blurb: 'Axis Bank offers personal loans from 10.99% p.a. with flexible repayment tenures.',
    defaults: { amount: 500000, rate: 10.99, minRate: 10.99, maxRate: 21, years: 5, minYears: 1, maxYears: 6 },
  },
  {
    slug: 'kotak-mahindra-bank-emi-calculator',
    bankName: 'Kotak Mahindra Bank',
    title: 'Kotak Mahindra Bank EMI Calculator',
    metaTitle: 'Kotak Mahindra Bank EMI Calculator | Cashlo',
    metaDescription: "Use Cashlo's free Kotak Mahindra Bank EMI calculator to estimate your monthly loan installment instantly.",
    blurb: 'Kotak Mahindra Bank personal loans start at 10.99% p.a. with tenures up to 6 years.',
    defaults: { amount: 500000, rate: 10.99, minRate: 10.99, maxRate: 24, years: 5, minYears: 1, maxYears: 6 },
  },
  {
    slug: 'bank-of-baroda-emi-calculator',
    bankName: 'Bank of Baroda',
    title: 'Bank of Baroda EMI Calculator',
    metaTitle: 'Bank of Baroda EMI Calculator | Cashlo',
    metaDescription: "Use Cashlo's free Bank of Baroda EMI calculator to estimate your monthly loan installment instantly.",
    blurb: 'Bank of Baroda offers personal loans starting at 11.15% p.a. for eligible salaried and self-employed applicants.',
    defaults: { amount: 500000, rate: 11.15, minRate: 11.15, maxRate: 18.4, years: 5, minYears: 1, maxYears: 7 },
  },
  {
    slug: 'punjab-national-bank-emi-calculator',
    bankName: 'Punjab National Bank',
    title: 'Punjab National Bank EMI Calculator',
    metaTitle: 'PNB EMI Calculator - Calculate Loan EMI Online | Cashlo',
    metaDescription: "Use Cashlo's free PNB EMI calculator to estimate your monthly loan installment instantly.",
    blurb: 'Punjab National Bank personal loans start at 11.25% p.a. with tenures up to 5 years.',
    defaults: { amount: 500000, rate: 11.25, minRate: 11.25, maxRate: 16.85, years: 5, minYears: 1, maxYears: 5 },
  },
  {
    slug: 'canara-bank-emi-calculator',
    bankName: 'Canara Bank',
    title: 'Canara Bank EMI Calculator',
    metaTitle: 'Canara Bank EMI Calculator | Cashlo',
    metaDescription: "Use Cashlo's free Canara Bank EMI calculator to estimate your monthly loan installment instantly.",
    blurb: 'Canara Bank offers personal loans starting at 11.1% p.a. with flexible repayment options.',
    defaults: { amount: 500000, rate: 11.1, minRate: 11.1, maxRate: 16, years: 5, minYears: 1, maxYears: 5 },
  },
  {
    slug: 'indusind-bank-emi-calculator',
    bankName: 'IndusInd Bank',
    title: 'IndusInd Bank EMI Calculator',
    metaTitle: 'IndusInd Bank EMI Calculator | Cashlo',
    metaDescription: "Use Cashlo's free IndusInd Bank EMI calculator to estimate your monthly loan installment instantly.",
    blurb: 'IndusInd Bank personal loans start at 10.5% p.a. with quick approval for eligible applicants.',
    defaults: { amount: 500000, rate: 10.5, minRate: 10.5, maxRate: 26, years: 5, minYears: 1, maxYears: 5 },
  },
  {
    slug: 'tata-capital-emi-calculator',
    bankName: 'Tata Capital',
    title: 'Tata Capital EMI Calculator',
    metaTitle: 'Tata Capital EMI Calculator | Cashlo',
    metaDescription: "Use Cashlo's free Tata Capital EMI calculator to estimate your monthly loan installment instantly.",
    blurb: 'Tata Capital offers personal loans starting at 10.99% p.a. with minimal documentation.',
    defaults: { amount: 500000, rate: 10.99, minRate: 10.99, maxRate: 19, years: 5, minYears: 1, maxYears: 6 },
  },
];

const run = async () => {
  await connectDB();

  const emiType = await CalculatorType.findOne({ key: 'emi' });
  if (!emiType) {
    console.error('❌ EMI CalculatorType not found — seed the base types first.');
    process.exit(1);
  }

  for (const bank of banks) {
    const doc = await Calculator.findOneAndUpdate(
      { slug: bank.slug },
      {
        calculatorType: emiType._id,
        slug: bank.slug,
        title: bank.title,
        metaTitle: bank.metaTitle,
        metaDescription: bank.metaDescription,
        isBankVariant: true,
        bankName: bank.bankName,
        defaults: bank.defaults,
        blurb: bank.blurb,
        articleContent: '', // left empty deliberately, fill in later per bank
        faqs: genericFaqs,
        isActive: true,
        isFeatured: true,
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ ${doc.bankName} EMI Calculator ready — /${doc.slug}`);
  }

  console.log('\n🎉 All bank variants seeded.');
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});