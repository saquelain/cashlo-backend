import mongoose from 'mongoose';

const calculatorTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'], // e.g. "SIP Calculator"
      trim: true,
    },
    key: {
      type: String,
      required: [true, 'Key is required'], // "sip" | "emi" | "swp" | "fd" | "rd"
      enum: ['emi', 'sip', 'swp', 'fd', 'rd'],
      unique: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'], // "sip-calculator"
      unique: true,
      lowercase: true,
      trim: true,
    },
    icon: {
      type: String, // lucide icon name, e.g. "TrendingUp"
      default: '',
    },
    shortDescription: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0, // controls display order on /calculators hub and nav
    },
  },
  { timestamps: true }
);

export default mongoose.model('CalculatorType', calculatorTypeSchema);