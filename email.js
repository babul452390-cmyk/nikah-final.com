// src/utils/email.js
const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: parseInt(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
});

// ── Email templates ──
const templates = {
  emailVerification: (data) => ({
    subject: '✉️ Nikah.com - ইমেইল ভেরিফিকেশন',
    html: `
      <div style="font-family:'Hind Siliguri',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:linear-gradient(135deg,#1a6b3c,#228b4f);padding:40px 30px;text-align:center;">
          <h1 style="color:#fff;font-size:28px;margin:0;">Nikah.com</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">বাংলাদেশের সেরা ইসলামিক ম্যাট্রিমনি</p>
        </div>
        <div style="padding:40px 30px;">
          <h2 style="color:#1a6b3c;font-size:22px;">ইমেইল ভেরিফিকেশন</h2>
          <p style="color:#525252;line-height:1.7;">আপনার অ্যাকাউন্ট সক্রিয় করতে নিচের বাটনে ক্লিক করুন:</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${data.verifyUrl}" style="background:#1a6b3c;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:16px;font-weight:bold;">✅ ইমেইল ভেরিফাই করুন</a>
          </div>
          <p style="color:#a3a3a3;font-size:13px;">এই লিংক ২৪ ঘণ্টার মধ্যে ব্যবহার করুন। যদি আপনি এই অ্যাকাউন্ট তৈরি না করেন, এই ইমেইল উপেক্ষা করুন।</p>
        </div>
        <div style="background:#f5f5f5;padding:20px;text-align:center;">
          <p style="color:#a3a3a3;font-size:12px;margin:0;">© ${new Date().getFullYear()} Nikah.com — সকল অধিকার সংরক্ষিত</p>
        </div>
      </div>
    `,
  }),

  passwordReset: (data) => ({
    subject: '🔐 Nikah.com - পাসওয়ার্ড রিসেট',
    html: `
      <div style="font-family:'Hind Siliguri',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:linear-gradient(135deg,#1a6b3c,#228b4f);padding:40px 30px;text-align:center;">
          <h1 style="color:#fff;font-size:28px;margin:0;">Nikah.com</h1>
        </div>
        <div style="padding:40px 30px;">
          <h2 style="color:#dc2626;font-size:22px;">পাসওয়ার্ড রিসেট অনুরোধ</h2>
          <p style="color:#525252;line-height:1.7;">আপনার পাসওয়ার্ড রিসেট করতে নিচের বাটনে ক্লিক করুন। এই লিংক ১ ঘণ্টা পর্যন্ত বৈধ।</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${data.resetUrl}" style="background:#dc2626;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:16px;font-weight:bold;">🔐 পাসওয়ার্ড রিসেট করুন</a>
          </div>
          <p style="color:#a3a3a3;font-size:13px;">যদি আপনি এই অনুরোধ না করেন, আপনার পাসওয়ার্ড নিরাপদ আছে।</p>
        </div>
      </div>
    `,
  }),

  biodataApproved: (data) => ({
    subject: '✅ Nikah.com - বায়োডাটা অনুমোদিত হয়েছে',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:40px;">
        <div style="background:#1a6b3c;padding:30px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;">Nikah.com</h1>
        </div>
        <div style="padding:30px;border:1px solid #e9e9e9;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="color:#1a6b3c;">🎉 অভিনন্দন! আপনার বায়োডাটা অনুমোদিত হয়েছে</h2>
          <p style="color:#525252;line-height:1.7;">আপনার বায়োডাটা (ID: <strong>${data.biodataId}</strong>) সফলভাবে যাচাই করা হয়েছে এবং এখন সকলের জন্য দৃশ্যমান।</p>
          <a href="${process.env.CLIENT_URL}" style="background:#1a6b3c;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;display:inline-block;margin-top:16px;">প্ল্যাটফর্মে যান →</a>
        </div>
      </div>
    `,
  }),

  connectionRequest: (data) => ({
    subject: '💌 Nikah.com - নতুন সংযোগ অনুরোধ',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px;">
        <div style="background:#1a6b3c;padding:30px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;">Nikah.com</h1>
        </div>
        <div style="padding:30px;border:1px solid #e9e9e9;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="color:#1a6b3c;">💌 নতুন সংযোগ অনুরোধ</h2>
          <p style="color:#525252;line-height:1.7;">আপনার প্রোফাইলে <strong>${data.senderBiodataId}</strong> একটি সংযোগ অনুরোধ পাঠিয়েছে।</p>
          <a href="${process.env.CLIENT_URL}/connections" style="background:#1a6b3c;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;display:inline-block;margin-top:16px;">অনুরোধ দেখুন →</a>
        </div>
      </div>
    `,
  }),

  subscriptionConfirm: (data) => ({
    subject: `🌟 Nikah.com - ${data.plan} প্ল্যান সক্রিয়`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px;">
        <div style="background:linear-gradient(135deg,#c9973a,#e0a840);padding:30px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;">🌟 ${data.plan} সদস্যপদ</h1>
        </div>
        <div style="padding:30px;border:1px solid #e9e9e9;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="color:#c9973a;">অভিনন্দন! আপনার সাবস্ক্রিপশন সক্রিয় হয়েছে</h2>
          <p>মেয়াদ: <strong>${data.endDate}</strong> পর্যন্ত</p>
          <p>পরিমাণ: <strong>৳${data.amount}</strong></p>
        </div>
      </div>
    `,
  }),
};

exports.sendEmail = async ({ to, subject, template, data, html: rawHtml, text }) => {
  try {
    let emailContent = {};

    if (template && templates[template]) {
      emailContent = templates[template](data || {});
    } else {
      emailContent = { subject, html: rawHtml, text };
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to,
      subject: emailContent.subject || subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email send failed to ${to}: ${error.message}`);
    throw error;
  }
};

// Verify transporter on startup
transporter.verify((error) => {
  if (error) {
    logger.warn(`Email transporter not ready: ${error.message}`);
  } else {
    logger.info('Email transporter ready');
  }
});
