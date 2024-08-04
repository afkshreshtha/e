const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const serverless = require('serverless-http');
const cors = require('cors');
const fs = require('fs');
const tmp = require('tmp');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const app = express();
const router = express.Router();

app.use(cors({
  origin: 'http://localhost:3000'
}));

app.use(express.json());

// Set the path to the ffmpeg binary using ffmpeg-static
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
      .inputFormat('m4a') // Specify input format if needed
      .outputOptions('-map', '0:a') // Map audio stream
      .outputOptions('-map', '1') // Map image stream
      .outputOptions('-c:v', 'mjpeg') // Video codec for image
      .outputOptions('-id3v2_version', '3') // ID3 version for metadata
      .outputOptions('-metadata:s:v', 'title="Album cover"') // Metadata for cover image
      .outputOptions('-metadata:s:v', 'comment="Cover (front)"')
      .outputOptions('-metadata', `artist="${artists}"`) // Metadata for artist
      .outputOptions('-metadata', `album="${album}"`) // Metadata for album
      .audioCodec('libmp3lame') // Audio codec for MP3
      .toFormat('mp3') // Output format
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
        console.error('Error during conversion:', err.message);
        res.status(500).json({ error: 'Conversion failed' });

        // Clean up temporary files on error
        audioTmpFile.removeCallback();
        imageTmpFile.removeCallback();
        outputTmpFile.removeCallback();
      })
      .save(outputTmpFile.name);

  } catch (err) {
    console.error('Error in the process:', err.message);
    res.status(500).json({ error: 'Process failed' });
  }
});

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);
