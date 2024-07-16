require('dotenv').config()

export const FOLDER_PATH = process.env.VOD_PATH; // path where vods are stored
export const TOKEN = process.env.TOKEN  // token of media server
export const CHECK_INTERVAL = 1000 * 60 * 17 // interval to check for new vods
export const PREV_FILES = 1000 * 60 * 34 // consider vods created after CURRENT_TIME - PREV_FILE
export const RECORDED_SEGMENT_SIZE = 1000 * 60 * 30 // lenght of recorded vods
export const DELAY = 1000 // random dealy for sync increase this, to rate limit api calls
export const SYNC_TIME = 1000 * 60 * 30 // interval for syncing vods with database
export const ERR_SYNC_TIME = 1000 * 60 * 1 // interval after with syncronizer will restart after a failure

//threshold time, change will be reflect after this time
export const TT_TIME = 1000 * 30 //30s // time after which element in update queue will be considered for update in db
export const DB_SAVE_TIME = 1000 * 60 //30s // interval after which we update status for elements in queue
