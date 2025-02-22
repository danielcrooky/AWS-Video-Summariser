require('dotenv').config();
const express = require("express");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const sequelize = require('./config/database');
const Video = require('./models/Video');
const path = require('path');
const AWS = require('aws-sdk');
const app = express();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: 'ap-southeast-2'
});

const { SSMClient, GetParameterCommand, GetParametersCommand } = require('@aws-sdk/client-ssm');
const ssmClient = new SSMClient();

app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

sequelize.sync({ force: false });

//gets the port from Parameter Store
async function getPort() {
  try {
    const command = new GetParameterCommand({
      Name: '/n12160334/PORT',
      WithDecryption: false,
    });
    const response = await ssmClient.send(command);
    return response.Parameter.Value;
  } catch (error) {
    throw error;
  }
}
//load the cognito config from parameter store
async function loadConfig() {
  try {
    const command = new GetParametersCommand({
      Names: [
        '/n12160334/COGNITO_USER_POOL_ID',
        '/n12160334/COGNITO_APP_CLIENT_ID',
        '/n12160334/S3_BUCKET_NAME',
        '/n12160334/AWS_REGION',
        '/n12160334/SQS_QUEUE_URL'
      ],
    });

    const response = await ssmClient.send(command);

    response.Parameters.forEach((param) => {
      const paramName = param.Name.split('/').pop();
      process.env[paramName] = param.Value;
    });
  } catch (error) {
    throw error;
  }
}

//start the app
(async () => {
  try {
    await loadConfig();

    const webclientRoute = require("./routes/webclient.js");
    const apiRoute = require("./routes/api.js");

    // Routes
    app.use("/api", apiRoute);
    app.use("/", webclientRoute);

    const portValue = await getPort();
    const port = parseInt(portValue);

    app.listen(port, () => {
      console.log(`Server listening on port ${port}.`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
})();
