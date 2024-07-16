// priority queue implementation
class QueueElement {
  constructor(streamId, timestamp, status) {
    this.streamId = streamId
    this.timestamp = timestamp
    this.status = status
  }
}

class Mutex {
  constructor() {
    this.current = Promise.resolve();
  }

  lock() {
    let _resolve;
    const p = new Promise(resolve => {
      _resolve = () => resolve();
    });
    const unlock = this.current.then(() => _resolve);
    this.current = p;
    return unlock;
  }
}

class PriorityQueue {
  constructor() {
    this.items = []
    this.mutex = new Mutex()
  }
  Lock() {
    return this.mutex.lock()
  }
  add(streamId, timestamp, status) {
    let element = new QueueElement(streamId, timestamp, status)
    let contain = false

    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].streamId === element.streamId) {
        this.items.splice(i, 0)
        contain = true
        break
      }
      if (this.items[i].timestamp > element.timestamp) {
        this.items.splice(i, 0, element)
        contain = true
        break
      }
    }

    if (!contain) {
      this.items.push(element)
    }

    console.log("New stream added to queue", streamId, timestamp, status)
  }
  remove() {
    let element
    if (this.isEmpty()) return null
    element = this.items.shift()
    return element
  }
  async isEmpty() {
    return this.items.length === 0
  }
  front() {
    if (this.isEmpty) return null
    return this.items[0]
  }
  // return if threshold timestamp has reached
  addToDB(tt) {
    let f = this.front()
    if (f && f.timestamp <= tt) return this.remove()
    return null
  }
}

module.exports = {
  PriorityQueue
}
