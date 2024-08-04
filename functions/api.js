const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const stream = require('stream');
const serverless = require("serverless-http");
const cors = require('cors');

const app = express();
const router = express.Router();
const port = 3001;

app.use(cors({
  origin: "http://localhost:3000"
}));

app.use(express.json());

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

    const audioStream = new stream.PassThrough();
    const imageStream = new stream.PassThrough();
    
    audioStream.end(audioBuffer);
    imageStream.end(imageBuffer);

    const outputBuffers = [];

    ffmpeg()
      .input(audioStream)
      .input(imageStream)
      .inputFormat('m4a')
      .inputFormat('mjpeg')
      .outputOptions('-map', '0:a')
      .outputOptions('-map', '1')
      .outputOptions('-c:v', 'mjpeg')
      .outputOptions('-id3v2_version', '3')
      .outputOptions('-metadata:s:v', 'title="Album cover"')
      .outputOptions('-metadata:s:v', 'comment="Cover (front)"')
      .outputOptions('-metadata', `artist="${artists}"`)
      .outputOptions('-metadata', `album="${album}"`)
      .format('mp3')
      .on('start', (cmd) => {
        console.log('Started ffmpeg with command:', cmd);
      })
      .on('end', () => {
        console.log('Conversion finished');
        const outputBuffer = Buffer.concat(outputBuffers);
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Disposition', 'attachment; filename=output.mp3');
        res.send(outputBuffer);
      })
      .on('error', (err) => {
        console.error('Error during conversion', err);
        res.status(500).json({ error: 'Conversion failed' });
      })
      .pipe(new stream.PassThrough(), { end: true })
      .on('data', (chunk) => {
        outputBuffers.push(chunk);
      });

  } catch (err) {
    console.error('Error in the process', err);
    res.status(500).json({ error: 'Process failed' });
  }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);
