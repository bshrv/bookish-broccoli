const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { nanoid } = require("nanoid");
const axios = require("axios");
const https = require("https");

// for image
const fs = require("fs");
const path = require("path");
const util = require("util");
// grab env
dotenv.config();

//
const oracledb = require("oracledb");
oracledb.autoCommit = true;
//
const cors = require("cors");
const {
  CreateFaceLivenessSessionCommand,
  RekognitionClient,
  GetFaceLivenessSessionResultsCommand,
  CompareFacesCommand,
} = require("@aws-sdk/client-rekognition");
const { fromCognitoIdentityPool } = require("@aws-sdk/credential-providers");

// Create Express app
const app = express();

// promisify
const writeFileAsync = util.promisify(fs.writeFile);
const mkdirAsync = util.promisify(fs.mkdir);
const readFileAsync = util.promisify(fs.readFile);

app.use(cors());

// AWS CLIENTS USED IN LATER ROUTES

dotenv.config();

const client = new RekognitionClient({
  region: "ap-northeast-1",
  credentials: fromCognitoIdentityPool({
    identityPoolId: process.env.IDENTITY_POOL_ID,
    clientConfig: { region: "ap-northeast-1" },
  }),
});

const compareClient = new RekognitionClient({
  region: "ap-northeast-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

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

// base64 to image converter and saves it as a file
async function saveBase64AsImage(base64String, folderPath, filename) {
  // Determine file type from base64 prefix
  let fileType = "png"; // default to png
  let base64Data = base64String;

  if (base64String.startsWith("data:image/")) {
    const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,/);
    if (matches && matches.length > 1) {
      fileType = matches[1].toLowerCase();
      base64Data = base64String.replace(
        /^data:image\/[A-Za-z-+\/]+;base64,/,
        ""
      );
    }
  }

  // Ensure filename has the correct extension
  if (!filename.toLowerCase().endsWith(`.${fileType}`)) {
    filename = `${filename}.${fileType}`;
  }

  // Create a buffer from the base64 string
  const imageBuffer = Buffer.from(base64Data, "base64");

  // Ensure the folder exists
  try {
    await mkdirAsync(folderPath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }

  // Determine the full file path
  const filePath = path.join(folderPath, filename);

  // Write the buffer to a file
  try {
    await writeFileAsync(filePath, imageBuffer);
    console.log("Image saved successfully:", filePath);
    return filename;
  } catch (err) {
    console.error("Error saving the image:", err);
    throw err;
  }
}

// array bytes to image converter and saves it as a file
async function saveByteArrayAsImage(
  byteArray,
  folderPath,
  filename,
  fileType = "png"
) {
  // Ensure filename has the correct extension
  if (!filename.toLowerCase().endsWith(`.${fileType}`)) {
    filename = `${filename}.${fileType}`;
  }

  // Create a buffer from the byte array
  const imageBuffer = Buffer.from(byteArray);

  // Ensure the folder exists
  try {
    await fs.mkdir(folderPath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }

  // Determine the full file path
  const filePath = path.join(folderPath, filename);

  // Write the buffer to a file
  try {
    await fs.writeFile(filePath, imageBuffer);
    console.log("Image saved successfully:", filePath);
    return filename;
  } catch (err) {
    console.error("Error saving the image:", err);
    throw err;
  }
}

// create buffer bytes from local image
async function createBufferFromImage(imagePath) {
  try {
    // Read the file
    const buffer = await fs.readFile(imagePath);

    // Convert buffer to byte array
    const byteArray = Array.from(buffer);

    console.log("Image converted to byte array successfully");
    console.log("Byte array length:", byteArray.length);

    return byteArray;
  } catch (error) {
    console.error("Error reading image file:", error);
    throw error;
  }
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Server Port
const PORT = process.env.PORT || 8089;

// Example route
app.get("/verify", async (req, res) => {
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
});

// AWS SECTION STARTS HERE --------------------------------->

app.post("/create-liveness", async (req, res) => {
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
});

app.post("/liveness-results", async (req, res) => {
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
});

app.get("/test", async (req, res) => {
  try {
    // Simple response to test if the server is running
    const filePath1 = path.join(__dirname, "temporary", "posty1.jpeg");
    const filePath2 = path.join(__dirname, "temporary", "maloney1.jpeg");

    const [buffer1, buffer2] = await Promise.all([
      readFileAsync(filePath1),
      readFileAsync(filePath2),
    ]);

    const input = {
      SourceImage: { Bytes: buffer1 },
      TargetImage: { Bytes: buffer2 },
      SimilarityThreshold: 70,
    };

    const command = new CompareFacesCommand(input);
    const response = await compareClient.send(command);

    res.json({
      response,
      message: "Test endpoint is working",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in test endpoint:", error);
    res.status(500).json({ error: "An error occurred during the test" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
