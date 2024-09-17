const dotenv = require("dotenv");
//
const oracledb = require("oracledb");
oracledb.autoCommit = true;

dotenv.config();

const connectionProperties = {
  user: process.env.DBAAS_USER_NAME || "oracle",
  password: process.env.DBAAS_USER_PASSWORD || "oracle",
  connectString:
    process.env.DBAAS_IP +
      `:${process.env.DBAAS_PORT}` +
      `/${process.env.DBAAS_SERVICE}` || "localhost/xe",
};

function doRelease(connection) {
  connection.release(function (err) {
    if (err) {
      console.error(err.message);
    }
  });
}

module.exports = {
  connectionProperties,
  doRelease,
};
