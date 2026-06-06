// src/validators/biodataValidator.js
const { body } = require('express-validator');
const { validate } = require('./authValidator');

exports.biodataRules = [
  body('type')
    .isIn(['পাত্রের বায়োডাটা', 'পাত্রীর বায়োডাটা'])
    .withMessage('বায়োডাটার ধরন নির্বাচন করুন'),
  body('maritalStatus')
    .isIn(['অবিবাহিত', 'ডিভোর্সড', 'বিধবা/বিপত্নীক'])
    .withMessage('বৈবাহিক অবস্থা নির্বাচন করুন'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('সঠিক জন্ম তারিখ দিন')
    .custom((val) => {
      const age = Math.floor((Date.now() - new Date(val)) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) throw new Error('বয়স কমপক্ষে ১৮ বছর হতে হবে');
      if (age > 80) throw new Error('সঠিক জন্ম তারিখ দিন');
      return true;
    }),
  body('height')
    .notEmpty()
    .withMessage('উচ্চতা দিন'),
  body('permanentDistrict')
    .notEmpty()
    .withMessage('স্থায়ী জেলা নির্বাচন করুন'),
  body('education')
    .isIn(['এসএসসি', 'এইচএসসি', 'স্নাতক (পাস)', 'স্নাতক (সম্মান)', 'স্নাতকোত্তর', 'পিএইচডি', 'মাদ্রাসা', 'অন্যান্য'])
    .withMessage('শিক্ষাগত যোগ্যতা নির্বাচন করুন'),
  body('occupation')
    .notEmpty()
    .withMessage('পেশা নির্বাচন করুন'),
  body('guardianPhone')
    .optional()
    .matches(/^(\+880|880|0)[1-9]\d{8,9}$/)
    .withMessage('সঠিক গার্ডিয়ানের ফোন নম্বর দিন'),
  body('aboutSelf')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('নিজের সম্পর্কে সর্বোচ্চ ১০০০ অক্ষর লেখা যাবে'),
  body('partnerExpectations')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('প্রত্যাশা সর্বোচ্চ ১০০০ অক্ষর লেখা যাবে'),
];

exports.validate = validate;
