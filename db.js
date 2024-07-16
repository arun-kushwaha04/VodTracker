import { PrismaClient } from '@prisma/client';

export class StreamService {
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

export class VodService {
  constructor() {
    this.prisma = new PrismaClient();
  }

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
