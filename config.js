require('dotenv').config()

module.exports.FOLDER_PATH = process.env.VOD_PATH; // path where vods are stored
module.exports.TOKEN = process.env.TOKEN  // token of media server
module.exports.CHECK_INTERVAL = 1000 * 60 * 17 // interval to check for new vods
module.exports.PREV_FILES = 1000 * 60 * 34 // consider vods created after CURRENT_TIME - PREV_FILE
module.exports.RECORDED_SEGMENT_SIZE = 1000 * 60 * 30 // lenght of recorded vods
module.exports.DELAY = 1000 // random dealy for sync increase this, to rate limit api calls
module.exports.SYNC_TIME = 1000 * 60 * 30 // interval for syncing vods with database
module.exports.ERR_SYNC_TIME = 1000 * 60 * 1 // interval after with syncronizer will restart after a failure

//threshold time, change will be reflect after this time
module.exports.TT_TIME = 1000 * 30 //30s // time after which element in update queue will be considered for update in db
module.exports.DB_SAVE_TIME = 1000 * 60 //60s // interval after which we update status for elements in queue
