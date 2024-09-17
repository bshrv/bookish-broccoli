const { connectionProperties, doRelease } = require("../db/oracle-properties");

const dotenv = require("dotenv");

dotenv.config();

//
const oracledb = require("oracledb");
oracledb.autoCommit = true;

async function verify(req, res) {
  const token = req.query.token;
  console.log("Verify TOKEN", token);
  oracledb.getConnection(connectionProperties, function (err, connection) {
    if (err) {
      console.error(err.message);
      res.status(500).send("Error connecting to DB");
      return;
    }
    console.log("after connection");

    // execute get
    connection.execute(
      `SELECT * FROM aws_liveness WHERE token = '${token}'`,
      {},
      { outFormat: oracledb.OBJECT },
      function (err, result) {
        if (err) {
          console.error(err.message);
          response.status(500).send("Error getting data from DB");
          doRelease(connection);
          return;
        }
        if (result.rows.length === 0) {
          res.status(404).send("Token not found");
        } else {
          const tokenInfo = result.rows[0];

          res.json({
            status: "Verified",
            message: "Token verified",
            tokenInfo,
          });
        }
        doRelease(connection);
      }
    );
  });
}

module.exports = {
  verify,
};
