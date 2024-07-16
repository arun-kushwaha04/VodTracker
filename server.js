// server for webhook
//
require('dotenv').config()
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const { default: main } = require('./main');
const { TT_TIME, DB_SAVE_TIME } = require("./config")

const UpdateQueue = new PriorityQueue()

const saveToDB = async () => {
  const unlock = await this.mutex()
  if (!UpdateQueue.isEmpty()) {
    const updateBeforeTime = (+new Date()) - TT_TIME

    while (!UpdateQueue.isEmpty()) {
      const element = addToDB(updateBeforeTime)
      if (!element) break

      try {
        await prisma.stream.update({
          where: {
            id: element.streamId
          },
          data: {
            isOnline: element.status
          }
        })
        console.info("Updated status for stream ", element.streamId, element.status)
      }
      catch (err) {
        console.error("Failed to upadte status for stream ", element.streamId, element.status, err)
        UpdateQueue.add(element.streamId, updateBeforeTime, element.status)
      }
    }
  }
  unlock()
  setTimeout(saveToDB, DB_SAVE_TIME)
  return
}


const app = express()
const port = process.env.WEBHOOK_PORT

const prisma = new PrismaClient();

app.use(express.json())

app.get('/', (req, res) => {
  res.send('Web hook running')
})


app.post('/update', async (req, res) => {
  try {
    const body = req.body

    console.log("Update from antmedia", body)

    // streamName = deviceId channelId channelName channelType
    // change channel online status for main stream only
    // id = streamId
    // timestamp = required to make changes in db
    switch (body.action) {
      case "liveStreamStarted":
        console.log("Starting live stream", body.id, body.timestamp)
          (async () => {
            const unlock = await this.mutex()
            UpdateQueue.add(body.id, body.timestamp, true)
            unlock()
          })()
        break;

      case "liveStreamEnded":
        console.log("Live stream ended", body.id, body.timestamp)
          (async () => {
            const unlock = await this.mutex()
            UpdateQueue.add(body.id, body.timestamp, false)
            unlock()
          })()
        break;

      default:
        break;
    }

  } catch (err) {
    console.error(err)
    req.json({
      success: false,
      status: 500
    })
  }
})

app.listen(port, () => {
  console.log(`Webhook started at port ${port}`)
})

saveToDB()
main()
