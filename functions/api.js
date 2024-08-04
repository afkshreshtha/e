const express = require('express')
const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const app = express()
const port = 3001
const cors = require('cors')
app.use(cors({
  origin:"http://localhost:3000"
}))

// Middleware to parse JSON bodies
app.use(express.json())

// Function to download a file from a URL
const downloadFile = async (url, outputPath) => {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  })

  const writer = fs.createWriteStream(outputPath)

  return new Promise((resolve, reject) => {
    response.data.pipe(writer)
    let error = null
    writer.on('error', (err) => {
      error = err
      writer.close()
      reject(err)
    })
    writer.on('close', () => {
      if (!error) {
        resolve()
      }
    })
  })
}

// Endpoint to handle M4A to MP3 conversion with cover image, artist, and album
app.post('/convert', async (req, res) => {
  const { audioUrl, imageUrl, artists, album } = req.body

  if (!audioUrl) {
    return res.status(400).json({ error: 'Audio URL is required' })
  }

  if (!imageUrl) {
    return res.status(400).json({ error: 'Image URL is required' })
  }

  if (!artists) {
    return res.status(400).json({ error: 'Artist name is required' })
  }

  if (!album) {
    return res.status(400).json({ error: 'Album name is required' })
  }

  const inputPath = path.join(__dirname, 'input.m4a')
  const outputPath = path.join(__dirname, 'output.mp3')
  const imagePath = path.join(__dirname, 'cover.jpg')

  try {
    // Download the audio and image files
    await downloadFile(audioUrl, inputPath)
    await downloadFile(imageUrl, imagePath)

    // Check if the files are valid
    if (!fs.existsSync(inputPath)) {
      throw new Error('Audio file download failed')
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error('Image file download failed')
    }

    // Convert M4A to MP3 and add the image as cover
    ffmpeg()
      .input(inputPath)
      .input(imagePath)
      .outputOptions('-map', '0:a')
      .outputOptions('-map', '1')
      .outputOptions('-c:v', 'mjpeg')
      .outputOptions('-id3v2_version', '3')
      .outputOptions('-metadata:s:v', 'title="Album cover"')
      .outputOptions('-metadata:s:v', 'comment="Cover (front)"')
      .outputOptions('-metadata', `artist="${artists}"`) // Add artist metadata
      .outputOptions('-metadata', `album="${album}"`) // Add album metadata
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('Started ffmpeg with command:', cmd)
      })
      .on('end', () => {
        console.log('Conversion finished')
        res.download(outputPath, (err) => {
          if (err) {
            console.error('Error downloading the file', err)
            res.status(500).json({ error: 'File download failed' })
          } else {
            // Clean up files after download
            fs.unlinkSync(inputPath)
            fs.unlinkSync(outputPath)
            fs.unlinkSync(imagePath)
          }
        })
      })
      .on('error', (err) => {
        console.error('Error during conversion', err)
        res.status(500).json({ error: 'Conversion failed' })
      })
      .run()
  } catch (err) {
    console.error('Error in the process', err)
    res.status(500).json({ error: 'Process failed' })
  }
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})