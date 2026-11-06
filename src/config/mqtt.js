import { EventEmitter } from 'node:events';
import mqtt from 'mqtt';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

class MqttClientManager extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.publishedMessages = [];
    this.subscriptions = new Map(); // topic -> Set of callbacks
    this.client = null;
  }

  async connect() {
    if (this.client) return this;

    const brokerUrl = env.MQTT_URL || 'mqtt://127.0.0.1:1883';
    try {
      const baseId = env.MQTT_CLIENT_ID || 'sports_backend';
      const options = {
        clientId: `${baseId}_${process.pid}_${Math.random().toString(16).slice(2, 6)}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 3000,
      };

      if (env.MQTT_USERNAME) options.username = env.MQTT_USERNAME;
      if (env.MQTT_PASSWORD) options.password = env.MQTT_PASSWORD;

      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info({ url: brokerUrl }, 'MQTT Client connected to network broker');
        this.emit('connect');

        // Re-subscribe to any registered topics on reconnect
        for (const topic of this.subscriptions.keys()) {
          this.client.subscribe(topic, (err) => {
            if (err) logger.error({ err: err.message, topic }, 'Failed to subscribe to MQTT topic');
          });
        }
      });

      this.client.on('message', (topic, payloadBuffer) => {
        const payload = payloadBuffer.toString();
        let parsed = null;
        try {
          parsed = JSON.parse(payload);
        } catch {
          // Plain string
        }

        this.emit('message', topic, payload);

        for (const [subTopic, handlers] of this.subscriptions.entries()) {
          if (this._matchesTopic(subTopic, topic)) {
            for (const handler of handlers) {
              try {
                handler(topic, payload, parsed);
              } catch (handlerErr) {
                logger.error({ handlerErr, topic }, 'Error in MQTT topic subscriber handler');
              }
            }
          }
        }
      });

      this.client.on('error', (err) => {
        logger.warn({ err: err.message, url: brokerUrl }, 'MQTT connection warning');
      });

      this.client.on('offline', () => {
        this.isConnected = false;
        logger.warn('MQTT client went offline');
        this.emit('offline');
      });

      this.client.on('reconnect', () => {
        logger.info('MQTT client reconnecting...');
      });

      return this;
    } catch (err) {
      logger.error({ err }, 'Failed to initialize MQTT client');
      this.isConnected = false;
      return this;
    }
  }

  async publish(topic, message, options = {}) {
    const payload = typeof message === 'object' ? JSON.stringify(message) : String(message);

    const record = {
      topic,
      payload,
      parsed: typeof message === 'object' ? message : null,
      options,
      timestamp: new Date().toISOString(),
    };

    this.publishedMessages.push(record);
    if (this.publishedMessages.length > 500) {
      this.publishedMessages.shift();
    }

    // Broadcast to local in-process subscribers matching topic
    this.emit('message', topic, payload);

    for (const [subTopic, handlers] of this.subscriptions.entries()) {
      if (this._matchesTopic(subTopic, topic)) {
        for (const handler of handlers) {
          try {
            handler(topic, payload, record.parsed);
          } catch (handlerErr) {
            logger.error({ handlerErr, topic }, 'Error in MQTT topic subscriber handler');
          }
        }
      }
    }

    // Publish to real MQTT broker over TCP
    if (this.client && this.isConnected) {
      return new Promise((resolve) => {
        this.client.publish(topic, payload, options, (err) => {
          if (err) {
            logger.error({ err: err.message, topic }, 'Failed to publish MQTT message to broker');
            resolve(false);
          } else {
            logger.info({ topic, payload }, 'MQTT message published to network broker');
            resolve(true);
          }
        });
      });
    }

    logger.debug({ topic, payload }, 'MQTT message recorded in memory (broker offline)');
    return true;
  }

  subscribe(topic, callback) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      if (this.client && this.isConnected) {
        this.client.subscribe(topic, (err) => {
          if (err) logger.error({ err: err.message, topic }, 'Error subscribing to topic');
        });
      }
    }
    this.subscriptions.get(topic).add(callback);
    return () => this.unsubscribe(topic, callback);
  }

  unsubscribe(topic, callback) {
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic).delete(callback);
      if (this.subscriptions.get(topic).size === 0) {
        this.subscriptions.delete(topic);
        if (this.client && this.isConnected) {
          this.client.unsubscribe(topic);
        }
      }
    }
  }

  _matchesTopic(pattern, topic) {
    if (pattern === topic || pattern === '#') return true;
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }
    return patternParts.length === topicParts.length;
  }

  getPublishedMessages(filterTopic = null) {
    if (!filterTopic) return [...this.publishedMessages];
    return this.publishedMessages.filter((m) => this._matchesTopic(filterTopic, m.topic));
  }

  clearPublishedMessages() {
    this.publishedMessages = [];
  }

  async disconnect() {
    this.isConnected = false;
    this.clearPublishedMessages();
    this.subscriptions.clear();
    if (this.client) {
      await new Promise((resolve) => this.client.end(false, resolve));
      this.client = null;
    }
    this.emit('close');
  }
}

export const mqttClient = new MqttClientManager();

export const isMqttHealthy = () => mqttClient.isConnected;

export const disconnectMqtt = async () => {
  await mqttClient.disconnect();
};

// Initialize MQTT client immediately
mqttClient.connect().catch((err) => {
  logger.error({ err }, 'Unhandled error in MQTT connect');
});
