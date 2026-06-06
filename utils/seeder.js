// src/utils/seeder.js
require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Biodata = require('../models/Biodata');
const logger = require('./logger');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nikah_db';

const sampleUsers = [
  {
    phone: '01711000001',
    email: 'admin@nikah.com',
    password: 'Admin@123456',
    role: 'admin',
    isVerified: true,
    isPhoneVerified: true,
    plan: 'gold',
  },
  {
    phone: '01711000002',
    email: 'mod@nikah.com',
    password: 'Mod@123456',
    role: 'moderator',
    isVerified: true,
    isPhoneVerified: true,
  },
  {
    phone: '01711000003',
    email: 'user1@nikah.com',
    password: 'User@123456',
    role: 'user',
    isVerified: true,
    isPhoneVerified: true,
    plan: 'premium',
    planExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
];

const sampleBiodatas = [
  {
    type: 'পাত্রের বায়োডাটা',
    gender: 'male',
    maritalStatus: 'অবিবাহিত',
    dateOfBirth: new Date('1996-05-15'),
    height: "5'8\"",
    complexion: 'শ্যামলা',
    bloodGroup: 'O+',
    permanentDistrict: 'ঢাকা',
    currentAddress: 'মিরপুর, ঢাকা',
    fatherName: 'মোহাম্মদ আলী',
    motherName: 'ফাতেমা বেগম',
    brothers: 2,
    sisters: 1,
    familyEconomicStatus: 'মধ্যবিত্ত',
    familyReligiousEnvironment: 'সম্পূর্ণ দ্বীনি',
    education: 'স্নাতক (সম্মান)',
    occupation: 'চাকরিজীবী (সরকারি)',
    monthlyIncome: '৩০,০০০ - ৫০,০০০ টাকা',
    prayerHabit: '৫ ওয়াক্তই পড়ি',
    islamicLifestyle: 'সম্পূর্ণ ইসলামিক',
    hasBeard: true,
    mazhabFollowed: 'হানাফি',
    quranReading: 'শুদ্ধভাবে পড়তে পারি',
    aboutSelf: 'আমি একজন দ্বীনদার মুসলিম। আল্লাহর ভয়ে জীবন পরিচালনা করার চেষ্টা করি।',
    partnerAgeMin: 22,
    partnerAgeMax: 28,
    partnerEducation: 'কমপক্ষে স্নাতক',
    partnerExpectations: 'দ্বীনদার, পর্দানশীন পাত্রী চাই।',
    guardianName: 'মোহাম্মদ আলী',
    guardianRelation: 'পিতা',
    guardianPhone: '01711000010',
    status: 'approved',
    isVisible: true,
    views: 145,
    shortlists: 12,
  },
  {
    type: 'পাত্রীর বায়োডাটা',
    gender: 'female',
    maritalStatus: 'অবিবাহিত',
    dateOfBirth: new Date('1999-08-22'),
    height: "5'3\"",
    complexion: 'ফর্সা',
    bloodGroup: 'A+',
    permanentDistrict: 'চট্টগ্রাম',
    currentAddress: 'চট্টগ্রাম সিটি',
    fatherName: 'আবুল হাসান',
    motherName: 'রাশিদা বেগম',
    brothers: 1,
    sisters: 2,
    familyEconomicStatus: 'উচ্চ-মধ্যবিত্ত',
    familyReligiousEnvironment: 'সম্পূর্ণ দ্বীনি',
    education: 'স্নাতকোত্তর',
    occupation: 'শিক্ষক',
    monthlyIncome: '২০,০০০ - ৩০,০০০ টাকা',
    prayerHabit: '৫ ওয়াক্তই পড়ি',
    islamicLifestyle: 'সম্পূর্ণ ইসলামিক',
    wearsHijab: true,
    quranReading: 'শুদ্ধভাবে পড়তে পারি',
    aboutSelf: 'আমি দ্বীনদার পরিবারে বড় হয়েছি। ইসলামিক জীবনযাপনে বিশ্বাসী।',
    partnerAgeMin: 26,
    partnerAgeMax: 33,
    partnerExpectations: 'দ্বীনদার, সৎ ও পরিশ্রমী পাত্র চাই।',
    guardianName: 'আবুল হাসান',
    guardianRelation: 'পিতা',
    guardianPhone: '01811000020',
    status: 'approved',
    isVisible: true,
    views: 220,
    shortlists: 28,
  },
  {
    type: 'পাত্রের বায়োডাটা',
    gender: 'male',
    maritalStatus: 'অবিবাহিত',
    dateOfBirth: new Date('1994-03-10'),
    height: "5'10\"",
    complexion: 'উজ্জ্বল ফর্সা',
    bloodGroup: 'B+',
    permanentDistrict: 'সিলেট',
    currentAddress: 'সিলেট শহর',
    fatherName: 'হাফিজুর রহমান',
    motherName: 'নুরজাহান বেগম',
    brothers: 3,
    sisters: 1,
    familyEconomicStatus: 'উচ্চবিত্ত',
    familyReligiousEnvironment: 'আংশিক দ্বীনি',
    education: 'স্নাতকোত্তর',
    occupation: 'ব্যবসায়ী',
    monthlyIncome: '৫০,০০০+ টাকা',
    prayerHabit: '৫ ওয়াক্তই পড়ি',
    islamicLifestyle: 'সম্পূর্ণ ইসলামিক',
    hasBeard: true,
    mazhabFollowed: 'হানাফি',
    quranReading: 'শুদ্ধভাবে পড়তে পারি',
    partnerAgeMin: 20,
    partnerAgeMax: 26,
    partnerExpectations: 'শিক্ষিত, দ্বীনদার পাত্রী চাই।',
    guardianName: 'হাফিজুর রহমান',
    guardianRelation: 'পিতা',
    guardianPhone: '01611000030',
    status: 'approved',
    isVisible: true,
    views: 98,
    shortlists: 7,
  },
  {
    type: 'পাত্রীর বায়োডাটা',
    gender: 'female',
    maritalStatus: 'ডিভোর্সড',
    dateOfBirth: new Date('1993-11-05'),
    height: "5'4\"",
    complexion: 'শ্যামলা',
    bloodGroup: 'AB+',
    permanentDistrict: 'রাজশাহী',
    education: 'স্নাতক (সম্মান)',
    occupation: 'চাকরিজীবী (বেসরকারি)',
    monthlyIncome: '২০,০০০ - ৩০,০০০ টাকা',
    prayerHabit: '৫ ওয়াক্তই পড়ি',
    islamicLifestyle: 'আংশিক ইসলামিক',
    wearsHijab: true,
    brothers: 1,
    sisters: 1,
    familyEconomicStatus: 'মধ্যবিত্ত',
    familyReligiousEnvironment: 'সাধারণ',
    fatherName: 'আনিসুর রহমান',
    motherName: 'শামসুন নেছা',
    partnerAgeMin: 28,
    partnerAgeMax: 38,
    partnerExpectations: 'বোঝাপড়ার মানুষ চাই। অতীত নিয়ে কৌতূহলী নন এমন পাত্র পছন্দ।',
    guardianName: 'আনিসুর রহমান',
    guardianRelation: 'পিতা',
    guardianPhone: '01511000040',
    status: 'approved',
    isVisible: true,
    views: 67,
    shortlists: 5,
  },
  {
    type: 'পাত্রের বায়োডাটা',
    gender: 'male',
    maritalStatus: 'অবিবাহিত',
    dateOfBirth: new Date('1998-07-20'),
    height: "5'6\"",
    complexion: 'ফর্সা',
    bloodGroup: 'O-',
    permanentDistrict: 'খুলনা',
    education: 'এইচএসসি/সমকক্ষ',
    occupation: 'প্রবাসী',
    monthlyIncome: '৫০,০০০+ টাকা',
    prayerHabit: '৫ ওয়াক্তই পড়ি',
    islamicLifestyle: 'সম্পূর্ণ ইসলামিক',
    hasBeard: false,
    brothers: 2,
    sisters: 0,
    familyEconomicStatus: 'মধ্যবিত্ত',
    familyReligিousEnvironment: 'সাধারণ',
    fatherName: 'জাফর ইকবাল',
    motherName: 'মরিয়ম বেগম',
    partnerAgeMin: 20,
    partnerAgeMax: 25,
    guardianName: 'জাফর ইকবাল',
    guardianRelation: 'পিতা',
    guardianPhone: '01411000050',
    status: 'pending',
    isVisible: false,
    views: 0,
    shortlists: 0,
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB for seeding');

    // Clear existing data
    await User.deleteMany({});
    await Biodata.deleteMany({});
    logger.info('Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
    }
    logger.info(`Created ${createdUsers.length} users`);

    // Create biodatas for user accounts (index 2 onwards = regular users)
    const regularUserStart = 2;
    for (let i = 0; i < sampleBiodatas.length; i++) {
      const userIndex = regularUserStart + Math.floor(i / 2);
      const userId = createdUsers[Math.min(userIndex, createdUsers.length - 1)]._id;

      // Check if user already has a biodata
      const exists = await Biodata.findOne({ user: userId });
      if (!exists) {
        // Create a new user for each biodata
        const tempUser = await User.create({
          phone: `0171100${String(i + 10).padStart(4, '0')}`,
          password: 'User@123456',
          role: 'user',
          isVerified: true,
          isPhoneVerified: true,
        });
        await Biodata.create({ ...sampleBiodatas[i], user: tempUser._id });
      }
    }
    logger.info(`Created ${sampleBiodatas.length} biodatas`);

    logger.info('✅ Database seeded successfully!');
    logger.info('Admin login: admin@nikah.com / Admin@123456');
    logger.info('User login: 01711000003 / User@123456');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error(`Seeding failed: ${error.message}`);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDB();
