const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { nanoid } = require("nanoid");
const https = require("https");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
dotenv.config();

//
const oracledb = require("oracledb");
oracledb.autoCommit = true;
//
const cors = require("cors");

// Create Express app
const app = express();

app.use(cors());

if (!process.env.PORT) throw new Error("Environment variables not loaded");

// Oracle database configuration
const connectionProperties = {
  user: process.env.DBAAS_USER_NAME || "oracle",
  password: process.env.DBAAS_USER_PASSWORD || "oracle",
  connectString:
    process.env.DBAAS_IP +
      `:${process.env.DBAAS_PORT}` +
      `/${process.env.DBAAS_SERVICE}` || "localhost/xe",
};

// End DB connection
function doRelease(connection) {
  connection.release(function (err) {
    if (err) {
      console.error(err.message);
    }
  });
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Server Port
const PORT = process.env.PORT || 8089;

// Example route
app.get("/verify", async (req, res) => {
  const token = req.query.token;
  console.log("Verify TOKEN");
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
});

/**
 * POST /
 * Creates a token and inserts it into the oracle db and then send the base64 image to
 * dms and saves the file and retrieves the id and all that
 * then in turn sends those id's and what not to oracle db again while updating the
 * updated date
 */
app.post("/token", async (req, res) => {
  const token = nanoid(40);
  const body = req.body;

  console.log("POST AND GET TOKEN");
  await oracledb.getConnection(
    connectionProperties,
    function (err, connection) {
      if (err) {
        console.error(err.message);
        res.status(500).send("Error connecting to DB");
        return;
      }

      console.log("after connection");

      // execute get
      connection.execute(
        "INSERT INTO aws_liveness (TOKEN, RECEIVED_ID, CREATED_AT)" +
          "VALUES(:token,:received_id,SYSDATE)",
        [token, body.received_id],
        function (err, result) {
          if (err) {
            console.error(err.message);
            res.status(500).send("Error getting data from DB");
            doRelease(connection);
            return;
          }

          res.json(token);
          doRelease(connection);
        }
      );
    }
  );

  // ?filename={FILENAME}&type={TYPE}&id={ID}

  // DMS POST to upload the image using axios post
  // const data = new FormData();

  console.log("Starting axios post request to file to dms");
  const filePath = path.join(__dirname, "test.png");
  const image123 = fs.createReadStream(filePath);

  try {
    const { data } = await axios.post(
      "https://172.29.2.23/dmsupload.php",
      {
        id: 1022,
        path: "Зээлийн хороо",
        file: image123,
      },
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      }
    );
    console.log("end of axios", data);
  } catch (error) {
    console.log("failed axios post", error);
  }

  // After receiving the file id and other information we will use it to update the row in oracle db

  // await oracledb.getConnection(
  //   connectionProperties,
  //   function (err, connection) {
  //     if (err) {
  //       console.error(err.message);
  //       res.status(500).send("Error connecting to DB");
  //       return;
  //     }

  //     const body = imageDetails.uploadedfile;
  //     console.log("after connection");

  //     // execute get
  //     connection.execute(
  //       "UPDATE aws_liveness SET updated_at=SYSDATE, dan_img_id=:dan_image_id, dan_img_name=:dan_img_name, dan_img_filetype=:dan_img_filetype" +
  //         " WHERE token=:token",
  //       [body.fileid, body.filename, body.filetype],
  //       function (err, result) {
  //         if (err) {
  //           console.error(err.message);
  //           res.status(500).send("Error getting data from DB");
  //           doRelease(connection);
  //           return;
  //         }
  //         doRelease(connection);
  //       }
  //     );
  //   }
  // );
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
