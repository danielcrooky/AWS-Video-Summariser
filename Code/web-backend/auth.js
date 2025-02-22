const { CognitoJwtVerifier } = require("aws-jwt-verify");
require('dotenv').config();
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "id",
  clientId: process.env.COGNITO_APP_CLIENT_ID,
});

//authenticates token using cognito user pool and groups
const authenticateToken = async (req, res, next) => {
   let token = null;
 
   const authHeader = req.headers["authorization"];
   if (authHeader) {
     token = authHeader.split(" ")[1];
   }
   if (!token && req.cookies && req.cookies.token) {
     token = req.cookies.token;
   }
 
   if (!token) {
     return res.sendStatus(401);
   }
   try {
     const payload = await verifier.verify(token); 
     req.user = {
       ...payload,
       username: payload["cognito:username"],
         groups: payload["cognito:groups"] || [],
     };
     next();
   } catch (err) {
     return res.sendStatus(401);
   }
};
 
//check if user is an admin if they are in the admin group
const authorizeAdmin = (req, res, next) => {
   const userGroups = req.user["cognito:groups"] || [];
   if (userGroups.includes("admin")) {
     next();
   } else {
     res.status(403);
   }
};

const authenticateCookie = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect("/login");
  }
  try {
    const payload = await verifier.verify(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.redirect("/login");
  }
};
//clear cookie on logout
const logout = (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.redirect('/login');
};

module.exports = { authenticateCookie, authenticateToken, authorizeAdmin, logout };
