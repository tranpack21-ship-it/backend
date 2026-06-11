import * as paymentMethodService from '../services/paymentMethod.service.js';

export const list = async (req, res) => {
  const data = await paymentMethodService.listPaymentMethods(req.query);
  res.json({ success: true, data });
};

export const getById = async (req, res) => {
  const data = await paymentMethodService.getPaymentMethodById(req.params.id);
  res.json({ success: true, data });
};

export const create = async (req, res) => {
  const data = await paymentMethodService.createPaymentMethod(req.body);
  res.status(201).json({ success: true, data, message: 'Método de pago creado' });
};

export const update = async (req, res) => {
  const data = await paymentMethodService.updatePaymentMethod(req.params.id, req.body);
  res.json({ success: true, data, message: 'Método de pago actualizado' });
};

export const deactivate = async (req, res) => {
  const data = await paymentMethodService.deactivatePaymentMethod(req.params.id);
  res.json({ success: true, data, message: 'Método de pago desactivado' });
};
