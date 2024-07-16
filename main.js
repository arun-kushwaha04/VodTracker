
require('dotenv').config()

const fs = require('fs-extra');
const path = require('path');
const { getVideoDurationInSeconds } = require('get-video-duration')
const { VodService } = require('./db');

const { FOLDER_PATH, TOKEN, CHECK_INTERVAL, PREV_FILES, RECORDED_SEGMENT_SIZE, DELAY, SYNC_TIME, ERR_SYNC_TIME } = require("./config")



let prevFailedFiles = []
const streamsUnableToStart = new Set() // this array has all stream which were were recording earlier but are unable to re-record after stopping we need to explicitly rehandle it.


const serverAddr = process.env.SERVER_ADDR

const serverUpAddr = serverAddr + '/version'
const activeStreamUri = serverAddr + '/broadcasts/active-live-stream-count'
const getVodList = (search) => serverAddr + `/vods/list/0/10?search=${search}`
const streamListUri = (off, size) => serverAddr + `/broadcasts/list/${off}/${size}`
const activeRecordingStatus = (id, record) => serverAddr + `/broadcasts/${id}/recording/${record}`

const streamPerPage = 50

const delay = ms => {
  return new Promise(async resolve => {
    setTimeout(() => resolve(), ms)
  })
}

const db = new VodService()

function getThresholdTime() {
  const now = new Date();
  return new Date(now.getTime() - PREV_FILES);
}

async function scanFolder() {
  const files = await fs.readdir(FOLDER_PATH);
  const ttTime = getThresholdTime();

  const recentFiles = [];

  for (const file of files) {
    if (path.extname(file).toLowerCase() === '.mp4') {
      const filePath = path.join(FOLDER_PATH, file);
      const stats = await fs.stat(filePath);

      if (stats.birthtime >= ttTime) {
        recentFiles.push({
          name: file,
          path: filePath,
          size: stats.size,
          createdAt: stats.birthtime,
        });
      }

    }
  }

  return recentFiles;
}

function extractFileInfo(fileName) {
  const [streamId, year, month, day] = fileName.split('-');

  return {
    streamId,
    year,
    month,
    day
  };
}

async function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    getVideoDurationInSeconds(filePath).then((duration) => {
      resolve(duration)
    }).catch(err => {
      reject(err)
    })
  });
}

async function getVodId(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(getVodList(file.name), {
        headers: {
          Authorization: TOKEN
        }
      })
      const data = await res.json()
      if (data.length == 0) throw new Error("Failed to get vods")
      resolve(data[0].vodId)
    } catch (err) {
      console.log("Error while getting vod id for", file.name, err)
      reject(file.name)
    }
  })
}


async function storeFileInfo(file, fileInfo, duration, vodId) {
  return new Promise(async (resolve, reject) => {

    try {
      const { streamId } = fileInfo;
      const fileUrl = file.name;

      const channel = await db.getChannelInfo(streamId)

      if (channel === null) return

      const value = await db.getRecordByVodId(vodId)
      if (value != null) {
        resolve(false)
        return
      }

      await db.createRecord(
        vodId,
        channel.Channel.deviceId,
        channel.id,
        fileUrl,
        file.size,
        duration
      )

      console.log("Stored vod", file.name)
      resolve(true)
    } catch (err) {
      console.log("Failed to add this vod to db", file.name, err)
      reject(err)
    }

  })
}

const addVodToStore = (file) => {
  return new Promise(async (resolve, reject) => {
    try {
      const fileInfo = extractFileInfo(file.name);
      const duration = await getVideoDuration(file.path);
      const vodId = await getVodId(file)
      await storeFileInfo(file, fileInfo, duration, vodId);
      resolve(true)
    } catch (err) {
      console.log(err)
      reject(file)
    }
  })
}

async function addVodsToDB() {
  console.log(new Date(Date.now()).toLocaleTimeString(), "Starting Vod saving createVods");

  let failed = 0;
  try {
    const serverUp = await isServerUp()

    let recentFiles = await scanFolder();

    if (!serverUp) {
      console.log("Ant Media not up, exiting")
      prevFailedFiles = [...recentFiles, ...prevFailedFiles]
      return
    }

    recentFiles = [...prevFailedFiles, ...recentFiles]
    console.log(`Found ${recentFiles.length} vods to be added to database`)

    prevFailedFiles = []
    const promise = []

    for (const file of recentFiles) {
      promise.push(addVodToStore(file))
    }

    const data = await Promise.allSettled(promise)

    data.forEach(res => {
      if (res.status !== 'fulfilled') {
        failed++
        prevFailedFiles.push(res.reason)
      }
    })

    console.info(`Added VODs failed for ${failed} VODs, will try next time`);
    if (failed > 0) throw new Error("Failed adding some vods")
    setTimeout(addVodsToDB, CHECK_INTERVAL)

  } catch (error) {
    console.log(error)
    console.error(`Falied to add ${failed} VODs, will try next time`);
    setTimeout(addVodsToDB, CHECK_INTERVAL / 4)
  }
}

const toggleStream = (id, record) => {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(activeRecordingStatus(id, record), {
        method: 'PUT',
        headers: {
          Authorization: TOKEN
        }
      })

      const data = await res.json()

      // console.log('Stream toggle data', data, id, record)
      if (data.success) return resolve(id)
      throw new Error(`${id} Unable to toggle stream status`)
    } catch (err) {
      console.log(err)

      return reject(id)
    }
  })
}

const isServerUp = () => {
  return new Promise(async (resolve) => {
    try {
      const res = await fetch(serverUpAddr, {
        headers: {
          Authorization: TOKEN
        }
      })

      if (res.status === 200) resolve(true)
      else throw new Error("Server responsed with no-200 error code")

    } catch (err) {
      console.log("Server down")
      resolve(false)
    }
  })
}

const createVods = async () => {
  console.log(new Date(Date.now()).toLocaleTimeString(), "Starting Vod creation createVods", streamsUnableToStart.size, 'camera were not able to start recording last time')

  const serverUp = await isServerUp()

  if (!serverUp) {
    console.log("Ant Media not up, exiting")
    return
  }

  const activeStreams = (
    await (
      await fetch(activeStreamUri, {
        headers: {
          Authorization: TOKEN
        }
      })
    ).json()
  ).number

  console.log('Currently active streams ', activeStreams)

  let promises = []

  const pages = Math.ceil(activeStreams / streamPerPage)

  for (let i = 0; i < pages; i++) {
    const promise = new Promise(async (resolve, reject) => {
      try {
        console.log('Query result for page', i)
        const renableStreams = []
        const offset = i * streamPerPage
        const size = streamPerPage

        const streams = await (
          await fetch(streamListUri(offset, size), {
            headers: {
              Authorization: TOKEN
            }
          })
        ).json()

        let innerPromise = []

        streams.forEach(s => {
          if (s.mp4Enabled == 1) {
            innerPromise.push(toggleStream(s.streamId, false))
          }
        })

        let data = await Promise.allSettled(innerPromise)

        console.log('-----')
        data.forEach(result => {
          if (result.status === 'fulfilled') {
            console.log(result.value, 'recording stopped')
            renableStreams.push(result.value)
          }
        })

        await delay(DELAY)

        // todo
        // renabling the stop streams, if a stream was not able to be stopped due to some reason we will not start it as it is already running

        innerPromise = []

        renableStreams.forEach(id => {
          innerPromise.push(toggleStream(id, true))
        })

        data = await Promise.allSettled(innerPromise)
        console.log('-----')
        data.forEach(result => {
          if (result.status !== 'fulfilled') {
            console.log(result.reason, 'recording unable to start')
            streamsUnableToStart.add(result.reason)
          }
        })

        resolve(true)
      } catch (err) {
        console.log(err)
        reject(false)
      }
    })

    promises.push(promise)
  }

  await Promise.allSettled(promises)

  promises = []

  await delay(DELAY)

  streamsUnableToStart.forEach(id => {
    promises.push(toggleStream(id, true))
  })

  const data = await Promise.allSettled(promises)

  console.log('-----')
  data.forEach(result => {
    if (result.status === 'fulfilled') {
      console.log(result.value, 'recording started')
      streamsUnableToStart.delete(result.value)
    }
  })

  setTimeout(createVods, RECORDED_SEGMENT_SIZE)
}

async function syncStorage() {
  try {
    const files = await scanFolder()

    for (let i = 0; i < files.length; i++) {

      const file = await db.findRecordByFileName(files[i].name)

      if (!file) {
        fs.unlink(path.join(FOLDER_PATH, file), (err) => {
          if (err) console.error("Unable to remove file, not enough permission")
        })
      }
    }
    setTimeout(syncStorage, SYNC_TIME)
  } catch (err) {
    console.log("Failed to synchronize db", err)
    setTimeout(syncStorage, ERR_SYNC_TIME)
  }
}

const main = () => {
  createVods().then(() => {
    addVodsToDB()
    syncStorage()
  })
}

module.exports.main = main
