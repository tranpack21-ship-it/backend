-- ============================================================
-- Tran-Pack — Esquema completo (instalación desde cero)
-- Ejecutado por: npm run db:setup
-- ============================================================
-- Orden de tablas respetando dependencias de claves foráneas.
-- Compatible con MySQL 8+ / MariaDB 10.5+
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Roles y permisos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(50) NOT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_roles_nombre (nombre),
  KEY idx_roles_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permisos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(80) NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_permisos_codigo (codigo),
  KEY idx_permisos_modulo (modulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_usuario VARCHAR(60) NOT NULL,
  contrasena VARCHAR(255) NOT NULL,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  rol_id INT UNSIGNED NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_nombre (nombre_usuario),
  KEY idx_usuarios_estado (estado),
  KEY idx_usuarios_rol (rol_id),
  KEY idx_usuarios_fecha_creacion (fecha_creacion),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuario_permisos (
  usuario_id INT UNSIGNED NOT NULL,
  permiso_id INT UNSIGNED NOT NULL,
  fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, permiso_id),
  CONSTRAINT fk_up_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_up_permiso FOREIGN KEY (permiso_id) REFERENCES permisos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auditoria (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED DEFAULT NULL,
  accion VARCHAR(100) NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  detalle JSON DEFAULT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auditoria_usuario (usuario_id),
  KEY idx_auditoria_modulo (modulo),
  KEY idx_auditoria_fecha (fecha),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Catálogo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500) DEFAULT NULL,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_categorias_nombre (nombre),
  KEY idx_categorias_estado (estado),
  KEY idx_categorias_fecha (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS productos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(50) DEFAULT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  imagen_url VARCHAR(500) DEFAULT NULL,
  color VARCHAR(50) DEFAULT NULL,
  talle VARCHAR(30) DEFAULT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  precio_venta DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  precio_venta_paquete DECIMAL(12, 2) DEFAULT NULL,
  unidades_por_paquete DECIMAL(12, 3) NOT NULL DEFAULT 1.000,
  precio_costo DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  stock_minimo DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  unidad_medida VARCHAR(30) NOT NULL DEFAULT 'unidad',
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_productos_codigo (codigo),
  KEY idx_productos_nombre (nombre),
  KEY idx_productos_estado (estado),
  KEY idx_productos_categoria (categoria_id),
  KEY idx_productos_fecha (fecha_creacion),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo_documento ENUM('DNI', 'RUC', 'PASAPORTE', 'CF', 'OTRO') NOT NULL DEFAULT 'CF',
  numero_documento VARCHAR(20) DEFAULT NULL,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(120) DEFAULT NULL,
  telefono VARCHAR(30) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  saldo_cuenta_corriente DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  limite_credito DECIMAL(12, 2) DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clientes_nombre (nombre),
  KEY idx_clientes_estado (estado),
  KEY idx_clientes_saldo_cc (saldo_cuenta_corriente),
  KEY idx_clientes_documento (tipo_documento, numero_documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Caja (antes de ventas por FK caja_sesion_id)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS caja_sesiones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  estado ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
  monto_apertura DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_ventas_efectivo DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_ingresos DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_egresos DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  monto_esperado DECIMAL(12, 2) DEFAULT NULL,
  monto_cierre DECIMAL(12, 2) DEFAULT NULL,
  diferencia DECIMAL(12, 2) DEFAULT NULL,
  observaciones_apertura VARCHAR(500) DEFAULT NULL,
  observaciones_cierre VARCHAR(500) DEFAULT NULL,
  fecha_apertura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_caja_usuario (usuario_id),
  KEY idx_caja_estado (estado),
  KEY idx_caja_fecha_apertura (fecha_apertura),
  CONSTRAINT fk_caja_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Ventas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero VARCHAR(30) NOT NULL,
  cliente_id INT UNSIGNED DEFAULT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  descuento DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
  monto_recibido DECIMAL(12, 2) DEFAULT NULL,
  vuelto DECIMAL(12, 2) DEFAULT NULL,
  caja_sesion_id INT UNSIGNED DEFAULT NULL,
  estado ENUM('completada', 'anulada') NOT NULL DEFAULT 'completada',
  observaciones TEXT DEFAULT NULL,
  fecha_venta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_ventas_numero (numero),
  KEY idx_ventas_cliente (cliente_id),
  KEY idx_ventas_usuario (usuario_id),
  KEY idx_ventas_estado (estado),
  KEY idx_ventas_fecha (fecha_venta),
  KEY idx_ventas_caja (caja_sesion_id),
  CONSTRAINT fk_ventas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE SET NULL,
  CONSTRAINT fk_ventas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_ventas_caja FOREIGN KEY (caja_sesion_id) REFERENCES caja_sesiones (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venta_detalle (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NOT NULL,
  producto_nombre VARCHAR(150) NOT NULL,
  producto_codigo VARCHAR(50) NOT NULL,
  cantidad DECIMAL(12, 3) NOT NULL,
  modo_venta ENUM('suelto', 'paquete') NOT NULL DEFAULT 'suelto',
  cantidad_inventario DECIMAL(12, 3) NOT NULL,
  precio_unitario DECIMAL(12, 2) NOT NULL,
  descuento DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_detalle_venta (venta_id),
  KEY idx_detalle_producto (producto_id),
  CONSTRAINT fk_detalle_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES productos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venta_pagos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INT UNSIGNED NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL,
  monto DECIMAL(12, 2) NOT NULL,
  monto_recibido DECIMAL(12, 2) DEFAULT NULL,
  vuelto DECIMAL(12, 2) DEFAULT NULL,
  orden TINYINT UNSIGNED NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_venta_pagos_venta (venta_id),
  KEY idx_venta_pagos_metodo (metodo_pago),
  CONSTRAINT fk_venta_pagos_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Presupuestos (no afectan stock ni caja)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS presupuestos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero VARCHAR(30) NOT NULL,
  cliente_id INT UNSIGNED DEFAULT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  descuento DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  estado ENUM('vigente', 'anulado', 'convertido') NOT NULL DEFAULT 'vigente',
  validez_dias INT UNSIGNED NOT NULL DEFAULT 15,
  validez_hasta DATE DEFAULT NULL,
  observaciones TEXT DEFAULT NULL,
  venta_id INT UNSIGNED DEFAULT NULL,
  fecha_presupuesto TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_presupuestos_numero (numero),
  KEY idx_presupuestos_cliente (cliente_id),
  KEY idx_presupuestos_usuario (usuario_id),
  KEY idx_presupuestos_estado (estado),
  KEY idx_presupuestos_fecha (fecha_presupuesto),
  CONSTRAINT fk_presupuestos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE SET NULL,
  CONSTRAINT fk_presupuestos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_presupuestos_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS presupuesto_detalle (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  presupuesto_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NOT NULL,
  producto_nombre VARCHAR(150) NOT NULL,
  producto_codigo VARCHAR(50) NOT NULL DEFAULT '',
  cantidad DECIMAL(12, 3) NOT NULL,
  modo_venta ENUM('suelto', 'paquete') NOT NULL DEFAULT 'suelto',
  precio_unitario DECIMAL(12, 2) NOT NULL,
  descuento DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_presupuesto_detalle_presupuesto (presupuesto_id),
  KEY idx_presupuesto_detalle_producto (producto_id),
  CONSTRAINT fk_presupuesto_detalle_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES presupuestos (id) ON DELETE CASCADE,
  CONSTRAINT fk_presupuesto_detalle_producto FOREIGN KEY (producto_id) REFERENCES productos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Inventario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INT UNSIGNED NOT NULL,
  tipo ENUM('entrada', 'salida', 'ajuste') NOT NULL,
  cantidad DECIMAL(12, 3) NOT NULL,
  stock_anterior DECIMAL(12, 3) NOT NULL,
  stock_posterior DECIMAL(12, 3) NOT NULL,
  motivo VARCHAR(255) DEFAULT NULL,
  referencia VARCHAR(80) DEFAULT NULL,
  usuario_id INT UNSIGNED DEFAULT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_producto (producto_id),
  KEY idx_mov_tipo (tipo),
  KEY idx_mov_fecha (fecha),
  KEY idx_mov_referencia (referencia),
  CONSTRAINT fk_mov_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
  CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Cuenta corriente (después de ventas y caja)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuenta_corriente_movimientos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id INT UNSIGNED NOT NULL,
  tipo ENUM('cargo', 'pago', 'ajuste', 'anulacion') NOT NULL,
  monto DECIMAL(12, 2) NOT NULL,
  saldo_anterior DECIMAL(12, 2) NOT NULL,
  saldo_posterior DECIMAL(12, 2) NOT NULL,
  venta_id INT UNSIGNED DEFAULT NULL,
  referencia VARCHAR(80) DEFAULT NULL,
  observaciones VARCHAR(500) DEFAULT NULL,
  metodo_cobro VARCHAR(50) DEFAULT NULL,
  caja_sesion_id INT UNSIGNED DEFAULT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cc_mov_cliente (cliente_id),
  KEY idx_cc_mov_fecha (fecha),
  KEY idx_cc_mov_tipo (tipo),
  KEY idx_cc_mov_venta (venta_id),
  KEY idx_cc_mov_caja (caja_sesion_id),
  CONSTRAINT fk_cc_mov_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
  CONSTRAINT fk_cc_mov_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE SET NULL,
  CONSTRAINT fk_cc_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_cc_mov_caja FOREIGN KEY (caja_sesion_id) REFERENCES caja_sesiones (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Movimientos de caja
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS caja_movimientos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sesion_id INT UNSIGNED NOT NULL,
  tipo ENUM('apertura', 'ingreso', 'egreso', 'venta', 'anulacion', 'cobro_cc') NOT NULL,
  monto DECIMAL(12, 2) NOT NULL,
  metodo_pago VARCHAR(50) DEFAULT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  referencia VARCHAR(80) DEFAULT NULL,
  venta_id INT UNSIGNED DEFAULT NULL,
  cuenta_corriente_movimiento_id BIGINT UNSIGNED DEFAULT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_caja_mov_sesion (sesion_id),
  KEY idx_caja_mov_tipo (tipo),
  KEY idx_caja_mov_fecha (fecha),
  CONSTRAINT fk_caja_mov_sesion FOREIGN KEY (sesion_id) REFERENCES caja_sesiones (id),
  CONSTRAINT fk_caja_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_caja_mov_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE SET NULL,
  CONSTRAINT fk_caja_mov_cc FOREIGN KEY (cuenta_corriente_movimiento_id) REFERENCES cuenta_corriente_movimientos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Comprobantes y métodos de pago
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comprobantes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venta_id INT UNSIGNED NOT NULL,
  numero VARCHAR(30) NOT NULL,
  tipo ENUM('ticket', 'factura', 'boleta') NOT NULL DEFAULT 'ticket',
  fecha_emision TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_comprobantes_venta (venta_id),
  UNIQUE KEY uk_comprobantes_numero (numero),
  KEY idx_comprobantes_tipo (tipo),
  KEY idx_comprobantes_fecha (fecha_emision),
  CONSTRAINT fk_comprobante_venta FOREIGN KEY (venta_id) REFERENCES ventas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS metodos_pago (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  requiere_cliente TINYINT(1) NOT NULL DEFAULT 0,
  requiere_monto_recibido TINYINT(1) NOT NULL DEFAULT 0,
  registra_en_caja TINYINT(1) NOT NULL DEFAULT 0,
  genera_cargo_cc TINYINT(1) NOT NULL DEFAULT 0,
  es_predeterminado TINYINT(1) NOT NULL DEFAULT 0,
  orden INT UNSIGNED NOT NULL DEFAULT 0,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_metodos_pago_codigo (codigo),
  KEY idx_metodos_pago_estado (estado),
  KEY idx_metodos_pago_orden (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Datos iniciales (idempotentes)
-- ------------------------------------------------------------
INSERT INTO roles (nombre, descripcion) VALUES
  ('admin', 'Administrador con acceso total al sistema'),
  ('empleado', 'Empleado con acceso según permisos asignados')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

INSERT INTO permisos (codigo, modulo, descripcion) VALUES
  ('dashboard.ver', 'dashboard', 'Acceder al panel principal'),
  ('usuarios.ver', 'usuarios', 'Ver listado de usuarios'),
  ('usuarios.crear', 'usuarios', 'Crear nuevos usuarios'),
  ('usuarios.editar', 'usuarios', 'Editar usuarios existentes'),
  ('usuarios.desactivar', 'usuarios', 'Desactivar usuarios'),
  ('permisos.ver', 'permisos', 'Ver permisos de empleados'),
  ('permisos.asignar', 'permisos', 'Asignar permisos a empleados'),
  ('categorias.ver', 'categorias', 'Ver listado de categorías'),
  ('categorias.crear', 'categorias', 'Crear categorías'),
  ('categorias.editar', 'categorias', 'Editar categorías'),
  ('categorias.desactivar', 'categorias', 'Desactivar categorías'),
  ('productos.ver', 'productos', 'Ver listado de productos'),
  ('productos.crear', 'productos', 'Crear productos'),
  ('productos.editar', 'productos', 'Editar productos'),
  ('productos.desactivar', 'productos', 'Desactivar productos'),
  ('clientes.ver', 'clientes', 'Ver clientes'),
  ('clientes.crear', 'clientes', 'Crear clientes'),
  ('clientes.editar', 'clientes', 'Editar clientes'),
  ('clientes.desactivar', 'clientes', 'Desactivar clientes'),
  ('inventario.ver', 'inventario', 'Ver inventario'),
  ('inventario.movimiento', 'inventario', 'Registrar movimientos'),
  ('ventas.ver', 'ventas', 'Ver ventas'),
  ('ventas.crear', 'ventas', 'Registrar ventas'),
  ('ventas.anular', 'ventas', 'Anular ventas'),
  ('presupuestos.ver', 'presupuestos', 'Ver presupuestos'),
  ('presupuestos.crear', 'presupuestos', 'Crear presupuestos'),
  ('presupuestos.anular', 'presupuestos', 'Anular presupuestos'),
  ('presupuestos.convertir', 'presupuestos', 'Convertir presupuestos a venta'),
  ('cuenta_corriente.ver', 'cuenta_corriente', 'Ver saldos y movimientos de cuenta corriente'),
  ('cuenta_corriente.cobrar', 'cuenta_corriente', 'Registrar cobros a clientes'),
  ('cuenta_corriente.ajustar', 'cuenta_corriente', 'Ajustar saldo de cuenta corriente'),
  ('caja.ver', 'caja', 'Ver sesiones y movimientos de caja'),
  ('caja.abrir', 'caja', 'Abrir turno de caja'),
  ('caja.cerrar', 'caja', 'Cerrar turno de caja'),
  ('caja.movimiento', 'caja', 'Registrar ingresos y egresos'),
  ('comprobantes.ver', 'comprobantes', 'Ver e imprimir comprobantes'),
  ('reportes.ver', 'reportes', 'Ver reportes y estadísticas'),
  ('auditoria.ver', 'auditoria', 'Ver registro de auditoría'),
  ('metodos_pago.ver', 'metodos_pago', 'Ver métodos de pago activos'),
  ('metodos_pago.gestionar', 'metodos_pago', 'Configurar métodos de pago')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

INSERT INTO categorias (nombre, descripcion, estado) VALUES
  ('General', 'Productos sin categoría específica', 'activo'),
  ('Bebidas', 'Bebidas y líquidos', 'activo'),
  ('Alimentos', 'Productos alimenticios', 'activo')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

INSERT INTO metodos_pago (
  codigo, nombre, descripcion,
  requiere_cliente, requiere_monto_recibido, registra_en_caja, genera_cargo_cc,
  es_predeterminado, orden, estado
) VALUES
  ('efectivo', 'Efectivo', 'Pago en efectivo al momento de la venta', 0, 1, 1, 0, 1, 1, 'activo'),
  ('transferencia', 'Transferencia', 'Transferencia bancaria', 0, 0, 0, 0, 0, 2, 'activo'),
  ('tarjeta_credito', 'Tarjeta de crédito', 'Pago con tarjeta de crédito', 0, 0, 0, 0, 0, 3, 'activo'),
  ('cuenta_corriente', 'Cuenta corriente', 'Carga a la cuenta del cliente', 1, 0, 0, 1, 0, 4, 'activo')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  requiere_cliente = VALUES(requiere_cliente),
  requiere_monto_recibido = VALUES(requiere_monto_recibido),
  registra_en_caja = VALUES(registra_en_caja),
  genera_cargo_cc = VALUES(genera_cargo_cc),
  orden = VALUES(orden);

-- Usuario admin: lo crea setup.js con ADMIN_PASSWORD
