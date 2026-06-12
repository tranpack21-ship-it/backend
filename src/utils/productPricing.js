import { AppError } from './AppError.js';

export const MODOS_VENTA = ['suelto', 'paquete'];

export const hasPaquetePricing = (product) =>
  product != null &&
  product.precio_venta_paquete != null &&
  Number(product.precio_venta_paquete) > 0 &&
  Number(product.unidades_por_paquete) > 0;

export const resolveSaleLinePricing = (product, item) => {
  const modo = item.modo_venta === 'paquete' ? 'paquete' : 'suelto';
  const cantidad = Number(item.cantidad);

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new AppError('La cantidad debe ser mayor a 0', 400);
  }

  if (modo === 'paquete') {
    if (!hasPaquetePricing(product)) {
      throw new AppError(
        `«${product.nombre}» no tiene precio por paquete configurado`,
        400
      );
    }

    const precioUnitario =
      item.precio_unitario !== undefined
        ? Number(item.precio_unitario)
        : Number(product.precio_venta_paquete);
    const unidadesPorPaquete = Number(product.unidades_por_paquete);

    return {
      modo_venta: 'paquete',
      cantidad,
      precio_unitario: precioUnitario,
      cantidad_inventario: cantidad * unidadesPorPaquete,
      unidades_por_paquete: unidadesPorPaquete,
    };
  }

  const precioUnitario =
    item.precio_unitario !== undefined
      ? Number(item.precio_unitario)
      : Number(product.precio_venta);

  return {
    modo_venta: 'suelto',
    cantidad,
    precio_unitario: precioUnitario,
    cantidad_inventario: cantidad,
    unidades_por_paquete: null,
  };
};

export const inventoryQtyFromLine = (line) =>
  line.cantidad_inventario != null
    ? Number(line.cantidad_inventario)
    : Number(line.cantidad);
