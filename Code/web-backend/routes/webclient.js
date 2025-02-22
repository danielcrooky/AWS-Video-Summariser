const express = require("express");
const router = express.Router();
const auth = require("../auth.js");
const path = require("path");
const fs = require("fs");
const FormData = require('form-data');
const fetch = require('node-fetch');
const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
require('dotenv').config();
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });


router.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/login.html"));
});

//handles user login for web client
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
  
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_APP_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });
  
    try {
      const response = await cognitoClient.send(command);
      const idToken = response.AuthenticationResult.IdToken;
  
      res.cookie("token", idToken, {
        httpOnly: true,
        secure: false,
        path: "/",
      });
  
      res.redirect("/");
    } catch (err) {
      console.error("Login error:", err);
      res.status(401).send("Invalid credentials");
    }
});
  

//logs out user
router.get("/logout", auth.authenticateCookie, (req, res) => {
    auth.logout(req, res);
});

//loads the upload page if logged in
router.get("/upload", auth.authenticateCookie, (req, res) => {
    res.sendFile(path.join(__dirname, "../public/upload.html"));
});

//uploads video
router.post("/upload", auth.authenticateCookie, async (req, res) => {
    try {
        if (!req.files || !req.files.uploadFile) {
            return res.status(400).send("No file was uploaded.");
        }

        const file = req.files.uploadFile;


        const formData = new FormData();
        formData.append('uploadFile', file.data, file.name); 
        formData.append('title', req.body.title);


        const response = await fetch('http://localhost:3000/api/videos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${req.cookies.token}`,
            },
            body: formData
        });

        if (response.ok) {
            res.redirect("/upload");
        } else {
            const errorData = await response.json();
            console.error("Upload failed:", errorData);
            res.status(400).send("Failed to upload video.");
        }
    } catch (error) {
        console.error("Error during video upload:", error);
        res.status(500).send("Internal server error.");
    }
});

//loads signup page
router.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/signup.html"));
});
  
//handles user signup
router.post("/signup", async (req, res) => {
    const { username, password, email } = req.body;
  
    const command = new SignUpCommand({
      ClientId: process.env.COGNITO_APP_CLIENT_ID,
      Username: username,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    });
  
    try {
      await cognitoClient.send(command);
      res.status(200).send("Sign-up successful! Please check your email for confirmation.");
    } catch (err) {
      console.error("Sign-up error:", err);
      res.status(400).send("Error during sign-up");
    }
});

//loads confirmation page
router.get("/confirm", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/confirm.html"));
});
  
//handles email confirmation - not tested due to aws issue
router.post("/confirm", async (req, res) => {
    const { username, code } = req.body;
  
    const command = new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_APP_CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
    });
  
    try {
      await cognitoClient.send(command);
      res.status(200).send("Email confirmed! You can now log in.");
    } catch (err) {
      console.error("Confirmation error:", err);
      res.status(400).send("Error during confirmation");
    }
});
router.use("/", auth.authenticateCookie, express.static(path.join(__dirname, "../public")));

module.exports = router;
