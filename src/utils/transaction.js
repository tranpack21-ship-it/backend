import { pool } from '../config/database.js';

export const withTransaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error('[withTransaction] rollback falló:', rollbackErr?.message || rollbackErr);
    }
    throw error;
  } finally {
    connection.release();
  }
};
