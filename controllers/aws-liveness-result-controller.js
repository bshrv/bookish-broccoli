const {
  saveByteArrayAsImage,
  createBufferFromImage,
} = require("../utils/image-utility");

const dotenv = require("dotenv");
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
const {
  GetFaceLivenessSessionResultsCommand,
  CompareFacesCommand,
} = require("@aws-sdk/client-rekognition");

const { connectionProperties, doRelease } = require("../db/oracle-properties");
const { client, compareClient } = require("../utils/aws-clients");

async function livenessresult(req, res) {
  try {
    const session = req.body.SessionId;
    const token = req.query.token;

    const input = {
      SessionId: session.SessionId,
    };

    // receive aws liveness score
    const command = new GetFaceLivenessSessionResultsCommand(input);
    const response = await client.send(command);

    const confidence = response.Confidence;

    // receive aws comparison score

    if (!response.ReferenceImage) {
      res.json("No Reference face found");
    }

    const arrayBytes = Object.values(response.ReferenceImage.Bytes);
    const fileLivename = saveByteArrayAsImage(
      arrayBytes,
      "temporary",
      session.SessionId.slice(0, 10)
    );

    const filePath = path.join(__dirname, "temporary", fileLivename);
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

    const livebuffer = Buffer.from(arrayBytes);
    const localDanImg = path.join(
      __dirname,
      "temporary",
      token.slice(0, 10) + ".png"
    );

    const danBuffer = createBufferFromImage(localDanImg);

    const compareInput = {
      SourceImage: { Bytes: danBuffer },
      TargetImage: { Bytes: livebuffer },
      SimilarityThreshold: 70,
    };

    const compareCommand = new CompareFacesCommand(compareInput);
    const compareResponse = await compareClient.send(compareCommand);
    let comparison = 0.0;

    if (compareResponse.FaceMatches.length() > 0) {
      comparison = compareResponse.SourceImageFace.Confidence;
    }

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

          console.log("successful db connection");
          const { fileid, filename, filetype } = data.uploadedfile;
          // execute get
          connection.execute(
            "UPDATE aws_liveness SET updated_at=SYSDATE, liveness_score=:confidence, compare_score=:comparison, live_img_id=:fileid, live_img_name=:filename, live_img_filetype=:filetype" +
              " WHERE token=:token",
            [confidence, comparison, fileid, filename, filetype, token],
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

    res.json(response);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "An error occurred while getting liveness results" });
  }
}

module.exports = {
  livenessresult,
};
