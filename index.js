const ChildProcess = require('child_process');
const DGram = require('dgram');
const Path = require('path');

const RobotJS = require('robotjs');
const UUID = require('uuid');

const MAGIC_PREFIX = 'mousemaster';
const MACHINE_ID = UUID.v1();

const CONFIG_FILE_NAME = 'mousemaster.config';

const {
  group: GROUP = 'default',
  port: PORT = 10047,
  command: COMMAND,
  args: ARGS = [],
} = require(Path.resolve(CONFIG_FILE_NAME));

console.info(`\
CONFIG:
  group: ${GROUP}
  port: ${PORT}
  command: ${COMMAND}
  args: ${ARGS}
`);

const MESSAGE = `${MAGIC_PREFIX}${JSON.stringify({
  group: GROUP,
  machine: MACHINE_ID,
})}`;

const client = DGram.createSocket('udp4');
const server = DGram.createSocket('udp4');

let captured = false;

server.on('message', data => {
  if (data.slice(0, MAGIC_PREFIX.length).toString() !== MAGIC_PREFIX) {
    console.warn('magic prefix mismatch.');
    return;
  }

  let message;

  try {
    message = JSON.parse(data.slice(MAGIC_PREFIX.length).toString());
  } catch {
    console.warn('broken message.');
    return;
  }

  if (message.group !== GROUP) {
    return;
  }

  if (message.machine === MACHINE_ID) {
    if (!captured) {
      captured = true;

      console.info('captured.');

      ChildProcess.spawn(COMMAND, ARGS).on('exit', code => {
        console.log(`command exit with code ${code}.`);
      });
    }
  } else {
    if (captured) {
      captured = false;
    }
  }
});

client.bind(() => client.setBroadcast(true));

server.bind(PORT);

let lastMousePosition = RobotJS.getMousePos();

setInterval(() => {
  let mousePosition = RobotJS.getMousePos();

  if (
    mousePosition.x === lastMousePosition.x &&
    mousePosition.y === lastMousePosition.y
  ) {
    return;
  }

  lastMousePosition = mousePosition;

  client.send(MESSAGE, 0, MESSAGE.length, PORT, '255.255.255.255');
}, 1000);
