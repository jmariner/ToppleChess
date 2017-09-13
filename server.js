var fs = require("fs");
var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);

app.use(express.static(__dirname));

var PORT = 4000;
var games = {};
var connections = {};
io.on("connection", function(socket) {

	var id = socket.id;
	var ip = socket.request.connection.remoteAddress;

	connections[id] = {
		socket: socket,
		ip: ip,
		game: {},
		opponentId: "",
		color: "",
	};

	var conn = connections[id];

	log("[connected] " + id + " @ " + ip);

	socket.on("check code", function(data) {
		var exists = games.hasOwnProperty(data.code);
		socket.emit("code response", {exists:exists});
	});

	socket.on("create game", function(data) {
		var code = data.code;
		if (games.hasOwnProperty(code)) return;
		games[code] = {
			whitePlayer: id,
			blackPlayer: "",
			sacMode: data.sacMode,
			over: false,
		};
		conn.gameCode = code;
		conn.game = games[code];
		conn.color = "white";
		log("game created by " + id + ": " + code);
	});

	socket.on("join game", function(data) {
		var code = data.code;
		if (!games.hasOwnProperty(code)) return;
		var game = games[code];
		game.blackPlayer = id;
		conn.gameCode = code;
		conn.game = game;
		conn.color = "black";
		conn.opponentId = game.whitePlayer;
		connections[game.whitePlayer].opponentId = id;

		var reData = {
			code: code,
			sacMode: game.sacMode,
		}

		socket.emit("setup game", reData);

		connections[game.whitePlayer].socket.emit("setup game", reData);

		log("game ready: " + code);
	});

	socket.on("moved", function(data) {
		log("[move] [" + connections[id].color + "] " + data.fromLoc + " to " + data.toLoc + " fromCode? " + data.fromCode);
		if (conn.opponentId)
			connections[conn.opponentId].socket.emit("make move", data);
	});

	socket.on("piece killed", function(data) {
		log("[kill] " + data.loc + " killed");
		if (conn.opponentId)
			connections[conn.opponentId].socket.emit("kill piece", data);
	});

	socket.on("resign", function(data) {
		log("[resign] " + data.color + " in game " + conn.gameCode);
		if (conn.opponentId)
			connections[conn.opponentId].socket.emit("opponent resigned", {color:data.color});
		if (games[conn.gameCode])
			games[conn.gameCode].over = true;
	})

	socket.on("disconnect", function() {
		log("[disconnect] " + id);
		if (conn.opponentId && !games[conn.gameCode].over) {
			connections[conn.opponentId].socket.emit("opponent resigned", {color:conn.color.charAt(0)});
			connections[conn.opponentId].opponentId = "";
		}
		else if (games[conn.gameCode] && games[conn.gameCode].over && !conn.opponentId){
			delete games[conn.gameCode];			
		}

		delete connections[id];
	});
});

function log(message) {
	var d = new Date();
	var prefix = 
	"[" + (d.getMonth()+1) + "/" + d.getDate() + " " + d.toTimeString().split(" ")[0] + "]";
	console.log(prefix + " " + message);
	//"logs/"+(d.getMonth()+1)+"-"+d.getDate()+"-"+(d.getYear()+1900)+".log"
	fs.appendFile("console.log", prefix + " " + message, function(err) { if (err) console.log(err); });
}

http.listen(PORT, function() {
	log("Listening on *:" + PORT);
});