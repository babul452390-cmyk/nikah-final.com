// src/utils/sms.js
const logger = require('./logger');

exports.sendSMS = async (to, message) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV SMS] To: ${to} | Message: ${message}`);
      return { success: true, sid: 'dev-mode' };
    }

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    logger.info(`SMS sent to ${to}: SID ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    logger.error(`SMS failed to ${to}: ${error.message}`);
    throw error;
  }
};
