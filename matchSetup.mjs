import { readFileSync } from 'node:fs';
import event from "events"

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

	constructor(server, router) {
		super()
		this.name = this.constructor.name
		this.description = this.constructor.description
		this.author = this.constructor.author
		this.commands = this.constructor.commands
		
		this.router = router

        this.server = server;
        this.init();
		this.config = {}
    }

	init() {
		this.router.get('/', (req, res) => {
			res.json("plugin loaded")
		})

		this.router.get('/config', (req, res) => {
			res.json(this.config)
		})

		this.router.get('/match', (req, res) => {
			res.json(this.config?.match? this.config.match : "no match loaded")
		})

		this.server.command.on("match", (data) => {
			if (this.config.match && this.config.match.status !== "end") return this.server.sayRcon(["{lightRed}[matchSetup]{green} match is ongoing!"]);
			this.config.match = {}
			this.handleMatch(data)

		});

		this.server.on("matchEnd", (data) => this.emit("mapEnd", data))

	}

	handleMatch () {
		this.once("matchLoaded", () => {
			this.server.sayRcon(["{lightRed}[matchSetup]{green} loaded match!"]);
			
			let mapNumber = this.config.match.teams[0].seriesScore + this.config.match.teams[1].seriesScore
			this.loadMap(this.config.match.maps, mapNumber)
		})


		this.on("mapLoaded", (map) => {
			this.loadReady()
			this.once("allPlayersReady", (data) => {
				map?.startingCT? this.startMap() : this.startKnife()
				clearInterval(this.timer)
				this.server.once("matchScoreUpdate", () => {
					this.loadPause()
				})
			});
			// frequently give guidance how to ready to players
			this.timer = setInterval(() => {
				this.server.sayRcon(["{lightRed}[matchSetup]{green} type {purple}'!ready'{green} to ready up"]);
			}, 20000);
		})

		
		this.on("knifeConcluded", (data) => {
			this.startMap();
		});

		this.on("mapEnd", (data) => {
			let mapNumber = this.config.match.teams[0].seriesScore + this.config.match.teams[1].seriesScore

			const ctTeam = this.config.match.teams.filter(
				(testteam) => testteam.side == "CT"
			)[0];

			const tTeam = this.config.match.teams.filter(
				(testteam) => testteam.side == "TERRORIST"
			)[0];

			this.config.match.maps[mapNumber].score = [this.config.match.teams[0].score, this.config.match.teams[1].score]

			if (data.score.ct > data.score.t) {
				ctTeam.seriesScore++
				this.server.sayRcon(["{lightRed}[matchSetup]{orange} " + ctTeam.name + "{green} won{darkPurple} " + this.config.match.maps[mapNumber].name]);
			}

			if (data.score.ct < data.score.t) {
				tTeam.seriesScore++
				this.server.sayRcon(["{lightRed}[matchSetup]{orange} " + tTeam.name + "{green} won{darkPurple} " + this.config.match.maps[mapNumber].name]);
			}

			if (this.config.match.teams[0].seriesScore > this.config.match.maxMaps/2 || this.config.match.teams[1].seriesScore > this.config.match.maxMaps/2) {
				this.emit("matchEnd")
				return
			}

			this.config.match.teams[0].score = 0
			this.config.match.teams[1].score = 0

			this.loadMap(this.config.match.maps, mapNumber+1)
		});

		this.on("matchEnd", () => {
			this.server.sayRcon(["{lightRed}[matchSetup]{green} match ended!"]);
			this.config.match.status = "end"	
			this.removeAllListeners()
		})

		this.loadMatch({maps: [
			{name:"Inferno", id:"de_inferno", startingCT:false}, 
			{name:"Nuke", id:"de_nuke", startingCT:false}, 
			{name:"Overpass", id:"de_overpass", startingCT:false}]
		})
	}

	loadMatch (inputConfig) {
		const server = this.server
		const config = this.config
		const matchConfig = {
			readyPlayersNeeded: inputConfig?.readyPlayersNeeded || inputConfig?.playerAmount || 1,
			status: "warmup",
			teams: 
			[
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
			maps: inputConfig.maps || false,
			maxMaps: inputConfig.maxMaps || 1,
		}
		this.config.match = matchConfig

		this.server.Rcon([
			"mp_teamname_1 " + this.config.match.teams[0].name,
			"mp_teamname_2 " + this.config.match.teams[1].name,
		]);

		this.server.on("teamSideUpdate", updateTeamSide);

		this.on("matchEnd", () => {
			this.server.off("teamSideUpdate", updateTeamSide);
		})

		function updateTeamSide (data) {
			const team = config.match.teams.filter(
				(testteam) => testteam.name == data.teamname
			)[0]
	
			if (team.side == data.side) return
			team.side = data.side
			server.log("basicMatch : " + data.teamname + " is now on " + data.side);
		}

		this.emit("matchLoaded")
	}

	loadMap (maps, number) {
		this.server.once("matchScoreUpdate", (data) => {
			this.server.Rcon(readFileSync("./plugins/matchSetup/cfg/warmup.cfg", "utf8").split("\n"))
			this.emit("mapLoaded", maps[number])
			if (this.config.match.maps[number]?.startingCT){
				const ctTeam = this.config.match.teams.filter(
					(testteam) => testteam.side == "CT"
				)[0];
				if (this.config.match.maps[number]?.startingCT !== ctTeam.name) {
					this.server.Rcon(["mp_swapteams 1"]);
					this.server.log("basicMatch : swapped teams")
				}
			}
			this.server.log("basicMatch : warmup started")
		})

		if (maps) this.server.Rcon(["map " + maps[number].id])
		if (!maps) this.server.Rcon(["mp_restartgame 1"])
	}

	startMap() {
		const server = this.server
		const config = this.config
		this.config.match.status = "live"

		this.server.Rcon(readFileSync("./plugins/matchSetup/cfg/live2v2.cfg", "utf8").split("\n"))
		this.server.sayRcon(["{lightRed}[matchSetup]{green} Match is going{orange} Live{green} "]);

	
		// on an update of the score write the new score in the this.server object
		this.server.on("matchScoreUpdate", updateScore);

		this.server.once("matchScoreUpdate", () => {
			this.server.sayRcon(["{lightRed}[matchSetup]{green} Live!","{lightRed}[matchSetup]{green} Live!","{lightRed}[matchSetup]{green} Live!"]);
		})

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

		function printScore(data){
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
		})
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
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} {orange}" + data.player.name + "{green} is ready!",
			]);
			data.player.ready = true;
			if (allReady(this.server, this.config)) this.emit("allPlayersReady");
		});
	
		this.server.command.on("unready", (data) => {
			this.server.sayRcon([
				"{lightRed}[matchSetup]{green} {orange}" + data.player + "{red} is not ready!",
			]);
			player.ready = false;
		});
	
		this.server.command.on("forceready", (data) => {
			this.server.sayRcon(["{lightRed}[matchSetup]{green} an {red}admin {green}forced ready!"]);
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
			if (readyPlayers == config.match.readyPlayersNeeded)
				return true;
			return false;
		}
	}

	

	///////////////////////
	// Knife Handling
	///////////////////////
	startKnife() {
		const server = this.server;
		const config = this.config
		const plugin = this

		config.match.status = "knife";
		// this.loadPause(server);
		server.Rcon(readFileSync("./plugins/matchSetup/cfg/knife.cfg", "utf8").split("\n"));
		this.server.sayRcon(["{lightRed}[matchSetup]{green} All players are ready! {orange}Knife{green} round will start in 5 seconds"]);

		this.server.once("matchScoreUpdate", () => {
			this.server.sayRcon(["{lightRed}[matchSetup]{green} Knife!","{lightRed}[matchSetup]{green} Knife!","{lightRed}[matchSetup]{green} Knife!"]);
		})

		server.on("matchScoreUpdate", loadKnifeCommands);

		function loadKnifeCommands (data) {
			let winnerSide;
			if (data.score.ct == data.score.t) return;
			if (data.score.ct > data.score.t) winnerSide = "CT";
			if (data.score.ct < data.score.t) winnerSide = "TERRORIST";

			// frequently give guidance how to choose side
			const timer = setInterval(() => {
				server.sayRcon(["{lightRed}[matchSetup]{green} use {purple}'!stay'{green} or {purple}'!switch'{green} to choose your starting side"]);
			}, 20000);

			server.off("matchScoreUpdate", loadKnifeCommands);

			const winnerTeam = config.match.teams.filter(
				(testteam) => testteam.side == winnerSide
			)[0];
		
			server.sayRcon([
				"{lightRed}[matchSetup]{orange} " + winnerTeam.name + "{green} won the knife round!",
				"{lightRed}[matchSetup]{green} use {purple}'!stay'{green} or {purple}'!switch'{green} to choose your starting side",
			]);
		
			server.command.on("stay", stayTeam);
			server.command.on("switch", swapTeam);
			server.command.on("swap", swapTeam);
		
			function stayTeam(data) {
				if (data.player.side != winnerSide) return;
				server.sayRcon(["{lightRed}[matchSetup]{orange} " + winnerTeam.name + "{green} decided to stay"]);
		
				server.command.off("stay", stayTeam);
				server.command.off("switch", swapTeam);
				server.command.off("swap", swapTeam);
				clearImmediate(timer);
				plugin.emit("knifeConcluded")
			}
		
			function swapTeam(data) {
				if (data.player.side != winnerSide) return;
				server.sayRcon([
					"{lightRed}[matchSetup]{orange} " + winnerTeam.name + "{green} decided to swap sides",
				]);
				server.Rcon(["mp_swapteams 1"]);
		
				server.command.off("stay", stayTeam);
				server.command.off("switch", swapTeam);
				server.command.off("swap", swapTeam);
				clearImmediate(timer);
				plugin.emit("knifeConcluded")
			}
		}
	}

	///////////////////////
	// Pause Handling
	///////////////////////
	loadPause() {
		const plugin = this
		const server = this.server
		const config = this.config

		server.command.on("pause", startPause);
	
		function startPause() {
			config.match.paused = true;
			server.command.removeAllListeners("pause");
			plugin.loadReady(server);
	
			server.Rcon(["mp_pause_match"]);
	
			server.sayRcon(["{lightRed}[matchSetup]{green} type {purple}!ready{green} to unpause game"]);
	
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
		})
	
	}
}
