import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const calculatorSchema = new mongoose.Schema(
  {
    calculatorType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CalculatorType',
      required: [true, 'Calculator type is required'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'], // "sip-calculator" or "axis-bank-sip-calculator"
      unique: true,
      lowercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'], // "Axis Bank SIP Calculator"
      trim: true,
    },
    metaTitle: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String,
      trim: true,
    },
    isBankVariant: {
      type: Boolean,
      default: false, // false = base type page (sip-calculator), true = bank page
    },
    bankName: {
      type: String, // "Axis Bank" — only set when isBankVariant is true
      trim: true,
    },
    logo: {
      type: String, // R2 URL, only for bank variants
    },
    defaults: {
      amount: { type: Number, required: true },
      rate: { type: Number, required: true },
      minRate: { type: Number },
      maxRate: { type: Number },
      years: { type: Number, required: true },
      minYears: { type: Number, default: 1 },
      maxYears: { type: Number, default: 30 },
    },
    blurb: {
      type: String, // 1-2 sentence bank-specific line shown near the widget
      trim: true,
    },
    articleContent: {
      type: mongoose.Schema.Types.Mixed, // TipTap JSON, same as Blog.content
    },
    faqs: [faqSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false, // surfaces in nav dropdown / "Popular Calculators" sidebar
    },
  },
  { timestamps: true }
);

calculatorSchema.index({ calculatorType: 1, isBankVariant: 1 });

export default mongoose.model('Calculator', calculatorSchema);