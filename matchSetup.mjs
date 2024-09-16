import { readFileSync } from "node:fs";
import event from "events";

export default class matchSetup extends event.EventEmitter {
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
			command: "endmatch",
			permission: "basic.basicMatch",
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

	constructor(server, router) {
		super();
		this.name = this.constructor.name;
		this.description = this.constructor.description;
		this.author = this.constructor.author;
		this.commands = this.constructor.commands;

		this.router = router;

		this.server = server;
		this.init();
		this.config = {};
	}

	init() {
		this.router.get("/", (req, res) => {
			res.json("plugin loaded");
		});

		this.router.get("/config", (req, res) => {
			res.json(this.config);
		});

		this.router.get("/match", (req, res) => {
			res.json(
				this.config?.match ? this.config.match : "no match loaded"
			);
		});

		this.router.post("/match", (req, res) => {
			const content = req.body;
			if (this.config.match && this.config.match.status !== "end")
				return res.json("match is ongoing!");
			this.handleMatch(content);
			this.server.log("basicMatch : match loaded");
			res.json("match loaded");
		});

		this.router.delete("/match", (req, res) => {
			this.emit("matchEnd", {name:"unkown"});
			this.server.log("basicMatch : match deleted");
			res.json("match deleted");
		});

		this.router.post("/rcon", (req, res) => {
			const content = req.body;
			this.server.Rcon(content);
			res.json("rcon sent");
		});

		this.server.command.on("endmatch", (data) => {
			this.emit("matchEnd", {name:"unkown"});
		});

		this.server.on("matchEnd", (data) => this.emit("mapEnd", data));
	}

	handleMatch(matchConfig) {
		this.once("matchLoaded", () => {
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} loaded match!",
			]);

			let mapNumber =
				this.config.match.teams[0].seriesScore +
				this.config.match.teams[1].seriesScore;
			this.loadMap(this.config.match.maps, mapNumber);
		});

		this.on("mapLoaded", (map) => {
			if (this.config.match.status == "returnlive") return this.loadLive()
			this.loadReady();
			this.once("allPlayersReady", (data) => {
				map?.startingCT ? this.startMap() : this.startKnife();

				this.server.Rcon(["tv_record " + Date.now() + "_" + map.id + "_" + this.config.match.teams[0].name + "_vs_" + this.config.match.teams[1].name + (this.config.match.maps.length > 1 ? "_" + (this.config.match.teams[0].seriesScore+this.config.match.teams[1].seriesScore) : "")]);
				
				this.server.log("demo-recording: " + Date.now() + "_" + map.id + "_" + this.config.match.teams[0].name + "_vs_" + this.config.match.teams[1].name + (this.config.match.maps.length > 1 ? "_" + (this.config.match.teams[0].seriesScore+this.config.match.teams[1].seriesScore) : ""))

				clearInterval(this.timer);
				this.server.once("matchScoreUpdate", () => {
					this.loadPause();
				});
			});
			// frequently give guidance how to ready to players
			this.timer = setInterval(() => {
				this.server.sayRcon([
					"{lightRed}[matchSetup]{green} type {purple}'!ready'{green} to ready up",
					"{lightRed}[matchSetup]{green} open the {purple}scoreboard{green} and {red}check if you are in the right team!",
				]);
			}, 20000);
		});

		this.on("knifeConcluded", (data) => {
			this.startMap();
		});

		this.on("mapEnd", (data) => {
			let mapNumber =
				this.config.match.teams[0].seriesScore +
				this.config.match.teams[1].seriesScore;

			const ctTeam = this.config.match.teams.filter(
				(testteam) => testteam.side == "CT"
			)[0];

			const tTeam = this.config.match.teams.filter(
				(testteam) => testteam.side == "TERRORIST"
			)[0];

			this.config.match.maps[mapNumber].score = [
				this.config.match.teams[0].score,
				this.config.match.teams[1].score,
			];

			if (data.score.ct > data.score.t) {
				ctTeam.seriesScore++;
				this.server.sayRcon([
					"{lightRed}[matchSetup]{orange} " +
						ctTeam.name +
						"{green} won{darkPurple} " +
						this.config.match.maps[mapNumber].name,
				]);
				this.server.log(
					ctTeam.name +
						" won " +
						this.config.match.maps[mapNumber].name + " " + 
						this.config.match.teams[0].score +
						":" +
						this.config.match.teams[1].score
				);
			}

			if (data.score.ct < data.score.t) {
				tTeam.seriesScore++;
				this.server.sayRcon([
					"{lightRed}[matchSetup]{orange} " +
						tTeam.name +
						"{green} won{darkPurple} " +
						this.config.match.maps[mapNumber].name,
				]);
				this.server.log(
					tTeam.name +
						" won " +
						this.config.match.maps[mapNumber].name + " " + 
						this.config.match.teams[0].score +
						":" +
						this.config.match.teams[1].score
				);
			}

			if (
				this.config.match.teams[0].seriesScore >
					this.config.match.maxMaps / 2 ||
				this.config.match.teams[1].seriesScore >
					this.config.match.maxMaps / 2
			) {
				let winner;
				if (
					this.config.match.teams[0].seriesScore <
					this.config.match.teams[1].seriesScore
				) {
					winner = this.config.match.teams[1];
				} else {
					winner = this.config.match.teams[0];
				}
				this.emit("matchEnd", winner);
				return;
			}

			this.server.Rcon([
				"mp_teamscore_1 " + this.config.match.teams[0].seriesScore,
				"mp_teamscore_2 " + this.config.match.teams[1].seriesScore,
			])

			this.config.match.teams[0].score = 0;
			this.config.match.teams[1].score = 0;
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} next map: {darkPurple} " +
					this.config.match.maps[mapNumber + 1].name,
			]);
			setTimeout(
				() => {this.loadMap(this.config.match.maps, mapNumber + 1)},
				20000
			);
		});

		this.on("matchEnd", (winner) => {
			this.server.sayRcon([
				"{lightRed}[matchSetup]{orange} " +
					winner.name +
					"{green} won{darkPurple} the match!",
			]);
			this.server.log(
				winner.name +
					" won " +
					this.config.match.teams[0].seriesScore +
					":" +
					this.config.match.teams[1].seriesScore
			);
			this.config.match.status = "end";
			this.config.match.winner = winner;
			this.removeAllListeners();
		});

		this.loadMatch(matchConfig);
	}

	loadMatch(inputConfig) {
		const server = this.server;
		const config = this.config;
		const matchConfig = {
			readyPlayersNeeded:
				inputConfig?.readyPlayersNeeded ||
				inputConfig?.playerAmount ||
				4,
			status: inputConfig.status || "warmup",
			teams: [
				{
					name: inputConfig.teams?.team1.name || "team1",
					tag: inputConfig.teams?.tag || false,
					players: inputConfig.teams?.team1.players || [],
					seriesScore: inputConfig.teams?.team1.seriesScore || 0,
					score: inputConfig.teams?.team1.mapScore || 0,
				},
				{
					name: inputConfig.teams?.team2.name || "team2",
					tag: inputConfig.teams?.team2.tag || false,
					players: inputConfig.teams?.team2.players || [],
					seriesScore: inputConfig.teams?.team2.seriesScore || 0,
					score: inputConfig.teams?.team2.mapScore || 0,
				},
			],
			maps: inputConfig.maps?.map((map)=>	{
				return {
					id: map.id,
					name: map.name,
					startingCT: map.startingCT || false,
					score: map.score?([map.score[0], map.score[1]]) : [0, 0],
					workshop: map.workshop || false,
				};
			}
			) || false,
			maxMaps: inputConfig.maxMaps || 1,
			checkPlayer: inputConfig.checkPlayer || false,
		};
		this.config.match = matchConfig;

		this.server.Rcon([
			"mp_teamname_1 " + this.config.match.teams[0].name,
			"mp_teamname_2 " + this.config.match.teams[1].name,
			"mp_teamscore_max " + Math.round(this.config.match.maxMaps / 2),
			"mp_teamscore_1 " + this.config.match.teams[0].seriesScore,
			"mp_teamscore_2 " + this.config.match.teams[1].seriesScore,
		]);

		this.server.on("teamSideUpdate", updateTeamSide);

		this.on("matchEnd", () => {
			this.server.off("teamSideUpdate", updateTeamSide);
		});

		function updateTeamSide(data) {
			const team = config.match.teams.filter(
				(testteam) => testteam.name == data.teamname
			)[0];

			if (team.side == data.side) return;
			team.side = data.side;
			server.log(
				"basicMatch : " + data.teamname + " is now on " + data.side
			);
		}

		this.emit("matchLoaded");
	}

	loadMap(maps, number) {
		this.server.once("matchScoreUpdate", (data) => {
			this.server.Rcon(
				readFileSync(
					"./plugins/matchSetup/cfg/warmup.cfg",
					"utf8"
				).split("\n")
			);
			this.emit("mapLoaded", maps[number]);
			if (this.config.match.maps[number]?.startingCT) {
				const ctTeam = this.config.match.teams.filter(
					(testteam) => testteam.side == "CT"
				)[0];
				if (
					this.config.match.maps[number]?.startingCT !== ctTeam.name
				) {
					this.server.Rcon(["mp_swapteams 1"]);
					this.server.log("basicMatch : swapped teams");
				}
			}
			this.server.log("basicMatch : warmup started");
		});
		if (maps && maps[number].workshop != true) this.server.Rcon(["map " + maps[number].id]);
		if (maps && maps[number].workshop == true) this.server.Rcon(["host_workshop_map " + maps[number].id]);

		if (!maps) this.server.Rcon(["mp_restartgame 1"]);
	}

	startMap() {
		this.config.match.status = "live";

		this.server.Rcon(
			readFileSync("./plugins/matchSetup/cfg/live2v2.cfg", "utf8").split(
				"\n"
			)
		);
		this.server.sayRcon([
			"{lightRed}[matchSetup]{green} Match is going{orange} Live{green} ",
		]);

		this.server.once("matchScoreUpdate", () => {
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} Live!",
				"{lightRed}[matchSetup]{green} Live!",
				"{lightRed}[matchSetup]{green} Live!",
			]);
		});
		this.loadLive()
	}

	loadLive() {
		const server = this.server;
		const config = this.config;
		// on an update of the score write the new score in the this.server object
		this.server.on("matchScoreUpdate", updateScore);

		function updateScore(data) {
			const ctTeam = config.match.teams.filter(
				(testteam) => testteam.side == "CT"
			)[0];
			const tTeam = config.match.teams.filter(
				(testteam) => testteam.side == "TERRORIST"
			)[0];

			// if the score of one of the teams goes down return to surcomvent bugs when teams swap side
			if (ctTeam.score > data.score.ct) return;
			if (tTeam.score > data.score.t) return;

			ctTeam.score = data.score.ct;
			tTeam.score = data.score.t;
		}

		// on roundEnd event write current score with team names in the chat
		this.server.on("roundEnd", printScore);

		function printScore(data) {
			server.sayRcon([
				"{lightRed}[matchSetup]{green} Score: {orange} " +
					config.match.teams[0].name +
					"{purple} " +
					config.match.teams[0].score +
					"{green} : {purple}" +
					config.match.teams[1].score +
					" {orange}" +
					config.match.teams[1].name,
			]);
		}

		this.on("mapEnd", () => {
			this.server.off("matchScoreUpdate", updateScore);
			this.server.off("roundEnd", printScore);
		});
	}

	checkPlayerTeam(player, teams) {
		if (
			teams
				.filter((team) => team.side == player.side)[0]
				?.players.includes(player.steamId3)
		)
			return true;
		return false;
	}

	///////////////////////
	// Ready Handling
	///////////////////////
	loadReady() {
		this.on("allPlayersReady", () => {
			this.server.log("basicMatch : All players are ready!");
			for (const player of this.server.player.list) {
				player.ready = false;
			}

			this.server.command.removeAllListeners("ready");
			this.server.command.removeAllListeners("unready");
			this.server.command.removeAllListeners("status");
			this.server.command.removeAllListeners("forceready");

			this.removeAllListeners("allPlayersReady");
		});

		this.server.command.on("ready", (data) => {
			if (
				this.config.match.checkPlayer &&
				this.checkPlayerTeam(data.player, this.config.match.teams) ==
					false
			)
				return this.server.sayRcon([
					"{lightRed}[matchSetup]{green} {orange}" +
						data.player.name +
						"{red} is either not on the right team or not in the match!",
				]);
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} {orange}" +
					data.player.name +
					"{green} is ready!",
			]);
			data.player.ready = true;
			if (allReady(this.server, this.config))
				this.emit("allPlayersReady");
		});

		this.server.command.on("unready", (data) => {
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} {orange}" +
					data.player +
					"{red} is not ready!",
			]);
			player.ready = false;
		});

		this.server.command.on("forceready", (data) => {
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} an {red}admin {green}forced ready!",
			]);
			for (const player of this.server.player.list) {
				if (
					this.config.checkPlayer &&
					this.checkPlayerTeam(
						data.player,
						this.config.match.teams
					) == false
				)
					return this.server.sayRcon([
						"{lightRed}[matchSetup]{green} {orange}" +
							data.player.name +
							"{red} is either not on the right team or not in the match!",
					]);
				player.ready = true;
			}
			this.emit("allPlayersReady");
		});

		this.server.command.on("status", (data) => {
			let message = [];
			let playersReady = 0;
			for (const player of this.server.player.list) {
				if (player.ready) {
					message.push(
						"{lightRed}[matchSetup]{green} STATUS: {lime}" +
							player.name +
							" is ready!"
					);
					playersReady++;
					continue;
				}
				message.push(
					"{lightRed}[matchSetup]{green} STATUS: {red}" +
						player.name +
						" is not ready!"
				);
			}
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} STATUS: " +
					playersReady +
					" of " +
					this.config.match.readyPlayersNeeded +
					" needed players ready",
				...message,
			]);
		});
		function allReady(server, config) {
			let readyPlayers = 0;
			for (const player of server.player.list) {
				if (player.ready) readyPlayers++;
			}
			if (readyPlayers == config.match.readyPlayersNeeded) return true;
			return false;
		}
	}

	///////////////////////
	// Knife Handling
	///////////////////////
	startKnife() {
		const server = this.server;
		const config = this.config;
		const plugin = this;

		config.match.status = "knife";
		// this.loadPause(server);
		server.Rcon(
			readFileSync("./plugins/matchSetup/cfg/knife.cfg", "utf8").split(
				"\n"
			)
		);
		this.server.sayRcon([
			"{lightRed}[matchSetup]{green} All players are ready! {orange}Knife{green} round will start in 5 seconds",
		]);

		this.server.once("matchScoreUpdate", () => {
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} Knife!",
				"{lightRed}[matchSetup]{green} Knife!",
				"{lightRed}[matchSetup]{green} Knife!",
			]);
		});

		server.on("matchScoreUpdate", loadKnifeCommands);

		function loadKnifeCommands(data) {
			let winnerSide;
			if (data.score.ct == data.score.t) return;
			if (data.score.ct > data.score.t) winnerSide = "CT";
			if (data.score.ct < data.score.t) winnerSide = "TERRORIST";

			// frequently give guidance how to choose side
			const timer = setInterval(() => {
				server.sayRcon([
					"{lightRed}[matchSetup]{green} use {purple}'!stay'{green} or {purple}'!switch'{green} to choose your starting side",
				]);
			}, 20000);

			server.off("matchScoreUpdate", loadKnifeCommands);

			const winnerTeam = config.match.teams.filter(
				(testteam) => testteam.side == winnerSide
			)[0];

			server.sayRcon([
				"{lightRed}[matchSetup]{orange} " +
					winnerTeam.name +
					"{green} won the knife round!",
				"{lightRed}[matchSetup]{green} use {purple}'!stay'{green} or {purple}'!switch'{green} to choose your starting side",
			]);

			server.command.on("stay", stayTeam);
			server.command.on("switch", swapTeam);
			server.command.on("swap", swapTeam);

			function stayTeam(data) {
				if (data.player.side != winnerSide) return;
				server.sayRcon([
					"{lightRed}[matchSetup]{orange} " +
						winnerTeam.name +
						"{green} decided to stay",
				]);

				server.command.off("stay", stayTeam);
				server.command.off("switch", swapTeam);
				server.command.off("swap", swapTeam);
				clearImmediate(timer);
				plugin.emit("knifeConcluded");
			}

			function swapTeam(data) {
				if (data.player.side != winnerSide) return;
				server.sayRcon([
					"{lightRed}[matchSetup]{orange} " +
						winnerTeam.name +
						"{green} decided to swap sides",
				]);
				server.Rcon(["mp_swapteams 1"]);

				server.command.off("stay", stayTeam);
				server.command.off("switch", swapTeam);
				server.command.off("swap", swapTeam);
				clearImmediate(timer);
				plugin.emit("knifeConcluded");
			}
		}
	}

	///////////////////////
	// Pause Handling
	///////////////////////
	loadPause() {
		const plugin = this;
		const server = this.server;
		const config = this.config;

		server.command.on("pause", startPause);

		function startPause() {
			config.match.paused = true;
			server.command.removeAllListeners("pause");
			plugin.loadReady(server);

			server.Rcon(["mp_pause_match"]);

			server.sayRcon([
				"{lightRed}[matchSetup]{green} type {purple}!ready{green} to unpause game",
			]);

			plugin.on("allPlayersReady", endPause);
		}

		function endPause() {
			server.log("basicMatch : match unpaused!");
			server.Rcon(["mp_unpause_match"]);
			config.match.paused = false;
			server.sayRcon(["{lightRed}[matchSetup]{green} match is resumed!"]);
			plugin.off("allPlayersReady", endPause);
			server.command.on("pause", startPause);
		}

		this.on("mapEnd", () => {
			server.command.removeAllListeners("pause");
		});
	}
}
