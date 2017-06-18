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
  socket.on('new_message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new_message', {
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

    socket.emit('full_update', {
      cellArray: board
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

  //Game events

  socket.on('placed_cells', function (data) {

    placeCells(data.cells)
    socket.broadcast.emit('game_update', {
      cells: data.cells
    });
  });

  //The actual Game of Life

var BOARD_WIDTH = 64;
var BOARD_HEIGHT = 64;
var CELL_SIZE = 10;
var CELL_MARGIN = 3;
var CELL_OFFSET = CELL_MARGIN + CELL_SIZE;
var TICK = 100;

var board = [];

function placeCells(cells){

  for (var i = 0; i < cells.length; i++) {
    
    var [x,y] = cells[i];
    board[x][y] = true;

  }
}

function updateCells(){
  updated = [];
  for (var x = 0; x < BOARD_WIDTH; x++) {
    for (var y = 0; y < BOARD_HEIGHT; y++) {
      //Possible neighbour coordinates with wrap-around
      var x1 = (x-1) & (BOARD_WIDTH-1);
      var x2 = (x+1) & (BOARD_WIDTH-1);
      var y1 = (y-1) & (BOARD_HEIGHT-1);
      var y2 = (y+1) & (BOARD_HEIGHT-1);
      var n =   board[x1][y1] + board[x][y1] + board[x2][y1] 
              + board[x1][y] /*board[x][y]*/ + board[x2][y] 
              + board[x1][y2] + board[x][y2] + board[x2][y2];
      
      if((board[x][y] && (n!=2 && n!=3)) || !board[x][y] && n==3){
        updated.push([x,y]);
      } 
    }
  }
  for (var i = 0; i < updated.length; i++) {
    var [x,y] = updated[i];
    board[x][y] = !board[x][y];

  }
  
  if(updated.length > 0){

    socket.broadcast.emit('game_update', {
      cells: updated
      });
  }
}


//Game loops

var time = new Date().getTime();
var timeSinceTick = 0;

function gameLoop(){
  var now = new Date().getTime();
  var dt = now - time;
  time = now;
  timeSinceTick += dt;

  if(timeSinceTick > TICK){
    timeSinceTick -= TICK;

    updateCells();
  }
  setTimeout(gameLoop,1000);
}

function initGame(){

  //Initialize an empty board
  for (var i = 0; i < BOARD_WIDTH; i++) {
    board[i] = 
    new Array(BOARD_HEIGHT).fill(false);
  }

  gameLoop();
}

initGame();

});