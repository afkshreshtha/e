const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const ffmpegPath = require('ffmpeg-static');

const execPromise = util.promisify(exec);
const TEMP_DIR = '/tmp'; // Temporary directory for serverless functions

exports.handler = async (event, context) => {
  const allowedOrigins = ['http://localhost:3000', 'https://tunewave.vercel.app', 'https://audichangerr.netlify.app'];

  const origin = event.headers.origin;
  const isAllowedOrigin = allowedOrigins.includes(origin);

  if (isAllowedOrigin) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Allow all origins for testing; adjust as necessary
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ error: 'Origin not allowed' }),
    };
  }

  if (event.httpMethod === 'OPTIONS') {
    // Handle preflight request
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    };
  }

  if (event.httpMethod === 'POST') {
    // Your actual request processing code
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Content-Type': 'audio/mpeg',
      },
      body: fileData.toString('base64'),
      isBase64Encoded: true,
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': origin,
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const body = JSON.parse(event.body);
  const { audioUrl, imageUrl, artists, album } = body;

  const audioPath = path.join(TEMP_DIR, 'input.mp4');
  const imagePath = path.join(TEMP_DIR, 'cover.jpg');
  const outputPath = path.join(TEMP_DIR, 'output.mp3');

  try {
    // Log FFmpeg path
    console.log('FFmpeg path:', ffmpegPath);

    // Check if the FFmpeg binary exists
    if (!fs.existsSync(ffmpegPath)) {
      console.error('FFmpeg binary not found at', ffmpegPath);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': origin,
        },
        body: JSON.stringify({ error: 'FFmpeg binary not found' }),
      };
    }

    // Download audio file
    const audioResponse = await axios({
      url: audioUrl,
      method: 'GET',
      responseType: 'stream',
    });

    await new Promise((resolve, reject) => {
      const audioWriter = fs.createWriteStream(audioPath);
      audioResponse.data.pipe(audioWriter);
      audioWriter.on('finish', resolve);
      audioWriter.on('error', reject);
    });

    // Download image file
    const imageResponse = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream',
    });

    await new Promise((resolve, reject) => {
      const imageWriter = fs.createWriteStream(imagePath);
      imageResponse.data.pipe(imageWriter);
      imageWriter.on('finish', resolve);
      imageWriter.on('error', reject);
    });

    // Log file existence
    console.log('Audio file exists:', fs.existsSync(audioPath));
    console.log('Image file exists:', fs.existsSync(imagePath));

    // Execute ffmpeg command
    await execPromise(`${ffmpegPath} -i ${audioPath} -i ${imagePath} -c:v mjpeg -id3v2_version 3 -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" -metadata artist="${artists.join(', ')}" -metadata album="${album}" ${outputPath}`);

    const fileData = fs.readFileSync(outputPath);
    fs.unlinkSync(audioPath);
    fs.unlinkSync(imagePath);
    fs.unlinkSync(outputPath);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Content-Type': 'audio/mpeg',
      },
      body: fileData.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Conversion failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': origin,
      },
      body: JSON.stringify({ error: 'Conversion failed', details: error.message }),
    };
  }
};
