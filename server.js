'use strict';

require('module-alias/register');
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const config = require('@config');
const routes = require('@routes');
const Health = require('@src/Health');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/', routes);
app.use('/', Health);

app.use((req, res) => {
  res.status(404).json({
    status: 0,
    data: null,
    error: 'Not found'
  });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({
    status: 0,
    data: null,
    error: 'Internal server error'
  });
});

function printBanner() {
  const text = 'A P I   B Y   M A L A K O R';
  const width = text.length + 6;
  const top = '+' + '-'.repeat(width) + '+';
  const empty = '|' + ' '.repeat(width) + '|';
  const pad = Math.floor((width - text.length) / 2);
  const line = '|' + ' '.repeat(pad) + text + ' '.repeat(width - pad - text.length) + '|';

  console.log('');
  console.log(top);
  console.log(empty);
  console.log(line);
  console.log(empty);
  console.log(top);
  console.log('');
}

let server;

async function start() {
  try {
    printBanner();

    await mongoose.connect(config.mongo.uri, {
      dbName: config.mongo.dbName
    });

    server = app.listen(config.port, () => {
      console.log(`[Server] Running on port ${config.port}`);
    });
  } catch (err) {
    process.exit(1);
  }
}

async function shutdown(signal) {
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await mongoose.connection.close();

    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {});

start();
