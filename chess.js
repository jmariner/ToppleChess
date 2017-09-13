$(function() {

	var $overlay = $("#overlay");
	var code = "";
	var side = "";

	if (!window.hasOwnProperty("io"))
		$("#play_online").attr("disabled", "");

	$("#options_form").submit(function(e){ e.preventDefault(); });

	$overlay.find(".page.click_continue").click(nextPage);

	$("#play_offline, #play_online").click(function() {
		var mode = $(this).attr("id").substr(5);
		if (mode == "offline") {
			$overlay.addClass("hidden");
		}
		if (mode == "online") {
			window.Client = new ClientClass();		
			$("button.offline_only").attr("disabled", "");
			$("#game_info .is_online").text("yup");
			nextPage();
		}
	});

	$("#check_code").click(function() {
		code = $("#game_code").val();
		if (!code) return;
		Client.checkGameCode(code);
		Client.setCodeResponseCallback(function(exists) {
			if (!exists) {
				$(".host.hidden").removeClass("hidden");
				side = "w";
				$(".game_code").text(code);
			}
			else {
				Client.joinGame(code);
				side = "b";
			}
			Client.setSetupGameCallback(function(data) {
				$overlay.addClass("hidden");
				setupGame(data.sacMode, true, side);
			});
		});
	});

	$("#create_game").click(function() {
		Client.createGame({
			code: code,
			sacMode: $("#sac_mode").is(":checked"),
		});
		nextPage();
	});

	$("#new_game").click(function() { window.location.reload(); });
	$("#close_overlay").click(function() { $overlay.addClass("hidden"); });

	function nextPage() {
		var page = parseInt($overlay.find(".page_wrap").attr("page"));
		if (page < 5) page++; // pre-game pages
		$overlay.find(".page_wrap").attr("page", page);
	}

	$(document).on("click", ".side button", function() {
		Chess.onButtonClick($(this));
	});

	setupGame(true, true, "");
});

function setupGame(sacMode, onlineMode, side) {
	window.Chess = new ChessGame({
		hintsEnabled: false,
		imagesEnabled: true,
		sacModeEnabled: sacMode,
		onlineMode: onlineMode,
		sacOffset: 2,
		side: side,
	});

	$(".chess.hidden").removeClass("hidden");

	Chess.onLoad();
	window.onresize = Chess.updateSizing;
}

function ChessGame(op) {

	var options = {
		hintsEnabled: op.hintsEnabled || op.hints || false,
		imagesEnabled: op.imagesEnabled || op.images || false,
		sacModeEnabled: op.sacModeEnabled || op.sacMode || false,
		onlineModeEnabled: op.onlineModeEnabled || op.onlineMode || false,
		sacOffset: op.sacOffset || 0,
		side: op.side || "",
	};

	// --------- Visible Functions ----------

	this.onLoad = onLoad;
	this.onResize = onResize;
	this.onButtonClick = onButtonClick;
	this.reset = reset;
	this.updateSizing = updateSizing;
	this.toggleHints = toggleHints;
	this.toggleImages = toggleImages;
	this.toggleSacMode = toggleSacMode;
	this.getTurn = getTurn;
	this.movePiece = movePiece;
	this.setSide = setSide;
	this.isBeingAttacked = isBeingAttacked;
	this.getPossibleMoves = getPossibleMoves;
	this.getPossibleKills = getPossibleKills;
	this.addMoveToList = addMoveToList;
	this.addPieceCaptured = addPieceCaptured;
	this.findKing = findKing;
	this.checkCheck = checkCheck;
	this.getAllPossibleMoves = getAllPossibleMoves;
	this.killPiece = killPiece;
	this.resign = resign;
	this.gameOver = gameOver;

	this.setMoveLock = function(lock) { moveLock = lock; };

	//----- Callback Functions -----

	var moveCallback = null;
	var killPieceCallback = null;
	var resignCallback = null;
	var gameOverCallback = null

	this.setMoveCallback = function(f) { moveCallback = f; }; // moveCallback(fromLoc, toLoc, fromCode);
	this.setKillPieceCallback = function(f) { killPieceCallback = f; }; // killPieceCallback(loc)
	this.setResignCallback = function(f) { resignCallback = f; }; // resignCallback(resignee)
	this.setGameOverCallback = function(f) { gameOverCallback = f; }; // gameOverCallback(winner, num)

	// ---------- Global Variables ----------

	var moveCount = -1;
	var toggles = {
		hints: options.hintsEnabled,
		images: options.imagesEnabled,
		sacMode: options.sacModeEnabled,
	};
	var buttonFuncs = {
		"reset":reset,
		"resign":resign,
	};
	var moveLock = options.onlineMode;
	var onlineMode = options.onlineMode;
	var side = options.side;
	var board = createBoard();
	var moveList = {white:[], black:[]};
	var materialList = {white:[], black:[]};
	var sacOffset = options.sacOffset;
	var sacCutoff = 6;
	var sacCountdown = {white: 2+sacOffset, black: 2+sacOffset};
	var matValues = {"P":1, "B":3, "N":4, "R":5, "Q":9};
	var sacValues = {"P":2, "B":4, "N":4, "R":5, "Q":9};
	var symbols = {
		"wK":"\\2654", "wQ":"\\2655", "wR":"\\2656", "wB":"\\2657", "wN":"\\2658", "wP":"\\2659",
		"bK":"\\265A", "bQ":"\\265B", "bR":"\\265C", "bB":"\\265D", "bN":"\\265E", "bP":"\\265F",
	};

	// ----- Getter Functions -----

	this.getBoard = function() { return board; };

	// ---------- jQuery Variables ----------

	var $gameBoard = $("#game_board");
	var $rightWrap = $("#right_wrap");
	var $leftWrap = $("#left_wrap");
	var $topWrap = $("#top_wrap");
	var $bottomWrap = $("#bottom_wrap");
	var $moveTableWrap = $("#move_table_wrap");
	var $moveTable = $("#move_table");
	var $materialListWrap = $("#material_list_wrap");
	var $materialList = $("#material_list_table");
	var $sacCountdownWrap = $("#sac_countdown_wrap");
	var $gameInfo = $("#game_info");

	// ---------- Init Functions ----------

	function onLoad() {
		buildBoardTable();
		setupEvents();
		onResize();
		updateToggles();
		
		init();
	}

	function onResize() {
		updateSizing();
	}

	function onButtonClick($button) {
		var item = $button.attr("for");
		if ($button.hasClass("toggle")) {
			toggles[item] = !toggles[item];
			updateToggles();
		}
		else if (buttonFuncs.hasOwnProperty(item)) {
			buttonFuncs[item]();
		}
	}

	function reset() {
		isCheck = false;
		moveCount = -1;

		board = createBoard();
		moveList = {white:[], black:[]};	
		materialList = {white:[], black:[]};
		sacCountdown = {white: 2+sacOffset, black: 2+sacOffset};

		init();
	}

	function init() {
		updateMoveList();
		updateBoard();
		updateMaterialList();
		updateSacCountdown();

		hideLastMove();
		hidePossibleMoves();

		nextTurn(true);
		setSide(side);		
	}

	function buildBoardTable() { // TODO REVERSE NUMBERES ON LEFT FOR SIDE=b
		for (var r = 8; r > 0; r--) {
			var newR = translateRow(r);
			var curRow = $("<tr>").attr("row", newR);
			for (var c = 1; c < 9; c++) {
				var notation = toChessNot(c, newR);
				var $td = $("<td>")
							.attr("col", c)
							.attr("loc", notation)
							.append($("<div>"));
							
				if (r == 1) {
					$td.attr("col_letter", notation.charAt(0));
				}

				$td.appendTo(curRow);
			}
			$gameBoard.append(curRow);
		}
	}

	function translateRow(r) {
		if (side == "" || side == "w") {
			return r;
		}
		else if (side == "b") {
			return 8-r+1;
		}
	}
    
	function createBoard() {
		var boardArray = [
			["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
			["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
			[], [], [], [],
			["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
			["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"],
		];
		var board = {};
		for (var col=1; col<9; col++){
			for (var row=1; row<9; row++) {
				var notation = toChessNot(col, 9-row);
				board[notation] = boardArray[row-1][col-1] || "";
			}
		}
		return board;
	}

	// ---------- Sizing Functions ---------

	function updateSizing() {
		var scale = .85; // of height
		var gapScale = .04; // of size (1/25th)
		var fontScale = .75; // of size
		var top = ((1-scale)*window.innerHeight)/2;
		var left = ((1-scale)*window.innerWidth)/2 +
			scale*(window.innerWidth - window.innerHeight) / 2;
		var height = window.innerHeight * scale;
		var width = height;

		var gap = (gapScale*height) / (8 + 7*gapScale);
		var size = (height - 7*gap)/8;

		var outline = size/10;
		var gameFont = Math.floor(size * fontScale);
		var runnerHeight = top - outline;
		var sideWidth = left - 2*outline;
		var checkboxHeight = $("input[type='checkbox']").height();

		$gameBoard
			.css("top", top).css("left", left)
			.css("width", width).css("height", height)
			.css("font-size", gameFont)
			.css("outline-width", outline);

		$(".runner")
			.css("height", runnerHeight)
			.css("font-size", runnerHeight * .75);
			
		$bottomWrap.css("top", top + height + outline);

		if (left > 3*size) {

			$(".side")
				.removeClass("hidden")
				.css("top", top)
				.css("width", sideWidth)
				.css("height", height);

			$rightWrap.css("left", width + left + outline)
			
			$leftWrap.css("left", outline);

		}
		else {
			$(".side").addClass("hidden");
		}

		var globalStyles = {
			halfOutline: outline/2,
			doubleGap: 2*gap,
			size: size,
			moveTableItemHeight: $moveTableWrap.height() * .1,
			sideMargins: height * .05,
			checkboxScale: ((height/2) * .075) / checkboxHeight, // 75% of half height
			labelPad: checkboxHeight / 2,
		};

		var letters = ["P", "R", "N", "B", "Q", "K"];

		$("style#css_template_replaced").remove();
		$("style#css_template").clone().attr("id", "css_template_replaced").html(function(i, old){
			var html = old;
			for (var prop in globalStyles) {
				if (globalStyles.hasOwnProperty(prop)) {
					html = html.replace(
						new RegExp("\\{" + prop + "\\}", "g"), 
						globalStyles[prop]
					);
				}
			}
			for (var i = 0; i < letters.length; i++) {
				var p = letters[i];
				var wSym = symbols["w"+p];
				var bSym = symbols["b"+p];

				var lineNormalWhite  =
				"table:not(.images_enabled) [color=w][piece="+p+"] > div::after { content: '"+wSym+"'; }";

				var lineNormalBlack =
				"table:not(.images_enabled) [color=b][piece="+p+"] > div::after { content: '"+bSym+"'; }";
				
				var imageURL = "url('img/w"+p+".png');";
				var lineImage =
				"table.images_enabled [piece="+p+"] > div { background-image: " + imageURL + "; }";

				html += "\n" + lineNormalWhite + "\n" + lineNormalBlack + "\n" + lineImage + "\n\n";
			}
			return html;
		}).appendTo("head");

		for (var i = 0; i < 8; i++) {
			var offset = i * (size+gap);
			var r = translateRow(8-i);
			var c = i+1;
			$("#game_board tr[row='"+r+"']").css("top", offset + "px");
			$("#game_board td[col='"+c+"']").css("left", offset + "px");
		}
	}

	function setupEvents() {
		
		$(document).on("contextmenu", "#game_board td.possible.kill", function(e) {
			var loc = $(this).attr("loc");
			killPiece(loc);
			return false;
		});

		interact("#game_board td[piece]:not(.kill) > div").draggable({
			onstart: function(e) {
				var spot = e.target.parentNode;
				var piece = e.target;
				var color = $(spot).attr("color");
				$(piece).addClass("on_top");

				if (!moveLock && (side == "" || side == color) && getTurn() == color) {
					showPossibleMoves($(spot).attr("loc"));
					$(e.target).addClass("dragging");
				}
			},
			onend: function(e) {
				var piece = e.target;
				$(piece).removeAttr("data-x data-y style").removeClass("dragging on_top");
				hidePossibleMoves();				
			},
			onmove: function(e) {
				var el = e.target;

				var x = (parseFloat(el.getAttribute("data-x")) || 0) + e.dx;
				var y = (parseFloat(el.getAttribute("data-y")) || 0) + e.dy;

				el.style.webkitTransform = el.style.transform = "translate("+x+"px,"+y+"px)";

				el.setAttribute("data-x", x);
				el.setAttribute("data-y", y);
			}
		});
		interact("#game_board td.possible:not(.kill)").dropzone({
			accept: ".dragging",
			overlap: "pointer",
			ondropactivate: function(e) { /* when begin dragging */
			},
			ondropdeactivate: function(e) { /* when stop dragging */
				$(e.target).removeClass("hover");
			},
			ondragenter: function(e) {
				$(e.target).addClass("hover");
			},
			ondragleave: function(e) {
				$(e.target).removeClass("hover");
			},
			ondrop: function(e) {
				var dragEl = e.relatedTarget; // the div being dragged
				var target = e.target; // the td dropped into
				var original = dragEl.parentNode; // the original td				
				var fromLoc = $(original).attr("loc");
				var toLoc = $(target).attr("loc");

				movePiece(fromLoc, toLoc);

				//$(dragEl).removeAttr("style data-x data-y");
			}
		});		
	}

	function updateToggles() {
		for (var item in toggles) {
			if (toggles.hasOwnProperty(item)) {
				var enabled = toggles[item];
				$("button[for='"+item+"']")
					.removeClass("enabled disabled")
					.addClass(enabled ? "enabled" : "disabled");
				if (enabled) $gameBoard.addClass(item + "_enabled");
				else $gameBoard.removeClass(item + "_enabled");
			}
		}
	}

	// ---------- HTML Manipulation Functions ---------

	function updateBoard() {
		for (var loc in board) {
			if (board.hasOwnProperty(loc)) {
				var spot = board[loc];
				if (!spot) {
					$getSpot(loc).removeAttr("piece").removeAttr("color");
					continue;
				}
				var color = spot.charAt(0);
				var piece = spot.charAt(1);
				$getSpot(loc).attr("piece", piece).attr("color", color);
			}
		}
	}

	function updateMoveList() {
		$moveTable.find("tr").not(".header").remove();

		var whiteMoves = moveList["white"];
		var blackMoves = moveList["black"];
		var moveCount = Math.max(whiteMoves.length, blackMoves.length) + 
			(whiteMoves.length == blackMoves.length);
		for (var i = 0; i < moveCount; i++) {
			$moveTable.find(".header").clone().removeClass("header") // clone tr
				.children(".white").text(whiteMoves[i]||"").parent()
				.children(".black").text(blackMoves[i]||"").parent()
				.children(".number").text(i+1).parent()
				.addClass("move_"+(i+1)) // set the move_# class
				.appendTo($moveTable);
		}
		$moveTable.find("tr:not(.header)").find("td:not(.number):not(:empty)").last().addClass("last_move");		
		$moveTable.find("td:empty").first().addClass("highlight");

		$moveTableWrap[0].scrollTop = $moveTableWrap[0].scrollHeight;
	}

	function updateMaterialList() {
		$materialList.find("td div").remove();
		$materialList.find("tr.number td").text(0);
		
		var whitePieces = materialList["white"];
		var blackPieces = materialList["black"];
		var $whiteList = $materialList.find(".area .white");
		var $blackList = $materialList.find(".area .black");
		var $whiteBottom = $materialList.find(".number .white");
		var $blackBottom = $materialList.find(".number .black");
		var max = Math.max(whitePieces.length, blackPieces.length);
		for (var i = 0; i < max; i++) {
			if (i < whitePieces.length) {
				$("<div>")
					.attr("piece", whitePieces[i])
					.attr("color", "w")
					.attr("title", whitePieces[i] + ": " + matValues[whitePieces[i]] + " points")
					.append($("<div>")).appendTo($whiteList);
				$whiteBottom.text(function(i, old) {
					return (parseInt(old) || 0) + (matValues[whitePieces[i]] || 0);
				});
			}
			if (i < blackPieces.length) {
				$("<div>")
					.attr("piece", blackPieces[i])
					.attr("color", "b")
					.attr("title", blackPieces[i] + ": " + matValues[blackPieces[i]] + " points")					
					.append($("<div>")).appendTo($blackList);
				$blackBottom.text(function(i, old) {
					return (parseInt(old) || 0) + (matValues[blackPieces[i]] || 0);
				});
			}
		}
	}

	function updateSacCountdown() {
		var $sacTable = $("#sac_countdown tbody");
		var whiteVal = (sacCountdown["white"] > -1) ? sacCountdown["white"] : "N/A";
		var blackVal = (sacCountdown["black"] > -1) ? sacCountdown["black"] : "N/A";
		$sacTable.find(".white .number").attr("value", whiteVal);
		$sacTable.find(".black .number").attr("value", blackVal);
	}

	function showWhoseTurn() {
		if (!onlineMode) flashBoarder("#game_board [color="+getTurn()+"]");

		$gameBoard.attr("turn", getTurn());
	}

	function flashBoarder(css) {
		$(css)
			.animate({borderColor: "rgba(0, 255, 0, 0.75)"}, 500)
			.animate({borderColor: "rgba(0, 255, 0, 0)"}, 500);		
	}

	function showPossibleMoves(notation) {
		var possible = getPossibleMoves(notation);
		for (var i=0; i<possible.length; i++) {
			$getSpot(possible[i]).addClass("possible");
		}
		$getSpot(notation).addClass("highlight");
	}

	function hidePossibleMoves() {
		$gameBoard.find(".possible:not(.kill), .highlight").removeClass("possible highlight");
	}

	function showPossibleKills() {
		var possible = getPossibleKills(getTurn());
		possible.forEach(function(curLoc) {
			$getSpot(curLoc).addClass("possible kill");
		});
		
		$gameInfo.find(".turn").addClass("sac");
	}

	function hidePossibleKills() {
		$gameBoard.find(".possible.kill").removeClass("possible kill");
	}

	function showLastMove(fromLoc, toLoc) {
		hideLastMove();
		$getSpot(fromLoc).add($getSpot(toLoc)).addClass("last_move");
	}

	function hideLastMove() {
		$(".last_move").removeClass("last_move");
	}

	function toggleHints(b) {
		toggles.hints = b || !toggles.hints;
		if (toggles.hints) $gameBoard.addClass("hints_enabled");
		else $gameBoard.removeClass("hints_enabled");
		return toggles.hints;
	}

	function toggleImages(b) {
		toggles.images = b || !toggles.images;
		if (toggles.images) $gameBoard.addClass("use_images");
		else $gameBoard.removeClass("use_images");
		return toggles.images;
	}

	function toggleSacMode(b) {
		toggles.sacMode = b || !toggles.sacMode;
		return toggles.sacMode;
	}

	// ---------- Game Logic Functions ---------

	function getPossibleMoves(notation, spot, fromAttackFunc, fromCheckFunc) {
		var loc = fromChessNot(notation);
		var c = loc.col;
		var r = loc.row;
		var spot = spot || board[notation];
		if (!spot) return [];
		var color = spot.charAt(0);
		var oppositeColor = (color == "w") ? "b" : ((color == "b") ? "w" : "");
		var piece = spot.charAt(1);
		var possibleMoves = [];

		if (piece == "P") {
			if (color == "w") { // If white

				if (!fromAttackFunc) {
					possibleMoves.push([c, r+1]); //Pawn can move up (r+1)
					// First move: pawn can move up twice (r+2)
					if (r == 2) possibleMoves.push([c, r+2]);
				}

				var upLeftColor = boardAtCoords(c-1, r+1).charAt(0) || color;
				var upRightColor = boardAtCoords(c+1, r+1).charAt(0) || color;

				if (fromAttackFunc || upLeftColor != color) possibleMoves.push([c-1, r+1]);
				if (fromAttackFunc || upRightColor != color) possibleMoves.push([c+1, r+1]);
			}
			else if (color == "b") {

				if (!fromAttackFunc) {
					possibleMoves.push([c, r-1]);
					if (r == 7) possibleMoves.push([c, r-2]);					
				}

				var upLeftColor = boardAtCoords(c-1, r-1).charAt(0) || color;
				var upRightColor = boardAtCoords(c+1, r-1).charAt(0) || color;

				if (fromAttackFunc || upLeftColor != color) possibleMoves.push([c-1, r-1]);
				if (fromAttackFunc || upRightColor != color) possibleMoves.push([c+1, r-1]);
			}
		}

		if (piece == "K") {
			possibleMoves = possibleMoves.concat([
				[c+1, r+1],
				[c-1, r-1],
				[c+1, r-1],
				[c-1, r+1],
				[c+1, r],
				[c-1, r],
				[c, r+1],
				[c, r-1]
			]);
			if (!spot.charAt(2)) { // If king hasn't moved
				if (!boardAtCoords(c+1, r) && !boardAtCoords(c+2, r) &&
					!boardAtCoords(c+3, r).charAt(2)) {
					possibleMoves.push([c+2, r]);
				}
				if (!boardAtCoords(c-1, r) && !boardAtCoords(c-2, r) && 
					!boardAtCoords(c-3, r) && !boardAtCoords(c-4, r).charAt(2)) {
					possibleMoves.push([c-2, r]);
				}
			}
		}

		if (piece == "Q") {
			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c+i, r+i)) break;
				possibleMoves.push([c+i, r+i]);
				if (boardAtCoords(c+i, r+i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c+i, r-i)) break;
				possibleMoves.push([c+i, r-i]);
				if (boardAtCoords(c+i, r-i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c-i, r+i)) break;
				possibleMoves.push([c-i, r+i]);
				if (boardAtCoords(c-i, r+i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c-i, r-i)) break;
				possibleMoves.push([c-i, r-i]);
				if (boardAtCoords(c-i, r-i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c+i, r)) break;
				possibleMoves.push([c+i, r]);
				if (boardAtCoords(c+i, r)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c-i, r)) break;
				possibleMoves.push([c-i, r]);
				if (boardAtCoords(c-i, r)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c, r+i)) break;
				possibleMoves.push([c, r+i]);
				if (boardAtCoords(c, r+i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c, r-i)) break;
				possibleMoves.push([c, r-i]);
				if (boardAtCoords(c, r-i)) break;	
			}			
		}

		if (piece == "N") {
			possibleMoves = possibleMoves.concat([
				[c+2, r+1],
				[c+1, r+2],
				[c+2, r-1],
				[c+1, r-2],
				[c-2, r+1],
				[c-1, r+2],
				[c-2, r-1],
				[c-1, r-2]
			]);
		}

		if (piece == "B") {
			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c+i, r+i)) break;
				possibleMoves.push([c+i, r+i]);
				if (boardAtCoords(c+i, r+i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c+i, r-i)) break;
				possibleMoves.push([c+i, r-i]);
				if (boardAtCoords(c+i, r-i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c-i, r+i)) break;
				possibleMoves.push([c-i, r+i]);
				if (boardAtCoords(c-i, r+i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c-i, r-i)) break;
				possibleMoves.push([c-i, r-i]);
				if (boardAtCoords(c-i, r-i)) break;	
			}
		}

		if (piece == "R") {
			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c+i, r)) break;
				possibleMoves.push([c+i, r]);
				if (boardAtCoords(c+i, r)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c-i, r)) break;
				possibleMoves.push([c-i, r]);
				if (boardAtCoords(c-i, r)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c, r+i)) break;
				possibleMoves.push([c, r+i]);
				if (boardAtCoords(c, r+i)) break;	
			}

			for (var i = 1; i < 8; i++) {
				if (!isValidCoord(c, r-i)) break;
				possibleMoves.push([c, r-i]);
				if (boardAtCoords(c, r-i)) break;	
			}
		}

		var newPosMov = [];

		for (var i = 0; i < possibleMoves.length; i++) {
			var currentMove = possibleMoves[i];
			var curCol = currentMove[0];
			var curRow = currentMove[1];
			var currentMoveNot = toChessNot(curCol, curRow);
			var curSpot = board[currentMoveNot] || "";
			var curColor = curSpot.charAt(0);
			
			// If trying to move out of bounds
			if (!currentMoveNot) continue;

			// If trying to move into check
			if (!fromAttackFunc && !fromCheckFunc &&
				checkCheck(notation, currentMoveNot, color)) continue;

			// If trying to move to empty spot, we're good
			if (!curSpot) {
				newPosMov.push(currentMoveNot);
				continue;
			}

			// If trying to move to same color
			if (curSpot && curColor == color) continue;

			// If pawn trying to capture forward
			if (piece == "P" && curColor != color && curCol == c) continue;

			newPosMov.push(currentMoveNot);

		}

		return newPosMov;
	}

	function getAllPossibleMoves(color) {
		var allMoves = [];

		for (var loc in board) {
			if (board.hasOwnProperty(loc)) {
				var spot = board[loc];
				var color2 = spot.charAt(0)

				if (color==color2)
					allMoves = allMoves.concat(getPossibleMoves(loc));
			}
		}

		return allMoves;
	}

	function movePiece(fromLoc, toLoc, fromCode, fromServer) {

		var $from = $getSpot(fromLoc);
		var $to = $getSpot(toLoc);
		var spot = board[fromLoc];
		var color = spot.charAt(0);
		var oppositeColor = getOppositeColor(color);
		var piece = spot.charAt(1);

		var castleSide = "";
		var check = false;
		var mate = false;
		var take = false;

		if (fromLoc == toLoc) {
			return;
		}

		if (piece == "P") { // pawn promotion
			if (color == "w" && toLoc.charAt(1) == 8)
				piece = "Q";
			if (color == "b" && toLoc.charAt(1) == 1)
				piece = "Q";
		}

		if (piece == "K") { // castle
			var fromCol = fromChessNot(fromLoc).col;
			var toCol = fromChessNot(toLoc).col;
			var row = fromChessNot(toLoc).row;
			var dx = toCol - fromCol;

			if (dx == 2) { // on king side
				movePiece(toChessNot(toCol+1, row), toChessNot(toCol-1, row), true);
				castleSide = "king";
			}
			else if (dx == -2) { // on queen side
				movePiece(toChessNot(toCol-2, row), toChessNot(toCol+1, row), true);
				castleSide = "queen"
			}
		}

		if (board[toLoc]) {
			take = true;
			addPieceCaptured(board[toLoc]);
		}

		//check checking (only for movelist)
		var checkNum = checkCheck(fromLoc, toLoc, oppositeColor, true);

		if (checkNum == 2) 
			check = mate = true;
		else if (checkNum == 1)
			check = true;

		if (!fromCode) {
			var moveNot = 
				toChessMoveNot(piece, fromLoc, toLoc, take, check, mate, castleSide);
			addMoveToList(moveNot, color);
		}

		// make the move
		board[fromLoc] = "";
		board[toLoc] = color + piece + "m";
		updateBoard();

		if (!fromCode) {
			nextTurn();
			showLastMove(fromLoc, toLoc);
		}

		if (mate) {
			gameOver(color, 2);
		}

		if (moveCallback && !fromServer && !fromCode) moveCallback(fromLoc, toLoc, fromCode);
	}

	function nextTurn(onLoad) {
		if (!onLoad && toggles.sacMode && sacCountdown[longColor(getTurn())] > -1) {
			sacCountdown[longColor(getTurn())]--;
			updateSacCountdown();
		}

		$gameInfo.find(".turn").removeClass("check");

		moveCount++;
		showWhoseTurn();

		if (checkCheck("", "", getTurn()))
			$gameInfo.find(".turn").addClass("check");

		if (toggles.sacMode && sacCountdown[longColor(getTurn())] == 0) {
			if (countPieces(getTurn()) <= sacCutoff) {
				sacCountdown[longColor(getTurn())] = -1;
				updateSacCountdown();
			}
			else {
				moveLock = true;
				if (!side || side == getTurn()) showPossibleKills();
			}
		}
	}

	function checkCheck(fromLoc, toLoc, color, checkForMate) {
		if (!color) return 0;

		var boardBackup = $.extend({}, board);

		if (fromLoc) {
			var old = board[fromLoc].substr(0,2);
			board[fromLoc] = ""
			if (toLoc) board[toLoc] = old;
		}

		var kingLoc = findKing(color);
		var opposite = getOppositeColor(color);
		var isCheck = isBeingAttacked(kingLoc, opposite, true);
		
		var allPossible = [""];
		if (checkForMate) {
			allPossible = getAllPossibleMoves(color);
		}
		var isMate = (allPossible.length == 0);

		board = $.extend({}, boardBackup);

		return 0 + isCheck + isMate; // 0 + 1 + 0 = 1 for check, 0 + 1 + 1 = 2 for mate
	}

	function getPossibleKills(c) {
		var possible = [];
		for (var loc in board) {
			if (board.hasOwnProperty(loc) && board[loc].charAt(1) != "K" && board[loc].charAt(0) == c && 
				((!checkCheck("", "", c) && !checkCheck(loc, "", c)) || checkCheck("", "", c)))
					possible.push(loc);
		}
		return possible;
	}

	function killPiece(loc, fromServer) {
		var spot = board[loc];
		var color = spot.charAt(0)
		var piece = spot.charAt(1);
		
		moveLock = false;
		sacCountdown[longColor(getTurn())] += sacValues[piece] + sacOffset;
		updateSacCountdown();
		hidePossibleKills();

		board[loc] = "";
		updateBoard();

		$gameInfo.find(".turn").removeClass("sac");

		if (killPieceCallback && !fromServer) {
			killPieceCallback(loc);
		}
	}

	function countPieces(c) {
		return $gameBoard.find("td[color='"+c+"'][piece]").length;
	}

	function isBeingAttacked(loc, byColor, fromCheck) {
		for (var l in board) {
			if (board.hasOwnProperty(l)) {
				if (board[l].charAt(0) == byColor &&
					getPossibleMoves(l, "", true, fromCheck).indexOf(loc) > -1) return true;
			}
		}
		return false;
	}

	function findKing(color) {
		var loc = "";
		var spot = color + "K";
		for (var l in board) {
			if (board.hasOwnProperty(l)) {
				if (board[l].substr(0,2) == spot) loc = l;
			}
		}
		return loc;
	}

	function addMoveToList(notation, color) {
		moveList[longColor(color)].push(notation);
		updateMoveList();
	}

	function addPieceCaptured(spot) {
		var piece = spot.charAt(1);
		var color = spot.charAt(0);
		materialList[longColor(color)].push(piece);
		updateMaterialList();
	}

	function resign(color, noCallback) {
		var resignee = color ? color : (side ? side : getTurn());
		gameOver(getOppositeColor(resignee), 1);
		if (resignCallback && !noCallback)
			resignCallback(resignee);
	}

	function gameOver(winner, num) { // num = 1 for resign/disconnect, 2 for checkmate

		moveLock = true;
		console.log("gameover");
		var how = (num == 1) ? "resign" : ((num == 2) ? "checkmate" : "");
		
		$("#overlay")
			.removeClass("hidden")
			.find(".page_wrap").attr("page", 5)
			.find(".page.game_over").addClass(how)
			.find(".how").text(how).end()
			.find(".winner").text(longColor(winner));

		if (gameOverCallback) {
			gameOverCallback(winner, num);
		}
	}

	function setSide(s) {
		side = s;
		$gameBoard.attr("side", s);
	}

	// ---------- Utility Functions ----------

	function $getSpot(loc) {
		return $("[loc="+loc+"]");
	}

	function getTurn() {
		return (moveCount%2) ? "b" : "w";
	}

	function boardAtCoords(col, row) {
		return board[toChessNot(col, row)] || "";
	}

	function toChessNot(col, row) {
		return (isValidCoord(col, row)) ? String.fromCharCode(96+col) + row : "";
	}

	function fromChessNot(not) {
		return {
			col: not.charCodeAt(0) - 96,
			row: parseInt(not.charAt(1)),
		};
	}

	function toChessMoveNot(piece, fromLoc, toLoc,
				take, check, mate, castleSide) {
		var moveNotation = "";
		if (castleSide) {
			if (castleSide == "king") moveNotation = "0-0";
			if (castleSide == "queen") moveNotation = "0-0-0";
		}
		else {
			var pieceNot = (piece == "P") ? "" : piece;
			if (!take) {
				moveNotation = pieceNot + toLoc;
			}
			else {
				if (pieceNot) moveNotation = pieceNot + "x" + toLoc;
				else moveNotation = fromLoc.charAt(0) + "x" + toLoc;
			}
			if (mate) {
				moveNotation += "#";
			}
			else if (check) {
				moveNotation += "+";
			}
		}
		return moveNotation;
	}

	function isValidCoord(col, row) {
		return (col > 0 && row > 0 && col < 9 && row < 9);
	}

	function longColor(c) {
		return (c == "w") ? "white" : ((c == "b") ? "black" : "");
	}

	function getColorClass(c) {
		return "." + longColor(c);
	}

	function getOppositeColor(c) {
		return (c == "w") ? "b" : ((c == "b") ? "w" : "");
	}
}