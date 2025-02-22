const express = require('express');
const { fork } = require('child_process');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const { authenticateToken, authorizeAdmin } = require('../auth');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const client = new SecretsManagerClient({ region: 'ap-southeast-2' });

AWS.config.update({ region: process.env.AWS_REGION });
const sqs = new AWS.SQS();
const queueUrl = process.env.SQS_QUEUE_URL;

//login authentication
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (authenticateUser(username, password)) {
        const token = generateAccessToken(username);
        res.status(200).json({ token });
    } else {
        res.status(403).json({ error: "Invalid credentials" });
    }
});

//s3 bucket for storing videos
const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;

//route for uploading videos
router.post('/videos', authenticateToken, async (req, res) => {
    try {
        if (!req.files || !req.files.uploadFile) {
            return res.status(400).json({ error: "No file was uploaded." });
        }

        const file = req.files.uploadFile;
        const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv'];

        if (!validTypes.includes(file.mimetype)) {
            return res.status(400).json({ error: "Invalid file type." });
        }

        const uniqueFilename = `${uuidv4()}-${file.name}`;

        const params = {
            Bucket: bucketName,
            Key: uniqueFilename,
            Body: file.data,
            ContentType: file.mimetype,
            ACL: 'private',
        };

        const s3Upload = await s3.upload(params).promise();


        const video = await Video.create({
            title: req.body.title || 'Untitled Video',
            uploaded_by: req.user["cognito:username"],
            filepath: uniqueFilename
        });

        res.status(201).json({ message: "Video uploaded successfully", video });
    } catch (error) {
        console.error("Error uploading video:", error.message);
        res.status(500).json({ error: "Failed to upload video." });
    }
});



//route for retrieving videos
router.get('/videos', authenticateToken, async (req, res) => {
    try {
      const userGroups = req.user["cognito:groups"] || [];
      const isAdmin = userGroups.includes("admin");
  
      const videos = await Video.findAll({
        where: isAdmin ? {} : { uploaded_by: req.user.username },
      });
  
      res.status(200).json({ videos, isAdmin });
    } catch (error) {
      console.error('Error fetching videos:', error);
      res.status(500).json({ error: 'Failed to fetch videos.' });
    }
});


//route for deleting videos
router.delete('/videos/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const videoId = req.params.id;
  
    try {
      const video = await Video.findByPk(videoId);
  
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
  
      await Video.destroy({ where: { id: videoId } });
  
      const params = {
        Bucket: bucketName,
        Key: video.filepath,
      };
      await s3.deleteObject(params).promise();
  
      res.json({ message: 'Video deleted successfully' });
    } catch (error) {
      console.error('Error deleting video:', error);
      res.status(500).json({ error: 'Failed to delete video.' });
    }
});


//check the status of the video while processing
router.get('/status/:videoId', authenticateToken, async (req, res) => {
    const videoId = req.params.videoId;

    try {
        const video = await Video.findByPk(videoId);

        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        if (video.summary_file_id) {
            res.status(200).json({ status: 'completed', summary_file_id: video.summary_file_id });
        } else {
            res.status(200).json({ status: 'processing' });
        }

    } catch (error) {
        console.error("Error checking video status:", error);
        res.status(500).json({ error: "Failed to check video status." });
    }
});

//gets the api key from the secret manager
async function getApiKey() {
    const secret_name = "n12160334-assignment";
    try {
      const response = await client.send(new GetSecretValueCommand({ SecretId: secret_name }));
      const secret = response.SecretString;
      const secretValue = JSON.parse(secret);
      return secretValue.NLP_CLOUD_API_KEY;
    } catch (error) {
      console.error("Error retrieving secret:", error);
      throw error;
    }
}
//Updated route that sends the video to the SQS queue for processing
router.post('/process/:videoId', authenticateToken, async (req, res) => {
    const videoId = req.params.videoId;

    try {
        const video = await Video.findByPk(videoId);

        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        const apiKey = await getApiKey();

        video.status = 'processing';
        await video.save();

        const messageBody = JSON.stringify({
            videoPath: video.filepath,
            videoId: video.id,
            apiKey: apiKey,
        });

        const params = {
            QueueUrl: queueUrl,
            MessageBody: messageBody,
        };

        await sqs.sendMessage(params).promise();

        res.status(202).json({ message: "Video queued for processing" });
    } catch (error) {
        console.error("Error queuing video for processing:", error);
        res.status(500).json({ error: "Failed to queue video for processing." });
    }
});



//returns the video url
router.get('/video-url', authenticateToken, (req, res) => {
    const { filepath } = req.query;

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: filepath,
        Expires: 60
    };
    const url = s3.getSignedUrl('getObject', params);
    res.json({ url });
});

//returns the summary url
router.get('/summary-url', authenticateToken, async (req, res) => {
    const { videoId } = req.query;
    const video = await Video.findByPk(videoId);

    if (!video || !video.summary_file_id) {
        return res.status(404).json({ error: 'Summary not found' });
    }


    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: video.summary_file_id,
        Expires: 60 
    };

    const url = s3.getSignedUrl('getObject', params);
    res.json({ url });
});


module.exports = router;
