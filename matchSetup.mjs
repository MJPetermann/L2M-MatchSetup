export default class matchSetup {
    static name = "matchSetup"
    static description = "setup matches with knife rounds"
    static author = "MJPetermann"
    static commands = [
        { command: "ready", permission: "basic.basicMatch", description: "marks player as ready" },
        { command: "unready", permission: "basic.basicMatch", description: "marks player as not ready" },
        { command: "status", permission: "basic.basicMatch", description: "gives information on how many players are ready" },
        { command: "forceready", permission: "admin.basicMatch", description: "skips ready" }]
    static init(server) {
        server.plugin = {}
        server.plugin.basicMatch = {
            readyPlayersNeeded: 2
        }

        loadReady(server)

    }
}

function loadReady(server) {
    server.plugin.basicMatch.ready = true

    server.on("allPlayersReady", () => {
        server.plugin.basicMatch.ready = false
        server.log("basicMatch : All players are ready!")
    })

    server.on("allPlayersReady", () => {
        server.sayRcon(["{pink}[basicMatch]{white} everyone is ready!"])
    })

    server.command.on("ready", (data) => {
        if (!server.plugin.basicMatch.ready) return
        const player = server.players.filter(testplayer => testplayer.steamId3 == data.player.steamId3)[0]
        server.sayRcon(["{pink}[basicMatch]{white} " + player.name + " is ready!"])
        player.ready = true
        if (allReady(server)) server.emit("allPlayersReady")
    })

    server.command.on("unready", (data) => {
        if (!server.plugin.basicMatch.ready) return
        const player = server.players.filter(testplayer => testplayer.steamId3 == data.player.steamId3)[0]
        server.sayRcon(["{pink}[basicMatch]{white} " + player.name + " is not ready!"])
        player.ready = false
    })

    server.command.on("forceready", (data) => {
        if (!server.plugin.basicMatch.ready) return
        server.sayRcon(["{pink}[basicMatch]{white} an admin forced ready!"])
        server.emit("allPlayersReady")
    })

    server.command.on("status", (data) => {
        if (!server.plugin.basicMatch.ready) return
        let message = []
        let playersReady = 0
        for (const player of server.players) {
            if (player.ready) {
                message.push("{pink}[basicMatch]{white} STATUS: " + player.name + " is ready!")
                playersReady++
                continue
            }
            message.push("{pink}[basicMatch]{white} STATUS: " + player.name + " is not ready!")
        }
        server.sayRcon(["{pink}[basicMatch]{white} STATUS: " + playersReady + " of " + server.plugin.basicMatch.readyPlayersNeeded + " needed players ready", ...message])
    })
}

function allReady(server) {
    let readyPlayers = 0
    for (const player of server.players) {
        if (player.ready) readyPlayers++
    }
    if (readyPlayers == server.plugin.basicMatch.readyPlayersNeeded) return true
    return false
}