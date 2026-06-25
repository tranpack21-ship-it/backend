import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import permissionRoutes from './permission.routes.js';
import categoryRoutes from './category.routes.js';
import productRoutes from './product.routes.js';
import clientRoutes from './client.routes.js';
import inventoryRoutes from './inventory.routes.js';
import saleRoutes from './sale.routes.js';
import quoteRoutes from './quote.routes.js';
import cashRoutes from './cash.routes.js';
import reportRoutes from './report.routes.js';
import receiptRoutes from './receipt.routes.js';
import auditRoutes from './audit.routes.js';
import cuentaCorrienteRoutes from './cuentaCorriente.routes.js';
import paymentMethodRoutes from './paymentMethod.routes.js';
import healthRoutes from './health.routes.js';
import alertRoutes from './alert.routes.js';

const router = Router();

router.use('/health', healthRoutes);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/permissions', permissionRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/clients', clientRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', saleRoutes);
router.use('/quotes', quoteRoutes);
router.use('/cash', cashRoutes);
router.use('/reports', reportRoutes);
router.use('/alerts', alertRoutes);
router.use('/receipts', receiptRoutes);
router.use('/audit', auditRoutes);
router.use('/cuenta-corriente', cuentaCorrienteRoutes);
router.use('/payment-methods', paymentMethodRoutes);

export default router;
