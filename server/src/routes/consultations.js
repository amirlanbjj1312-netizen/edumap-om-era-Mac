const express = require('express');
const { ConsultationStore } = require('../services/consultationStore');
const { sendWhatsAppMessage } = require('../services/whatsappService');

const REQUIRED_FIELDS = [
  'schoolId',
  'schoolName',
  'parentName',
  'parentPhone',
  'childName',
  'childGrade',
];

const validatePayload = (body = {}) => {
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || !String(body[field]).trim()) {
      return `Field "${field}" is required.`;
    }
  }
  return null;
};

const buildConsultationsRouter = (config) => {
  const router = express.Router();
  const store = new ConsultationStore(config.dataFilePath);

  router.get('/', async (req, res, next) => {
    try {
      const data = await store.list();
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const record = await store.add({
        schoolId: String(req.body.schoolId).trim(),
        schoolName: req.body.schoolName.trim(),
        parentName: req.body.parentName.trim(),
        parentPhone: req.body.parentPhone.trim(),
        parentEmail: req.body.parentEmail?.trim() || '',
        childName: req.body.childName.trim(),
        childGrade: req.body.childGrade.trim(),
        consultationType: req.body.consultationType || 'First meeting',
        comment: req.body.comment?.trim() || '',
        whatsappPhone: req.body.whatsappPhone?.replace(/\s+/g, '') || '',
      });

      try {
        await sendWhatsAppMessage(config, record);
      } catch (whatsAppError) {
        console.warn('Failed to notify WhatsApp:', whatsAppError.message);
      }

      res.status(201).json({ data: record });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = {
  buildConsultationsRouter,
};
