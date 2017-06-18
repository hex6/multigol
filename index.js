var fs = require('fs');  
// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
  fs.writeFile(__dirname + '/start.log', 'started'); 
});

// Routing
app.use(express.static(__dirname + '/client'));

//Game lobbies

var coordinator = new function() {

  this.lobbyList = [];
  this.lobbyCount = 0;

};

// Chatroom

var playerCount = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('join_server', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    playerCount++;
    addedUser = true;
    socket.emit('login', {
      playerCount: playerCount
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user_joined', {
      username: socket.username,
      playerCount: playerCount
    });
  });

  //Player sends a request to create a game lobby
  socket.on('create_lobby', function () {
    
    var lobbyID = Math.random().toString(36).slice(2,7);
    console.log("Lobby #" + lobbyID + " created by " + socket.username);

    for(var i = 0; i < coordinator.lobbyCount; i++){
      console.log("Lobby:");
      console.log(coordinator.lobbyList[i]);
    }
    var lobby = {};
    lobby.id = lobbyID;
    lobby.host = socket.username;
    lobby.open = true;
    coordinator.lobbyList.push(lobby);
    coordinator.lobbyCount++;

    console.log(coordinator.lobbyCount);
    io.emit('lobby_created', {
      username: socket.username,
      lobbyID: lobbyID
    });

  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      playerCount--;

      // echo globally that this client has left
      socket.broadcast.emit('user_left', {
        username: socket.username,
        playerCount: playerCount
      });
    }
  });
});