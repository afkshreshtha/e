const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const serverless = require('serverless-http');
const cors = require('cors');
const fs = require('fs');
const tmp = require('tmp');
const path = require('path');

const app = express();
const router = express.Router();

app.use(cors({
  origin: 'http://localhost:3000'
}));

app.use(express.json());

// Set the custom path to the ffmpeg binary
const ffmpegPath = path.join(__dirname, 'functions/bin', 'ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// Function to download a file from a URL into a buffer
const downloadFileToBuffer = async (url) => {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
  });
  return response.data;
};

router.post('/convert', async (req, res) => {
  const { audioUrl, imageUrl, artists, album } = req.body;

  if (!audioUrl || !imageUrl || !artists || !album) {
    return res.status(400).json({ error: 'Audio URL, Image URL, artist name, and album name are required' });
  }

  try {
    const audioBuffer = await downloadFileToBuffer(audioUrl);
    const imageBuffer = await downloadFileToBuffer(imageUrl);

    const audioTmpFile = tmp.fileSync();
    const imageTmpFile = tmp.fileSync();
    const outputTmpFile = tmp.fileSync();

    fs.writeFileSync(audioTmpFile.name, audioBuffer);
    fs.writeFileSync(imageTmpFile.name, imageBuffer);

    ffmpeg()
      .input(audioTmpFile.name)
      .input(imageTmpFile.name)
      .outputOptions('-map', '0:a')
      .outputOptions('-map', '1')
      .outputOptions('-c:v', 'mjpeg')
      .outputOptions('-id3v2_version', '3')
      .outputOptions('-metadata:s:v', 'title="Album cover"')
      .outputOptions('-metadata:s:v', 'comment="Cover (front)"')
      .outputOptions('-metadata', `artist="${artists}"`)
      .outputOptions('-metadata', `album="${album}"`)
      .save(outputTmpFile.name)
      .on('start', (cmd) => {
        console.log('Started ffmpeg with command:', cmd);
      })
      .on('end', () => {
        console.log('Conversion finished');
        const outputBuffer = fs.readFileSync(outputTmpFile.name);
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Disposition', 'attachment; filename=output.mp3');
        res.send(outputBuffer);

        // Clean up temporary files
        audioTmpFile.removeCallback();
        imageTmpFile.removeCallback();
        outputTmpFile.removeCallback();
      })
      .on('error', (err) => {
        console.error('Error during conversion', err);
        res.status(500).json({ error: 'Conversion failed' });

        // Clean up temporary files on error
        audioTmpFile.removeCallback();
        imageTmpFile.removeCallback();
        outputTmpFile.removeCallback();
      });

  } catch (err) {
    console.error('Error in the process', err);
    res.status(500).json({ error: 'Process failed' });
  }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);
