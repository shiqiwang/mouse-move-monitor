const robot = require('robotjs');
const dgram = require('dgram');

const server = dgram.createSocket('udp4');
const client = dgram.createSocket('udp4');

client.on('message', (message, _info) => {
  console.log(message.toString())
})
server.bind(1210);
client.bind(1212);


let lastMousePosition = robot.getMousePos();
let message = 'mousemove';
const timer = setInterval(() => {
  const mousePosition = robot.getMousePos();
  if(lastMousePosition.x !== mousePosition.x || lastMousePosition.y !== mousePosition.y) {
    lastMousePosition = mousePosition;
    server.send(message, 0, message.length, 1212, 'localhost');
  } else {
    return;
  }
}, 500)

