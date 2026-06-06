// src/models/Biodata.js
const mongoose = require('mongoose');

const BiodataSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  biodataId: {
    type: String,
    unique: true,
  },

  // ── Step 1: Personal Info ──
  type: {
    type: String,
    enum: ['পাত্রের বায়োডাটা', 'পাত্রীর বায়োডাটা'],
    required: [true, 'বায়োডাটার ধরন নির্বাচন করুন'],
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true,
  },
  maritalStatus: {
    type: String,
    enum: ['অবিবাহিত', 'ডিভোর্সড', 'বিধবা/বিপত্নীক'],
    required: [true, 'বৈবাহিক অবস্থা নির্বাচন করুন'],
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'জন্ম তারিখ দিন'],
  },
  height: {
    type: String,
    required: [true, 'উচ্চতা নির্বাচন করুন'],
  },
  complexion: {
    type: String,
    enum: ['উজ্জ্বল ফর্সা', 'ফর্সা', 'শ্যামলা', 'কালো'],
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
  },
  permanentDistrict: {
    type: String,
    required: [true, 'স্থায়ী ঠিকানা দিন'],
  },
  permanentAddress: String,
  currentAddress: String,
  nationality: { type: String, default: 'বাংলাদেশী' },

  // ── Step 2: Family Info ──
  fatherName: String,
  fatherOccupation: String,
  motherName: String,
  motherOccupation: String,
  brothers: { type: Number, default: 0 },
  sisters: { type: Number, default: 0 },
  familyEconomicStatus: {
    type: String,
    enum: ['উচ্চবিত্ত', 'উচ্চ-মধ্যবিত্ত', 'মধ্যবিত্ত', 'নিম্ন-মধ্যবিত্ত'],
  },
  familyReligiousEnvironment: {
    type: String,
    enum: ['সম্পূর্ণ দ্বীনি', 'আংশিক দ্বীনি', 'সাধারণ'],
  },
  familyDetails: String,

  // ── Step 3: Education & Career ──
  education: {
    type: String,
    enum: ['এসএসসি', 'এইচএসসি', 'স্নাতক (পাস)', 'স্নাতক (সম্মান)', 'স্নাতকোত্তর', 'পিএইচডি', 'মাদ্রাসা', 'অন্যান্য'],
    required: [true, 'শিক্ষাগত যোগ্যতা নির্বাচন করুন'],
  },
  educationDetails: String,
  occupation: {
    type: String,
    enum: ['চাকরিজীবী (সরকারি)', 'চাকরিজীবী (বেসরকারি)', 'ব্যবসায়ী', 'ডাক্তার', 'ইঞ্জিনিয়ার', 'শিক্ষক', 'আলেম/ইমাম', 'শিক্ষার্থী', 'গৃহিণী', 'প্রবাসী', 'অন্যান্য'],
    required: [true, 'পেশা নির্বাচন করুন'],
  },
  monthlyIncome: {
    type: String,
    enum: ['আয় নেই', '১০,০০০ - ২০,০০০ টাকা', '২০,০০০ - ৩০,০০০ টাকা', '৩০,০০০ - ৫০,০০০ টাকা', '৫০,০০০+ টাকা'],
  },
  // ── Islamic Info ──
  prayerHabit: {
    type: String,
    enum: ['৫ ওয়াক্তই পড়ি', 'মাঝে মাঝে পড়ি', 'পড়ার চেষ্টা করি'],
  },
  islamicLifestyle: {
    type: String,
    enum: ['সম্পূর্ণ ইসলামিক', 'আংশিক ইসলামিক', 'সাধারণ মুসলিম'],
  },
  wearsHijab: Boolean, // for females
  hasBeard: Boolean,   // for males
  mazhabFollowed: {
    type: String,
    enum: ['হানাফি', 'শাফেয়ি', 'মালেকি', 'হাম্বলি', 'অন্যান্য'],
  },
  quranReading: {
    type: String,
    enum: ['শুদ্ধভাবে পড়তে পারি', 'কিছুটা পারি', 'পারি না'],
  },
  aboutSelf: { type: String, maxlength: [1000, 'সর্বোচ্চ ১০০০ অক্ষর লেখা যাবে'] },

  // ── Step 4: Partner Expectations ──
  partnerAgeMin: Number,
  partnerAgeMax: Number,
  partnerEducation: String,
  partnerDistrict: String,
  partnerOccupation: String,
  partnerExpectations: { type: String, maxlength: [1000, 'সর্বোচ্চ ১০০০ অক্ষর'] },

  // ── Guardian Contact ──
  guardianName: String,
  guardianRelation: String,
  guardianPhone: {
    type: String,
    match: [/^(\+880|880|0)[1-9]\d{8,9}$/, 'সঠিক ফোন নম্বর দিন'],
  },

  // ── Media ──
  avatar: {
    public_id: String,
    url: String,
  },
  documents: [{
    type: { type: String, enum: ['nid', 'certificate', 'other'] },
    public_id: String,
    url: String,
    verified: { type: Boolean, default: false },
  }],

  // ── Status & Moderation ──
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'suspended'],
    default: 'pending',
  },
  rejectionReason: String,
  verifiedBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
  verifiedAt: Date,
  isVisible: { type: Boolean, default: false },
  isProfileHidden: { type: Boolean, default: false },

  // ── Engagement Stats ──
  views: { type: Number, default: 0 },
  shortlists: { type: Number, default: 0 },
  requestsSent: { type: Number, default: 0 },
  requestsReceived: { type: Number, default: 0 },

}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// ── Virtuals ──
BiodataSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
});

// ── Pre-save: generate unique Biodata ID ──
BiodataSchema.pre('save', async function (next) {
  if (!this.biodataId) {
    const prefix = this.gender === 'male' ? 'PTR' : 'PTI';
    const count = await mongoose.model('Biodata').countDocuments();
    this.biodataId = `${prefix}-${String(count + 1001).padStart(5, '0')}`;
  }
  next();
});

// ── Indexes ──
BiodataSchema.index({ status: 1, isVisible: 1, gender: 1 });
BiodataSchema.index({ permanentDistrict: 1 });
BiodataSchema.index({ education: 1 });
BiodataSchema.index({ occupation: 1 });
BiodataSchema.index({ maritalStatus: 1 });
BiodataSchema.index({ 'dateOfBirth': 1 });
BiodataSchema.index({ createdAt: -1 });
BiodataSchema.index({ views: -1 });
BiodataSchema.index({ biodataId: 1 });

module.exports = mongoose.model('Biodata', BiodataSchema);
