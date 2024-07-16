// server for webhook
//
require('dotenv').config()
const express = require('express');
const { main } = require('./main');
const { TT_TIME, DB_SAVE_TIME } = require("./config");
const { StreamService } = require('./db');
const { PriorityQueue } = require('./queue');

const UpdateQueue = new PriorityQueue()
const db = new StreamService()

const saveToDB = async () => {
  const unlock = await UpdateQueue.Lock()
  let count = 0;
  if (!UpdateQueue.isEmpty()) {
    const updateBeforeTime = (+new Date()) - TT_TIME

    while (!UpdateQueue.isEmpty()) {
      const element = addToDB(updateBeforeTime)
      if (!element) break

      try {
        await db.updateRecord(element.streamId, element.status)
        count++
        console.info("Updated status for stream ", element.streamId, element.status)
      }
      catch (err) {
        console.error("Failed to upadte status for stream ", element.streamId, element.status, err)
        UpdateQueue.add(element.streamId, updateBeforeTime, element.status)
      }
    }
  }
  unlock()
  console.log(count, "Update stream status from queue",)
  setTimeout(saveToDB, DB_SAVE_TIME)
  return
}


const app = express()
const port = process.env.WEBHOOK_PORT

app.use(express.json())

app.get('/', (req, res) => {
  res.send('Web hook running')
})

const addToQueue = async (body, status) => {
  const unlock = await UpdateQueue.Lock()
  UpdateQueue.add(body.id, body.timestamp, status)
  unlock()
}

app.post('/update', async (req, res) => {
  try {
    const body = req.body

    // streamName = deviceId channelId channelName channelType
    // change channel online status for main stream only
    // id = streamId
    // timestamp = required to make changes in db
    switch (body.action) {
      case "liveStreamStarted":
        // console.log("Starting live stream", body.id, body.timestamp)
        addToQueue(body, true)
        break;

      case "liveStreamEnded":
        // console.log("Live stream ended", body.id, body.timestamp)
        addToQueue(body, false)
        break;

      default:
        break;
    }

    res.status(200).send("Success")

  } catch (err) {
    console.error(err)
    res.status(500).send("Error")
  }
})

app.listen(port, () => {
  console.log(`Webhook started at port ${port}`)
})

saveToDB()
main()
