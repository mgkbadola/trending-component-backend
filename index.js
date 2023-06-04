const express = require('express');
const http = require('http');
const cors = require('cors');

const { fetchTrending, addArticle, addUser, modifyBehaviour } = require('./dbops');

var app = express();

const port = normalizePort(process.env.PORT || '3500');
app.set('port', port);
app.use(cors({
    origin: '*'
}));

const server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.get('/fetch-trending', fetchTrending);
app.get('/modify-behaviour', modifyBehaviour);
app.post('/add-article', addArticle);
app.post('/add-user', addUser);

module.exports = app;

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
      ? 'Pipe ' + port
      : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
  console.log('Server started at ' + bind)

}

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}
