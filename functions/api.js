const express = require('express')
const axios = require('axios')
const serverless = require('serverless-http')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const ffmpegPath = require('ffmpeg-static')
const util = require('util')
const { exec } = require('child_process')
const execPromise = util.promisify(exec)
const app = express()
const router = express.Router()
const TEMP_DIR = '/tmp'

app.use(
  cors({
    origin: '*',
  }),
)

app.use(express.json())

// Convert audio to MP3
router.post('/convert', async (req, res) => {
  const { audioUrl, imageUrl, artists, album } = req.body
  const audioPath = path.join(TEMP_DIR, 'input.mp4')
  const imagePath = path.join(TEMP_DIR, 'cover.jpg')
  const outputPath = path.join(TEMP_DIR, 'output.mp3')

  if (!audioUrl || !imageUrl || !artists || !album) {
    return res.status(400).json({
      error: 'Audio URL, Image URL, artist name, and album name are required',
    })
  }

  console.log('Audio URL: ' + audioUrl)
  console.log('Image URL: ' + imageUrl)
  console.log('Artists: ' + artists)
  console.log('Album: ' + album)

  try {
    // Log FFmpeg path
    console.log('FFmpeg path:', ffmpegPath)

    // Check if the FFmpeg binary exists
    if (!fs.existsSync(ffmpegPath)) {
      console.error('FFmpeg binary not found at', ffmpegPath)
      return res.status(500).json({ error: 'FFmpeg binary not found' })
    }

    // Download audio file
    const audioResponse = await axios({
      url: audioUrl,
      method: 'GET',
      responseType: 'stream',
    })

    await new Promise((resolve, reject) => {
      const audioWriter = fs.createWriteStream(audioPath)
      audioResponse.data.pipe(audioWriter)
      audioWriter.on('finish', resolve)
      audioWriter.on('error', reject)
    })
    // Download image file
    const imageResponse = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream',
    })

    await new Promise((resolve, reject) => {
      const imageWriter = fs.createWriteStream(imagePath)
      imageResponse.data.pipe(imageWriter)
      imageWriter.on('finish', resolve)
      imageWriter.on('error', reject)
    })

    console.log('Audio file exists:', fs.existsSync(audioPath))
    console.log('Image file exists:', fs.existsSync(imagePath))

    // Execute ffmpeg command
    await execPromise(
      `${ffmpegPath} -i ${audioPath} -i ${imagePath} -c:v mjpeg -id3v2_version 3 -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)" -metadata artist="${artists.join(
        ', ',
      )}" -metadata album="${album}" ${outputPath}`,
    )
    const fileData = fs.readFileSync(outputPath)
    fs.unlinkSync(audioPath)
    fs.unlinkSync(imagePath)
    fs.unlinkSync(outputPath)

    return res.status(200).json({
      audioUrl,
      imageUrl,
      artists,
      album,
      audioData: fileData.toString('base64'),
    })
  } catch (err) {
    console.error('Conversion Failed', err.message)
    res.status(500).json({ error: 'Conversation Failed' })
  }
})

app.use('/.netlify/functions/api', router)
module.exports.handler = serverless(app)
