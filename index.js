const ChildProcess = require('child_process');
const DGram = require('dgram');
const Path = require('path');

const RobotJS = require('robotjs');
const UUID = require('uuid');

const MAGIC_PREFIX = 'mousemaster';
const MACHINE_ID = UUID.v1();

const MOUSE_CAPTURE_DEBOUNCE_TIMEOUT = 3000;

const CONFIG_FILE_NAME = 'mousemaster.config';

const {
  group: GROUP = 'default',
  port: PORT = 10047,
  machines: MACHINES,
  command: COMMAND,
  args: ARGS = [],
} = require(Path.resolve(CONFIG_FILE_NAME));

console.info(`\
MACHINE:
  id: ${MACHINE_ID}
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

const server = DGram.createSocket('udp4');

let captured = false;
let mouseLostAt = 0;

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
    return;
  }

  if (captured) {
    captured = false;
    mouseLostAt = Date.now();
  }
});

server.bind(PORT);

const client = DGram.createSocket('udp4');

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

  if (!captured && mouseLostAt + MOUSE_CAPTURE_DEBOUNCE_TIMEOUT > Date.now()) {
    return;
  }

  if (!captured) {
    captured = true;

    console.info('captured.');

    ChildProcess.spawn(COMMAND, ARGS).on('exit', code => {
      console.log(`command exit with code ${code}.`);
    });
  }

  for (let machine of MACHINES) {
    client.send(MESSAGE, PORT, machine);
  }
}, 1000);
