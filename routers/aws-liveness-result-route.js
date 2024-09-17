const express = require("express");

const {
  livenessresult,
} = require("../controllers/aws-liveness-result-controller.js");

const awsLivenessResultRouter = express.Router();

awsLivenessResultRouter.post("", livenessresult);

module.exports = awsLivenessResultRouter;
