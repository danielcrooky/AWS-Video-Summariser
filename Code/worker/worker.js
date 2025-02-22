require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const DeepSpeech = require('deepspeech');
const NLPCloudClient = require('nlpcloud');
const { promisify } = require('util');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    region: 'ap-southeast-2'
  });



const s3 = new AWS.S3();
const sqs = new AWS.SQS();
const queueUrl = process.env.QueueUrl;
const bucketName = '12160334-assignment2';


const MODEL_PATH = './models/deepspeech-0.9.3-models.pbmm';
const SCORER_PATH = './models/deepspeech-0.9.3-models.scorer';
const model = new DeepSpeech.Model(MODEL_PATH);
model.setBeamWidth(500);
model.enableExternalScorer(SCORER_PATH);



// Poll SQS queue for messages
async function pollQueue() {
    while (true) {
        const params = {
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
        };

        try {
            const data = await sqs.receiveMessage(params).promise();

            if (data.Messages && data.Messages.length > 0) {
                const message = data.Messages[0];
                const { videoPath, videoId, apiKey } = JSON.parse(message.Body);

                try {
                    await processVideo({ videoPath, videoId, apiKey });

                    await sqs.deleteMessage({
                        QueueUrl: queueUrl,
                        ReceiptHandle: message.ReceiptHandle,
                    }).promise();

                    console.log(`Video ${videoId} processed successfully.`);
                } catch (error) {
                    console.error(`Error processing video ${videoId}:`, error);

                    await Video.update(
                        { status: 'failed' },
                        { where: { id: videoId } }
                    );
                }
            }
        } catch (error) {
            console.error('Error polling SQS:', error);
        }
    }
}

pollQueue();

// Processing function
async function processVideo({ videoPath, videoId, apiKey }) {
    const outputDir = path.join(__dirname, '/temp');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const videoDownloadPath = path.join(outputDir, `${uuidv4()}-video.mp4`);

    try {
        await downloadFromS3(videoPath, videoDownloadPath);
        const audioPath = await extractAudio(videoDownloadPath, outputDir);
        const transcription = await transcribeAudio(audioPath);
        console.log(transcription);

        const transcriptionFilePath = path.join(outputDir, `${videoId}-transcription.txt`);
        fs.writeFileSync(transcriptionFilePath, transcription);

        const summary = await generateSummaryWithNLPCloud(transcription, apiKey);

        const summaryFilePath = path.join(outputDir, `${videoId}-summary.txt`);
        fs.writeFileSync(summaryFilePath, summary);

        const transcriptionS3Key = `transcriptions/${videoId}-transcription.txt`;
        const summaryS3Key = `summaries/${videoId}-summary.txt`;

        await uploadToS3(transcriptionFilePath, transcriptionS3Key);
        await uploadToS3(summaryFilePath, summaryS3Key);

        await Video.update(
            { status: 'completed', summary_file_id: summaryS3Key },
            { where: { id: videoId } }
        );

        // Clean up temporary files
        await deleteFile(videoDownloadPath);
        await deleteFile(audioPath);
        await deleteFile(transcriptionFilePath);
        await deleteFile(summaryFilePath);

    } catch (error) {
        console.error(`Error processing video ${videoId}:`, error);
        throw error;
    }
}


async function downloadFromS3(s3Key, downloadPath) {
    const params = {
      Bucket: bucketName,
      Key: s3Key,
    };
  
    const fileStream = fs.createWriteStream(downloadPath);
    return new Promise((resolve, reject) => {
      s3.getObject(params)
        .createReadStream()
        .pipe(fileStream)
        .on('close', resolve)
        .on('error', reject);
    });
  }
  
  //upload file to s3
  async function uploadToS3(filePath, s3Key) {
    const fileContent = fs.createReadStream(filePath);
    const params = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ACL: 'private',
    };
  
    return s3.upload(params).promise();
  }
  
  //extract audio from video
  async function extractAudio(videoPath, outputDir) {
    const audioFilename = `${uuidv4()}.wav`;
    const audioPath = path.join(outputDir, audioFilename);
  
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => resolve(audioPath))
        .on('error', reject)
        .run();
    });
  }
  
  //use model to transcribe audio
  async function transcribeAudio(audioPath) {
    return new Promise((resolve, reject) => {
      const modelStream = model.createStream();
      const fileStream = fs.createReadStream(audioPath);
  
      fileStream.on('data', (data) => {
        modelStream.feedAudioContent(data);
      });
  
      fileStream.on('end', () => {
        const transcription = modelStream.finishStream();
        resolve(transcription);
      });
  
      fileStream.on('error', reject);
    });
  }
  
  //use api to generate summary of the audio
  async function generateSummaryWithNLPCloud(transcript, apiKey) {
    try {
      const client = new NLPCloudClient({ model: 'chatdolphin', token: apiKey, gpu: true });
      const response = await client.summarization({ text: transcript });
      return response.data.summary_text;
    } catch (err) {
      throw err;
    }
  }
  
  //remove file after use
  async function deleteFile(filePath) {
    return promisify(fs.unlink)(filePath);
  }
  
  
  //create local copy of the video 
  async function downloadFromS3(s3Key, downloadPath) {
      const params = {
          Bucket: bucketName,
          Key: s3Key,
      };
  
      const fileStream = fs.createWriteStream(downloadPath);
      return new Promise((resolve, reject) => {
          s3.getObject(params)
              .createReadStream()
              .on('error', (err) => {
                  console.error(`${err.message}`);
                  reject(err);
              })
              .pipe(fileStream)
              .on('close', () => {
                  resolve();
              });
      });
  }
  