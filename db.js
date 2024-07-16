const { PrismaClient } = require('@prisma/client')

class StreamService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  updateRecord = (id, isOnline) => this.prisma.stream.update({
    where: {
      id
    },
    data: {
      isOnline
    }
  })
}

class VodService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  getStream = (streamId) => this.prisma.stream.findUnique({
    where: {
      id: streamId
    },
    select: {
      id: true
    }
  })

  getChannelInfo = (streamId) => this.prisma.stream.findUnique({
    where: {
      id: streamId
    },
    select: {
      Channel: true
    }
  })

  getRecordByVodId = (vodId) => this.prisma.recording.findFirst({
    where: {
      vodId: vodId
    }
  })

  createRecord = (vodId, deviceId, channelId, fileUrl, size, duration) => this.prisma.recording.create({
    data: {
      vodId,
      deviceId,
      channelId,
      fileUrl,
      size,
      duration,
    },
  });

  findRecordByFileName = (fileUrl) => this.prisma.recording.findUnique({
    where: {
      fileUrl
    }
  })

}

module.exports = {
  VodService,
  StreamService
}
