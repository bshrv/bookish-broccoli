const express = require("express");

const { createliveness } = require("../controllers/aws-create-controller.js");

const awsCreateRouter = express.Router();

awsCreateRouter.post("", createliveness);

module.exports = awsCreateRouter;
