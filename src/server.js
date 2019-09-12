const WebSocket = require('ws');
const uuidv1 = require('uuid');
const WebSocketServer = WebSocket.Server;

const C2S = {
    'createRoom': 'C2SCreateRoom',
    'joinRoom': 'C2SJoinRoom',
    'startGame': 'C2SStartGame',
}

const S2C = {
    'createRoom': 'S2CCreateRoom',
    'joinRoom': 'S2CJoinRoom',
    'startGame': 'S2CStartGame',
}

class Player {
    constructor(id) {
        this.id = id;
    }
}

class RoomMgr {
    static init() {
        this.index = 0;
        this.rooms = new Map();
    }

    static createRoom(player) {
        let room = new GameRoom(this.index, player);
        this.rooms.set(this.index, room);
        this.index++;
        return room;
    }

    static findRoom(id) {
        return this.rooms.get(id);
    }
}

class GameRoom {
    constructor(id, player) {
        this.id = id;
        this.master = player;
        this.players = [player];
    }

    add(player) {
        this.players.push(player);
    }

    get member() {
        return this.players;
    }
}

class GameServerMgr {
    constructor() {
        this.connections = new Map();
        this.players = new Map();
        this.wss = new WebSocketServer({
            port: 8787,
        });
        this.wss.on('listening', (ws) => {
            console.log('listening');
        });
        
        this.wss.on('connection', (ws) => {
            let uuid = uuidv1();
            let player = new Player(uuid);
            this.players.set(uuid, player);
            this.connections.set(uuid, ws);
            ws.on('message', (message) => {
                let data = JSON.parse(message);
                switch (data.type) {
                    case C2S.createRoom: {
                        let room = RoomMgr.createRoom(player);
                        let result = {
                            'type': S2C.createRoom,
                            'payload': {
                                'roomId': room.id,
                                'masterId': room.master,
                                'member': room.member,
                            }
                        };
                        ws.send(JSON.stringify(result));
                        break;
                    }
                    case C2S.joinRoom: {
                        let room = RoomMgr.findRoom(data.payload.roomId);
                        if (!room) {
                            return;
                        }

                        room.add(player);
                        let result = {
                            'type': S2C.joinRoom,
                            'payload': {
                                'roomId': room.id,
                                'masterId': room.master,
                                'member': room.member,
                            }
                        };
                        this.broadcastRoom(result, room);
                        break;
                    }
                    case C2S.startGame: {
                        let room = RoomMgr.findRoom(data.payload.roomId);
                        if (!room) {
                            return;
                        }

                        let result = {
                            'type': S2C.startGame,
                        }
                        this.broadcastRoom(result, room);
                        break;
                    }
                    default:
                        let room = RoomMgr.findRoom(data.payload.roomId);
                        if (!room) {
                            return;
                        }

                        this.broadcastRoom(data, room);
                        break;
                }
            });
            ws.on('error', (event) => {
                console.error(uuid, 'error');
                this.players.delete(uuid);
                this.connections.delete(uuid);
            });
            ws.on('close', (event) => {
                console.log(uuid, 'close');
                this.players.delete(uuid);
                this.connections.delete(uuid);
            });
        });
    }

    broadcastRoom(result, room) {
        let member = room.member;
        for (let i = 0; i < member.length; i++) {
            let ws = this.connections.get(member[i].id);
            if (ws) {
                ws.send(JSON.stringify(result));
            }
        }
    }
}

function init() {
    RoomMgr.init();
    const gameServer = new GameServerMgr();
}

init();
