const robot = require('robotjs');
const os = require('os');
const dgram = require('dgram');
const ChildProcess = require('child_process');
const Path = require('path');

const config = require(Path.resolve('mousemaster.config'))

const server = dgram.createSocket('udp4');
const client = dgram.createSocket('udp4');

let mouseHere = false;


// 获取本机ip地址
let ip = 'localhost';
try {
  const interfaces = os.networkInterfaces();
  for (let dev in interfaces) {
    interfaces[dev].forEach((details, _alias) => {
      if (details.family === 'IPv4' && details.address !== '127.0.0.1' && !details.internal) {
        ip = details.address;
      }
    });
  }
} catch (error) {
  console.log(`get ip address error: ${error}`);
}

client.on('message', (message, _info) => {
  const messageIp = message.toString().split(' ')[0];

  if (messageIp === ip) {
    if (!mouseHere) {
      console.log('mouse moved in');
      mouseHere = true;
      const cp = ChildProcess.spawn(config.command, config.args);
      cp.on('exit', (code) => {
        console.log('exit code', code)
      })
    }
  } else {
    if (mouseHere) {
      mouseHere = false;
    }
  }
})
server.bind(1210, () => {
  server.setBroadcast(true);
});
client.bind(1212);


let lastMousePosition = robot.getMousePos();
let message = `${ip} mousemove`;
const timer = setInterval(() => {
  const mousePosition = robot.getMousePos();
  if(lastMousePosition.x !== mousePosition.x || lastMousePosition.y !== mousePosition.y) {
    lastMousePosition = mousePosition;
    server.send(message, 0, message.length, 1212, '255.255.255.255');
  } else {
    return;
  }
}, 1000)

