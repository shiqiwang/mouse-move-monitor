const ChildProcess = require('child_process');
const HTTP = require('http');
const Path = require('path');

const {main} = require('main-function');
const {default: fetch} = require('node-fetch');
const RobotJS = require('robotjs');
const UUID = require('uuid');

const MACHINE_ID = UUID.v1();

const MOUSE_GET_CAPTURE_DEBOUNCE_TIMEOUT = 200;
const MOUSE_LOST_CAPTURE_DEBOUNCE_TIMEOUT = 0;
const MOUSE_VALID_POSITION_LIMIT = 100000;

const CONFIG_FILE_NAME = 'mousemaster.config';

const {
  group: GROUP = 'default',
  port: PORT = 10047,
  machines: MACHINES,
  command: COMMAND,
  args: ARGS = [],
} = require(Path.resolve(CONFIG_FILE_NAME));

const QUERY = new URLSearchParams({
  group: GROUP,
  machine: MACHINE_ID,
}).toString();

main(async () => {
  console.info(`\
MACHINE:
  id: ${MACHINE_ID}
CONFIG:
  group: ${GROUP}
  port: ${PORT}
  command: ${COMMAND}
  args: ${ARGS}
`);

  let mouseCapturedAt = 0;
  let mouseLostAt = 0;

  const server = HTTP.createServer((request, response) => {
    response.end();

    let params = new URL(request.url, `http://${request.headers.host}`)
      .searchParams;

    if (params.get('group') !== GROUP) {
      return;
    }

    if (params.get('machine') === MACHINE_ID) {
      return;
    }

    let now = Date.now();

    if (
      mouseCapturedAt > 0 &&
      mouseCapturedAt + MOUSE_GET_CAPTURE_DEBOUNCE_TIMEOUT < Date.now()
    ) {
      mouseCapturedAt = 0;
      mouseLostAt = now;

      console.info('no longer captured.');
    }
  });

  server.listen(PORT, () => {
    console.info(`listening on port ${server.address().port}.`);
  });

  let pendingMachineSet = new Set();

  let lastMousePosition = RobotJS.getMousePos();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let mousePosition = RobotJS.getMousePos();

    if (
      Math.max(Math.abs(mousePosition.x), Math.abs(mousePosition.y)) >
      MOUSE_VALID_POSITION_LIMIT
    ) {
      // Invalid position.
      continue;
    }

    if (isPositionEqualTo(mousePosition, lastMousePosition)) {
      continue;
    }

    lastMousePosition = mousePosition;

    let now = Date.now();

    if (
      mouseCapturedAt === 0 &&
      mouseLostAt + MOUSE_LOST_CAPTURE_DEBOUNCE_TIMEOUT > now
    ) {
      continue;
    }

    if (mouseCapturedAt === 0) {
      mouseCapturedAt = now;

      console.info('captured.');

      ChildProcess.spawn(COMMAND, ARGS).on('exit', code => {
        console.info(`command exit with code ${code}.`);
      });
    }

    await Promise.all([
      ...MACHINES.map(async machine => {
        if (pendingMachineSet.has(machine)) {
          return;
        }

        pendingMachineSet.add(machine);

        let hostname = /:\d+$/.test(machine) ? machine : `${machine}:${PORT}`;

        try {
          await fetch(`http://${hostname}/?${QUERY}`);
        } catch (error) {
          console.error(`error notifying ${machine}.`);
          console.error(error.message);
        } finally {
          pendingMachineSet.delete(machine);
        }
      }),
      new Promise(resolve => setTimeout(resolve, 500)),
    ]);
  }
});

function isPositionEqualTo(p1, p2) {
  return p1.x === p2.x && p1.y === p2.y;
}
