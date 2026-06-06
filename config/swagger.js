// src/config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nikah.com API',
      version: '1.0.0',
      description: `
# Nikah.com — ইসলামিক ম্যাট্রিমনি প্ল্যাটফর্ম API

বাংলাদেশের সেরা ইসলামিক ম্যাট্রিমনি প্ল্যাটফর্মের সম্পূর্ণ REST API।

## Authentication
JWT Bearer Token ব্যবহার করুন:
\`\`\`
Authorization: Bearer <your_token>
\`\`\`

## Rate Limiting
- Global: ১৫ মিনিটে ১০০ রিকোয়েস্ট
- Auth endpoints: ১৫ মিনিটে ১০ রিকোয়েস্ট
- OTP endpoints: ১ ঘণ্টায় ৫ রিকোয়েস্ট
      `,
      contact: {
        name: 'Nikah.com Support',
        email: 'support@nikah.com',
        url: 'https://nikah.com',
      },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Development' },
      { url: 'https://api.nikah.com/api/v1', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '6789abcd1234567890' },
            phone: { type: 'string', example: '01711000001' },
            email: { type: 'string', example: 'user@example.com' },
            role: { type: 'string', enum: ['user', 'admin', 'moderator'] },
            plan: { type: 'string', enum: ['basic', 'standard', 'premium', 'gold'] },
            isVerified: { type: 'boolean' },
          },
        },
        Biodata: {
          type: 'object',
          properties: {
            biodataId: { type: 'string', example: 'PTR-01001' },
            type: { type: 'string', example: 'পাত্রের বায়োডাটা' },
            gender: { type: 'string', enum: ['male', 'female'] },
            maritalStatus: { type: 'string', example: 'অবিবাহিত' },
            age: { type: 'number', example: 26 },
            height: { type: 'string', example: "5'8\"" },
            permanentDistrict: { type: 'string', example: 'ঢাকা' },
            education: { type: 'string', example: 'স্নাতক (সম্মান)' },
            occupation: { type: 'string', example: 'চাকরিজীবী (সরকারি)' },
            islamicLifestyle: { type: 'string', example: 'সম্পূর্ণ ইসলামিক' },
            status: { type: 'string', enum: ['draft', 'pending', 'approved', 'rejected'] },
          },
        },
        ConnectionRequest: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sender: { type: 'string' },
            receiver: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'cancelled'] },
            message: { type: 'string' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'ত্রুটি বার্তা' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'নিবন্ধন, লগইন ও অ্যাকাউন্ট ব্যবস্থাপনা' },
      { name: 'Biodatas', description: 'বায়োডাটা তৈরি, আপডেট ও অনুসন্ধান' },
      { name: 'Connections', description: 'সংযোগ অনুরোধ পাঠানো ও গ্রহণ' },
      { name: 'Shortlists', description: 'পছন্দের বায়োডাটা সংরক্ষণ' },
      { name: 'Notifications', description: 'বিজ্ঞপ্তি ব্যবস্থাপনা' },
      { name: 'Subscriptions', description: 'সাবস্ক্রিপশন ও পেমেন্ট' },
      { name: 'Reviews', description: 'সাফল্যের গল্প ও রিভিউ' },
      { name: 'Admin', description: 'অ্যাডমিন ড্যাশবোর্ড ও নিয়ন্ত্রণ' },
    ],
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'নতুন অ্যাকাউন্ট তৈরি',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['password'],
                  properties: {
                    phone: { type: 'string', example: '01711000099' },
                    email: { type: 'string', example: 'user@example.com' },
                    password: { type: 'string', example: 'Pass@1234' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'নিবন্ধন সফল' },
            400: { description: 'ইনপুট ত্রুটি' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'লগইন',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['identifier', 'password'],
                  properties: {
                    identifier: { type: 'string', example: '01711000001' },
                    password: { type: 'string', example: 'Pass@1234' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'লগইন সফল, JWT token প্রদান' },
            401: { description: 'ভুল তথ্য' },
          },
        },
      },
      '/biodatas': {
        get: {
          tags: ['Biodatas'],
          summary: 'সকল অনুমোদিত বায়োডাটা',
          parameters: [
            { name: 'gender', in: 'query', schema: { type: 'string', enum: ['male', 'female'] } },
            { name: 'district', in: 'query', schema: { type: 'string' } },
            { name: 'ageMin', in: 'query', schema: { type: 'integer' } },
            { name: 'ageMax', in: 'query', schema: { type: 'integer' } },
            { name: 'education', in: 'query', schema: { type: 'string' } },
            { name: 'islamicLifestyle', in: 'query', schema: { type: 'string' } },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'oldest', 'age_asc', 'age_desc', 'most_viewed'] } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
          ],
          responses: { 200: { description: 'বায়োডাটার তালিকা' } },
        },
        post: {
          tags: ['Biodatas'],
          summary: 'নতুন বায়োডাটা তৈরি',
          security: [{ bearerAuth: [] }],
          responses: {
            201: { description: 'বায়োডাটা জমা সফল' },
            400: { description: 'ইনপুট ত্রুটি' },
            401: { description: 'অননুমোদিত' },
          },
        },
      },
      '/connections/request': {
        post: {
          tags: ['Connections'],
          summary: 'সংযোগ অনুরোধ পাঠান',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['receiverBiodataId'],
                  properties: {
                    receiverBiodataId: { type: 'string' },
                    message: { type: 'string', maxLength: 500 },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'অনুরোধ পাঠানো সফল' },
            400: { description: 'ইনপুট ত্রুটি' },
          },
        },
      },
      '/subscriptions/plans': {
        get: {
          tags: ['Subscriptions'],
          summary: 'সকল সাবস্ক্রিপশন প্ল্যান দেখুন',
          responses: { 200: { description: 'প্ল্যানের তালিকা' } },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
