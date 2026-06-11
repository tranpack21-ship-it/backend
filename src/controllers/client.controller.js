import * as clientService from '../services/client.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  const result = await clientService.listClients(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

export const listActive = asyncHandler(async (req, res) => {
  const clientes = await clientService.listClientsActive();
  res.json({ success: true, data: { clientes } });
});

export const getById = asyncHandler(async (req, res) => {
  const cliente = await clientService.getClientById(req.params.id);
  res.json({ success: true, data: { cliente } });
});

export const create = asyncHandler(async (req, res) => {
  const cliente = await clientService.createClient(req.body);
  res.status(201).json({
    success: true,
    message: 'Cliente creado correctamente',
    data: { cliente },
  });
});

export const update = asyncHandler(async (req, res) => {
  const cliente = await clientService.updateClient(req.params.id, req.body);
  res.json({
    success: true,
    message: 'Cliente actualizado correctamente',
    data: { cliente },
  });
});

export const deactivate = asyncHandler(async (req, res) => {
  const cliente = await clientService.deactivateClient(req.params.id);
  res.json({
    success: true,
    message: 'Cliente desactivado correctamente',
    data: { cliente },
  });
});
