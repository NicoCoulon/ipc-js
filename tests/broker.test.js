
const { pause } = require('./common')
const { createBroker } = require('../lib/broker')
const { createChannel } = require('../lib/channel')
const fs = require('fs')
const path = require('path')
const pubsub = require('../lib/pubsub')

const logger = require('../lib/logger')(__filename)

const STORE_PATH = 'C:\\topics3'
try { fs.mkdirSync(STORE_PATH) } catch (_) { }

function init (topic) {
  try { fs.mkdirSync(STORE_PATH) } catch (_) { }
  try { fs.rmdirSync(path.join(STORE_PATH, topic), { recursive: true }) } catch (error) { logger.debug(error.stack) }
}

test('it works when subscriptions are made before publishing', async () => {
  const topicName = 'brokerTest1'
  const port = 8889
  init(topicName)
  const channel1 = createChannel('::', port)
  const channel2 = createChannel('::', port)
  await pause(150)

  const messages = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const received = []

  const broker = createBroker(port, 2000, STORE_PATH)

  const s1 = pubsub.createPubSubClient(channel1)
  s1.subscribe(topicName, message => {
    received.push(message)
  })

  await pause(100)
  const p1 = pubsub.createPubSubClient(channel2)
  messages.forEach(message => p1.publish(topicName, message))

  await pause(100)
  broker.close()
  p1.destroy()
  s1.destroy()
  expect(received).toStrictEqual(messages)
})

test('it publishes to multiple subscribers', async () => {
  const topicName = 'brokerTest2'
  const port = 8889
  init(topicName)
  await pause(50)

  const messages = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const received1 = []
  const received2 = []

  const broker = createBroker(port, 2000, STORE_PATH)

  const s1 = pubsub.createPubSubClient(createChannel('::', port))
  s1.subscribe(topicName, message => {
    received1.push(message)
  })

  const s2 = pubsub.createPubSubClient(createChannel('::', port))
  s2.subscribe(topicName, message => {
    received2.push(message)
  })

  await pause(100)
  const p1 = pubsub.createPubSubClient(createChannel('::', port))
  messages.forEach(message => p1.publish(topicName, message))

  await pause(200)
  broker.close()
  p1.destroy()
  await pause(200)
  s1.destroy()
  s2.destroy()
  expect(received1).toStrictEqual(messages)
  expect(received2).toStrictEqual(messages)
})

test('it works when subscriptions are made after publishing', async () => {
  const topicName = 'brokerTest3'
  const port = 8889
  init(topicName)
  await pause(50)

  const messages = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const received = []

  const broker = createBroker(port, 1000, STORE_PATH)

  await pause(50)
  const p1 = pubsub.createPubSubClient(createChannel('::', port))
  messages.forEach(message => p1.publish(topicName, message))

  await pause(50)
  const s1 = pubsub.createPubSubClient(createChannel('::', port))
  s1.subscribe(topicName, message => {
    received.push(message)
  })

  await pause(100)
  broker.close()
  p1.destroy()
  s1.destroy()
  expect(received).toStrictEqual(messages)
})

test('it works when subscriptions are made after publishing and messages are removed from the cache', async () => {
  const topicName = 'brokerTest4'
  const port = 8889
  init(topicName)
  await pause(50)

  const messages = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const received = []
  // set the cache time to 100 ms
  const broker = createBroker(port, 100, STORE_PATH)

  await pause(50)
  const p1 = pubsub.createPubSubClient(createChannel('::', port))
  messages.slice(0, 3).forEach(message => p1.publish(topicName, message))
  // make sure first elements are purged
  await pause(1000)
  messages.slice(3).forEach(message => p1.publish(topicName, message))
  const s1 = pubsub.createPubSubClient(createChannel('::', port))
  s1.subscribe(topicName, message => {
    received.push(message)
  })

  await pause(200)
  broker.close()
  p1.destroy()
  s1.destroy()
  expect(received).toStrictEqual(messages)
})

test('it recovers data after restarting', async () => {
  const topicName = 'brokerTest5'
  const port = 8889
  init(topicName)
  await pause(50)

  const messages = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const received = []
  let broker = createBroker(port, 1000, STORE_PATH)

  await pause(50)
  const p1 = pubsub.createPubSubClient(createChannel('::', port))
  messages.forEach(message => p1.publish(topicName, message))
  await pause(100)
  broker.close()
  p1.destroy()
  await pause(100)

  broker = createBroker(port, 1000, STORE_PATH)
  const s1 = pubsub.createPubSubClient(createChannel('::', port))
  s1.subscribe(topicName, message => {
    received.push(message)
  })
  await pause(200)
  broker.close()
  s1.destroy()
  expect(received).toStrictEqual(messages)
})

test('it resubscribes', async () => {
  const topicName = 'brokerTest6'
  const port = 8889
  init(topicName)
  await pause(50)

  const messages = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
  const received = []
  const broker = createBroker(port, 1000, STORE_PATH)

  await pause(50)
  const p1 = pubsub.createPubSubClient(createChannel('::', port))
  messages.forEach(message => p1.publish(topicName, message))
  await pause(100)
  const s1 = pubsub.createPubSubClient(createChannel('::', port), 400)
  s1.subscribe(topicName, message => {
    received.push(message)
  })
  await pause(1000)
  p1.publish(topicName, { id: 5 })
  messages.push({ id: 5 })
  await pause(200)
  broker.close()
  p1.destroy()
  s1.destroy()
  expect(received).toStrictEqual(messages)
})
