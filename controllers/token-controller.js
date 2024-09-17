const { connectionProperties, doRelease } = require("../db/oracle-properties");
const { saveBase64AsImage } = require("../utils/image-utility");

const dotenv = require("dotenv");
const { nanoid } = require("nanoid");
const axios = require("axios");
const https = require("https");

// for image
const fs = require("fs");
const path = require("path");
// grab env
dotenv.config();

//
const oracledb = require("oracledb");
oracledb.autoCommit = true;

async function token(req, res) {
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
  const base64Data = body.danImg.replace("data:image/png;base64,", "");

  const filename = await saveBase64AsImage(
    base64Data,
    "temporary",
    token.slice(0, 10)
  );

  console.log({ filename });

  const filePath = path.join(__dirname, "temporary", filename);
  const file = fs.createReadStream(filePath);

  console.log("Starting axios post request to file to dms");

  const { data } = await axios.post(
    "https://172.29.2.23/dmsupload.php",
    {
      id: 1022,
      path: "Зээлийн хороо",
      file: file,
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
  // After receiving the file id and other information we will use it to update the row in oracle db

  if (data === "file baihgui") {
    console.log("no file");
  } else {
    await oracledb.getConnection(
      connectionProperties,
      function (err, connection) {
        if (err) {
          console.error(err.message);
          res.status(500).send("Error connecting to DB");
          return;
        }

        const { fileid, filename, filetype } = data.uploadedfile;
        console.log("after connection");

        // execute get
        connection.execute(
          "UPDATE aws_liveness SET updated_at=SYSDATE, dan_img_id=:dan_image_id, dan_img_name=:dan_img_name, dan_img_filetype=:dan_img_filetype" +
            " WHERE token=:token",
          [fileid, filename, filetype, token],
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
  }
}

module.exports = {
  token,
};
