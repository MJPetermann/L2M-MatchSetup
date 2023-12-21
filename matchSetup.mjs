export default class matchSetup {
	static name = "matchSetup";
	static description = "setup matches with knife rounds";
	static author = "MJPetermann";
	static commands = [
		{
			command: "ready",
			permission: "basic.basicMatch",
			description: "marks player as ready",
		},
		{
			command: "unready",
			permission: "basic.basicMatch",
			description: "marks player as not ready",
		},
		{
			command: "status",
			permission: "basic.basicMatch",
			description: "gives information on how many players are ready",
		},
		{
			command: "forceready",
			permission: "admin.basicMatch",
			description: "skips ready",
		},
		{
			command: "match",
			permission: "admin.basicMatch",
			description: "set up match",
		},
		{
			command: "switch",
			permission: "basic.basicMatch",
			description: "set up match",
		},
		{
			command: "swap",
			permission: "basic.basicMatch",
			description: "set up match",
		},
		{
			command: "stay",
			permission: "basic.basicMatch",
			description: "set up match",
		},
		{
			command: "pause",
			permission: "basic.basicMatch",
			description: "set up match",
		},
	];

	constructor(server) {
        this.server = server;
        this.init(server);
    }

	init(server) {
		server.plugin = {};
		server.command.on("match", (data) => {
			const teams = {
				team1: {
					name: "team1",
					tag: "t1",
					players: [],
				},
				team2: {
					name: "team2",
					tag: "t2",
					players: [],
				},
			};
			server.plugin.basicMatch = {
				readyPlayersNeeded: 2,
			};
			loadTeams(server, teams);
			loadReady(server);
			server.plugin.basicMatch.status = "warmup"
			server.sayRcon(["{pink}[basicMatch]{white} loaded match!"]);
		});
	}
}

function loadTeams(server, teamsConfig) {
	const teams = [
		{
			name: teamsConfig.team1.name || "team1",
			tag: teamsConfig.team1.tag || false,
			players: teamsConfig.team1.players || [],
			seriesScore: teamsConfig.team1.seriesScore || 0,
			score: teamsConfig.team1.mapScore || 0,
		},
		{
			name: teamsConfig.team2.name || "team2",
			tag: teamsConfig.team2.tag || false,
			players: teamsConfig.team2.players || [],
			seriesScore: teamsConfig.team2.seriesScore || 0,
			score: teamsConfig.team2.mapScore || 0,
		},
	];
	server.plugin.basicMatch.teams = teams;
	//load warmup config
	server.Rcon([
		"mp_teamname_1 " + teams[0].name,
		"mp_teamname_2 " + teams[1].name,
	]);

	server.on("playerAdded", (player) => {
		// test if player is in one team
	});

	server.on("teamSideUpdate", (data) => {
		server.plugin.basicMatch.teams.filter(
			(testteam) => testteam.name == data.teamname
		)[0].side = data.side;
		server.log("basicMatch : " + data.teamname + " is now on " + data.side);
	});
}

function loadKnife(server) {
	server.plugin.basicMatch.status = "knife"
	loadPause(server)
	//load knife config
	server.on("matchScoreUpdate", getKnifeWinner);

	function getKnifeWinner(data) {
		let knifeWinner;
		if (data.score.ct == data.score.t) return;
		if (data.score.ct > data.score.t) knifeWinner = "CT";
		if (data.score.ct < data.score.t) knifeWinner = "TERRORIST";

		server.off("matchScoreUpdate", getKnifeWinner);
		loadKnifeCommands(server, knifeWinner);
	}
}

function loadKnifeCommands(server, winnerSide) {
	const winnerTeam = server.plugin.basicMatch.teams.filter(
		(testteam) => testteam.side == winnerSide
	)[0];

	server.sayRcon([
		"basicMatch: " + winnerTeam.name + " won the knife round!",
		"basicMatch: use '!stay' or '!stay' to choose your starting side",
	]);

	server.command.on("stay", stayTeam);
	server.command.on("switch", swapTeam);
	server.command.on("swap", swapTeam);

	function stayTeam(data) {
		if (data.player.side != winnerSide) return;
		server.sayRcon(["BasicMatch: " + winnerTeam.name + " decided to stay"]);

		server.command.off("stay", stayTeam);
		server.command.off("switch", swapTeam);
		server.command.off("swap", swapTeam);

		loadMatch(server);
	}

	function swapTeam(data) {
		if (data.player.side != winnerSide) return;
		server.sayRcon([
			"BasicMatch: " + winnerTeam.name + " decided to swap sides",
		]);
		server.Rcon(["mp_swapteams 1"]);

		server.command.off("stay", stayTeam);
		server.command.off("switch", swapTeam);
		server.command.off("swap", swapTeam);

		loadMatch(server);
	}
}

function loadReady(server) {
	server.on("allPlayersReady", () => {
		server.log("basicMatch : All players are ready!");
		for (const player of server.player.list) {
			player.ready = false;
		}

		server.command.removeAllListeners("ready");
		server.command.removeAllListeners("unready");
		server.command.removeAllListeners("status");
		server.command.removeAllListeners("forceready");

		server.removeAllListeners("allPlayersReady");
	});

	server.on("allPlayersReady", () => {
		server.sayRcon(["{pink}[basicMatch]{white} everyone is ready!"]);
		loadKnife(server);
	});

	server.command.on("ready", (data) => {
		server.sayRcon([
			"{pink}[basicMatch]{white} " + data.player.name + " is ready!",
		]);
		data.player.ready = true;
		if (allReady(server)) server.emit("allPlayersReady");
	});

	server.command.on("unready", (data) => {
		server.sayRcon([
			"{pink}[basicMatch]{white} " + data.player + " is not ready!",
		]);
		player.ready = false;
	});

	server.command.on("forceready", (data) => {
		server.sayRcon(["{pink}[basicMatch]{white} an admin forced ready!"]);
		server.emit("allPlayersReady");
	});

	server.command.on("status", (data) => {
		let message = [];
		let playersReady = 0;
		for (const player of server.player.list) {
			if (player.ready) {
				message.push(
					"{pink}[basicMatch]{white} STATUS: " +
						player.name +
						" is ready!"
				);
				playersReady++;
				continue;
			}
			message.push(
				"{pink}[basicMatch]{white} STATUS: " +
					player.name +
					" is not ready!"
			);
		}
		server.sayRcon([
			"{pink}[basicMatch]{white} STATUS: " +
				playersReady +
				" of " +
				server.plugin.basicMatch.readyPlayersNeeded +
				" needed players ready",
			...message,
		]);
	});
}

function allReady(server) {
	let readyPlayers = 0;
	for (const player of server.player.list) {
		if (player.ready) readyPlayers++;
	}
	if (readyPlayers == server.plugin.basicMatch.readyPlayersNeeded)
		return true;
	return false;
}

function loadMatch(server) {
	server.plugin.basicMatch.status = "live"
	// load match config

	// on an update of the score write the new score in the server object
	server.on("matchScoreUpdate", (data) => {
		const ctTeam = server.plugin.basicMatch.teams.filter(
			(testteam) => testteam.side == "CT"
		)[0];
		const tTeam = server.plugin.basicMatch.teams.filter(
			(testteam) => testteam.side == "TERRORIST"
		)[0];

		// if the score of one of the teams goes down return to surcomvent bugs when teams swap side
		if (ctTeam.score > data.score.ct) return;
		if (tTeam.score > data.score.t) return;

		ctTeam.score = data.score.ct;
		tTeam.score = data.score.t;
	});

	// on roundEnd event write current score with team names in the chat
	server.on("roundEnd", (data) => {
		server.sayRcon([
			"{pink}[basicMatch]{white} " +
				server.plugin.basicMatch.teams[0].name +
				" " +
				server.plugin.basicMatch.teams[0].score +
				":" +
				server.plugin.basicMatch.teams[1].score +
				" " +
				server.plugin.basicMatch.teams[1].name,
		]);
	});
}

function loadPause(server){
	server.command.on("pause", (data) => {
		if (server.plugin.basicMatch.paused) return server.sayRcon(["basicMatch: match is already paused!"])
		server.plugin.basicMatch.paused = true
		
		loadReady(server)

		server.Rcon(["mp_pause_match"])

		server.sayRcon(["basicMatch: type !ready to unpause game"])

		server.on("allPlayersReady", (data) => {
			server.Rcon(["mp_unpause_match"])
			server.plugin.basicMatch.paused = false
			server.sayRcon(["basicMatch: match is resumed!"])
		})

	})
}
