const { client } = require("../utils/aws-clients");
const { connectionProperties, doRelease } = require("../db/oracle-properties");
const dotenv = require("dotenv");

// grab env
dotenv.config();

//
const oracledb = require("oracledb");
oracledb.autoCommit = true;
const {
  CreateFaceLivenessSessionCommand,
} = require("@aws-sdk/client-rekognition");

async function createliveness(req, res) {
  const { token } = req.body;

  try {
    const input = {
      Settings: {
        AuditImagesLimit: 4,
      },
      ClientRequestToken: token,
    };

    const command = new CreateFaceLivenessSessionCommand(input);
    const response = await client.send(command);

    // update database with sessionid

    const { SessionId } = response;

    await oracledb.getConnection(
      connectionProperties,
      function (err, connection) {
        if (err) {
          console.error(err.message);
          res.status(500).send("Error connecting to DB");
          return;
        }

        console.log("successful db connection");

        // execute get
        connection.execute(
          "UPDATE aws_liveness SET updated_at=SYSDATE, session_id=:session_id" +
            " WHERE token=:token",
          [SessionId, token],
          function (err, result) {
            if (err) {
              console.error(err.message);
              res.status(500).send("Error getting data from DB");
              doRelease(connection);
              return;
            }
            doRelease(connection);
          }
        );
      }
    );

    res.json(response);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "An error occurred while creating liveness session" });
  }
}

module.exports = {
  createliveness,
};
