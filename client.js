function ClientClass() {

	var SOCKET = io();

	this.checkGameCode = function(code) {
		SOCKET.emit("check code", {code:code});
	};

	this.setCodeResponseCallback = function(f) {
		SOCKET.on("code response", function(data) {
			f(data.exists);
		});
	};

	this.createGame = function(op) {
		SOCKET.emit("create game", {
			code: op.code,
			sacMode: op.sacMode || false,
		});
	};

	this.joinGame = function(code) {
		SOCKET.emit("join game", {code:code});
	};

	this.setSetupGameCallback = function(f) {
		SOCKET.on("setup game", function(data) {
			f(data);
			setCallbacks();
		});
	};

	function setCallbacks() {
		Chess.setMoveCallback(function(fromLoc, toLoc, fromCode) {
			SOCKET.emit("moved", {
				fromLoc: fromLoc,
				toLoc: toLoc,			
				fromCode: fromCode,
			});
		});

		Chess.setKillPieceCallback(function(loc) {
			SOCKET.emit("piece killed", {loc:loc});
		});

		Chess.setResignCallback(function(color) {
			SOCKET.emit("resign", {color:color});
		});

		Chess.setGameOverCallback(function() {
			console.log("gameover");
			//setTimeout(function() {
			//	SOCKET.disconnect();
			//}, 3000);
		});

		SOCKET.on("make move", function(data) {
			Chess.movePiece(data.fromLoc, data.toLoc, data.fromCode, true);
		});

		SOCKET.on("kill piece", function(data) {
			Chess.killPiece(data.loc, true);
		});

		SOCKET.on("opponent resigned", function(data) {
			Chess.resign(data.color, true);
		});

		SOCKET.on("reset", function() {
			Chess.reset();
		});
	}
}

/*socket.on("game ready", function(data) {
			$("#game_info .game_code").text(data.gameCode || data.code);
			setupGame(true, true, mySide);
			setCallbacks(socket);
		});



		socket.on("opponent disconnected", function() {
			alert("opponent quit, disconnecting...");
			socket.disconnect();
			window.location.reload();
		});
	}
});

)*/