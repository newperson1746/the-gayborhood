import dotenv from 'dotenv-extended';
import mysql from 'mysql2';

dotenv.load();

// SQL Setup
// to-do: modularize this whole thing
const sqlconfig = {
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  database: process.env.SQL_DB,
  password: process.env.SQL_PASS,
  connectionLimit: 10
}

const sqlconfigsoho = {
  host: process.env.SQLSOHO_HOST,
  user: process.env.SQLSOHO_USER,
  database: process.env.SQLSOHO_DB,
  password: process.env.SQLSOHO_PASS,
  connectionLimit: 10
}

const pool = mysql.createPool(sqlconfig, (err) => {
  if (err) {
    console.error('Error creating main SQL pool:', err);
    return;
  }
});

const poolsoho = mysql.createPool(sqlconfigsoho, (err) => {
  if (err) {
    console.error('Error creating MC SQL pool:', err);
    return;
  }
});

// Test the pool
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error getting main MySQL pool connection:', err);
    return;
  }

  console.log('MySQL main pool connection test successful!');

  // Release the connection back to the pool
  connection.release();
});

poolsoho.getConnection((err, connection) => {
  if (err) {
    console.error('Error getting MC MySQL pool connection:', err);
    return;
  }

  console.log('MySQL MC pool connection test successful!');

  // Release the connection back to the pool
  connection.release();
});

pool.on('acquire', function (connection) {
  console.log('MySQL main pool connection %d acquired', connection.threadId);
  connection.on('error', function (err) {
    console.error('Error with main MySQL connection:', err);
    connection.release();
  });
});

poolsoho.on('acquire', function (connection) {
  console.log('MySQL MC pool connection %d acquired', connection.threadId);
  connection.on('error', function (err) {
    console.error('Error with MC MySQL connection:', err);
    connection.release();
  });
});

function getMySQLVersion() {
  pool.query('SELECT version()', (error, results, fields) => {
    if (error) {
      console.error(error);
      return;
    }

    const mysqlVersion = results[0]['version()'];
    console.log(`main MySQL Version: ${mysqlVersion}`);
  });
}

function getMySQLVersionMC() {
  poolsoho.query('SELECT version()', (error, results, fields) => {
    if (error) {
      console.error(error);
      return;
    }

    const mysqlVersion = results[0]['version()'];
    console.log(`MC MySQL Version: ${mysqlVersion}`);
  });
}

export { pool, poolsoho, getMySQLVersion, getMySQLVersionMC };