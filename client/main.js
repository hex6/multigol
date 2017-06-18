$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $lobbyPage = $('.lobby.page'); // The lobby page

  var $createButton = $('.createLobby');
  var $joinButton = $('.joinLobby');

  var gameCanvas =$('.gameCanvas')[0];
  var ctx = gameCanvas.getContext('2d');

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function playerJoinMessage (data) {
    var message = '';
    if (data.playerCount === 1) {
      message += "You're the only player. Invite some friends!";
    } else {
      message += "There are " + data.playerCount + " players";
    }
    log(message);
  }

  // Sets the client's username
  function joinServer (fadeOut) {
    

    // If the username is valid
    if (username) {
      localStorage.setItem('username', username);
      if(fadeOut){
        $loginPage.fadeOut();  
      } else{
        $loginPage.hide();
      }
      
      $lobbyPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('join_server', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }


  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to the main lobby, " + username +"!";
    log(message, {
      prepend: true
    });
    playerJoinMessage(data);
  });

  socket.on('lobby_created', function (data){
    log("Lobby #" + data.lobbyID + " created.");
  });

  socket.on('join_success', function (data) {
    log('Joined lobby #' + data.lobbyID);
  });

  socket.on('join_failed', function (data) {
    log('You\'re already in lobby #' + data.lobbyID);
  });

  socket.on('left_lobby',  function (data) {
    log('Left lobby #' + data.lobbyID);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user_joined', function (data) {
    log(data.username + ' joined');
    playerJoinMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user_left', function (data) {
    log(data.username + ' left');
    playerJoinMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('disconnect', function () {
    log('you have been disconnected');
  });

  socket.on('reconnect', function () {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', function () {
    log('attempt to reconnect has failed');
  });

  //Click events

  $createButton.click(function () {
    socket.emit('create_lobby');
  });

  $joinButton.click(function () {
    socket.emit('join_lobby');
  });

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Misc events

  function onResize(e){

    gameCanvas.width = gameCanvas.parentNode.offsetWidth;
    gameCanvas.height = gameCanvas.parentNode.offsetHeight;

  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        username = cleanInput($usernameInput.val().trim());
        joinServer();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  //Mouse events
  var mouseX = 0;
  var mouseY = 0;
  
  function onMouseMove(e){
    mouseX = (e.clientX - gameCanvas.offsetLeft);
    mouseX = ~~(mouseX/CELL_OFFSET);
    
    mouseY = e.clientY - gameCanvas.offsetTop;
    mouseY = ~~(mouseY/CELL_OFFSET);

  }

  var isMouseDown = false;
  function onMouseDown(e){

      isMouseDown = true;

      placeCells();

  }

  function onMouseUp(e){

      isMouseDown = false;
  }

//The actual Game of Life

var BOARD_WIDTH = 64;
var BOARD_HEIGHT = 64;
var CELL_SIZE = 10;
var CELL_MARGIN = 3;
var CELL_OFFSET = CELL_MARGIN + CELL_SIZE;
var TICK = 100;

var board = [];

var patterns = [[[0,0]],[[-1,1],[0,1],[1,1],[1,0],[0,-1]]];
var pattern = patterns[1];
function placeCells(){

  for (var i = 0; i < pattern.length; i++) {
    
    var [x,y] = pattern[i];
    board[mouseX+x][mouseY+y] = true;

  }
}

//Game loops

function render(){
  
  ctx.clearRect(0,0, gameCanvas.width, gameCanvas.height);

  //Draw the cells
  for (var x = 0; x < BOARD_WIDTH; x++) {
    for (var y = 0; y < BOARD_HEIGHT; y++) {
      var color = board[x][y] ? '#ccc' : '#333';
      if(board[x][y]){

      }
      ctx.fillStyle = color;
      ctx.fillRect(x * CELL_OFFSET + CELL_MARGIN, y * CELL_OFFSET + CELL_MARGIN, CELL_SIZE,CELL_SIZE);
    }   
  }
}

var time = new Date().getTime();
var timeSinceTick = 0;

function gameLoop(){
  requestAnimationFrame(gameLoop);
  var now = new Date().getTime();
  var dt = now - time;
  time = now;
  timeSinceTick += dt;

  if(timeSinceTick > TICK){
    timeSinceTick -= TICK;
  }

  render();
}



$(document).ready(function() {

  setTimeout(function(){
    gameCanvas.width = gameCanvas.parentNode.offsetWidth;
    gameCanvas.height = gameCanvas.parentNode.offsetHeight;
  }, 1);

  username = localStorage.getItem('username');

  //Initialize an empty board
  for (var i = 0; i < BOARD_WIDTH; i++) {
    board[i] = new Array(BOARD_HEIGHT).fill(false);
  }

  window.addEventListener('resize', onResize, false);
  window.addEventListener("mousemove", onMouseMove, false);
  window.addEventListener("mousedown", onMouseDown, false);

  gameLoop();

  joinServer(false);


  });

});