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

server.bind(PORT, () => {
  console.info(`listening on port ${server.address().port}.`);
});

const client = DGram.createSocket('udp4');

let pendingMachineSet = new Set();

let lastMousePosition = RobotJS.getMousePos();

setInterval(() => {
  let mousePosition = RobotJS.getMousePos();

  if (
    Math.max(Math.abs(mousePosition.x), Math.abs(mousePosition.y)) >
    2 ** 30
  ) {
    // Invalid position.
    return;
  }

  if (isPositionEqualTo(mousePosition, lastMousePosition)) {
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
      console.info(`command exit with code ${code}.`);
    });
  }

  for (let machine of MACHINES) {
    if (pendingMachineSet.has(machine)) {
      continue;
    }

    pendingMachineSet.add(machine);

    client.send(MESSAGE, PORT, machine, error => {
      pendingMachineSet.delete(machine);

      if (error) {
        console.error(error.message);
      }
    });
  }
}, 500);

function isPositionEqualTo(p1, p2) {
  return p1.x === p2.x && p1.y === p2.y;
}
