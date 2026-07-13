import mongoose from 'mongoose';

const officeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String, // BO, SO, HO
      trim: true,
    },
    delivery: {
      type: String, // 'Delivery' | 'Non Delivery'
      trim: true,
    },
  },
  { _id: false }
);

const pincodeMasterSchema = new mongoose.Schema(
  {
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      unique: true,
      trim: true,
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
    },
    // Populated only when source data disagrees on district across offices
    // sharing this pincode (common in states with recently split districts,
    // e.g. Telangana) — `district` above holds the most frequent value.
    alternateDistricts: {
      type: [String],
      default: [],
    },
    statename: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    // Populated when source data disagrees on state across offices sharing
    // this pincode — mostly pincodes near the Telangana/Andhra Pradesh border,
    // a known lag in India Post's data since the 2014 state split.
    alternateStates: {
      type: [String],
      default: [],
    },
    circlename: {
      type: String,
      trim: true,
    },
    offices: {
      type: [officeSchema],
      default: [],
    },
  },
  { timestamps: true }
);

pincodeMasterSchema.index({ statename: 1, district: 1 });

export default mongoose.model('PincodeMaster', pincodeMasterSchema);