import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { MousePosition, Player, UUID } from "./common.js";

interface PlayerOnServer extends Player {
  ws: WebSocket;
  remoteAddress: string;
}

const SERVER_FPS = 60;
const WS_PORT = 3030;
const SERVER_SINGLE_IP_LIMIT = 10;
const SERVER_TOTAL_LIMIT = 10;

const wss = new WebSocketServer({
  port: WS_PORT,
});

const players = new Map<UUID, PlayerOnServer>();
const connectionLimits = new Map<string, number>();
const joinedIds = new Set<UUID>();
const leftIds = new Set<UUID>();
const movingPlayers = new Map<UUID, MousePosition>();
const drawings = new Map<
  UUID,
  { playerId: UUID; color: string; paths: { x: number; y: number }[] }
>();

wss.on("connection", (ws, req) => {
  if (players.size >= SERVER_TOTAL_LIMIT) {
    ws.close();
    return;
  }

  if (req.socket.remoteAddress === undefined) {
    ws.close();
    return;
  }

  const remoteAddress = req.socket.remoteAddress;

  {
    let count = connectionLimits.get(remoteAddress) || 0;
    if (count >= SERVER_SINGLE_IP_LIMIT) {
      ws.close();
      return;
    }
    connectionLimits.set(remoteAddress, count + 1);
  }

  const id = crypto.randomUUID();
  const newPlayer = {
    ws,
    remoteAddress,
    id,
  };
  players.set(id, newPlayer);
  joinedIds.add(id);
  let currentDrawingId: UUID | undefined;

  ws.addEventListener("message", (event: { data: any }) => {
    const parsedEventData = JSON.parse(event.data) as
      | {
        kind: "PlayerClientSideMoving";
        x: number;
        y: number;
      }
      | {
        kind: "PlayerClientStartDrawing";
        x: number;
        y: number;
        playerId: UUID;
        color: string;
      }
      | { kind: "PlayerClientStopDrawing" };

    switch (parsedEventData.kind) {
      case "PlayerClientSideMoving":
        {
          const targetPlayer = players.get(id);
          if (targetPlayer) {
            const { x, y } = parsedEventData;
            movingPlayers.set(targetPlayer.id, new MousePosition(x, y));

            if (currentDrawingId) {
              const currentDrawing = drawings.get(currentDrawingId);

              if (!currentDrawing) {
                console.error("something went wrong drawing", currentDrawingId);
                ws.close();
                return;
              } else {
                currentDrawing.paths.push({ x, y });
              }
            }
          }
        }
        break;

      case "PlayerClientStartDrawing":
        {
          currentDrawingId = crypto.randomUUID();
          console.log("player started drawing", currentDrawingId);
          if (currentDrawingId) {
            if (drawings.has(currentDrawingId)) {
              console.error("something went wrong on start drawing");
              ws.close();
              return;
            } else {
              const { x, y, playerId, color } = parsedEventData;
              drawings.set(currentDrawingId, {
                playerId,
                color,
                paths: [{ x, y }],
              });
            }
          } else {
            console.error("something went wrong drawing path");
            ws.close();
            return;
          }
        }
        break;

      case "PlayerClientStopDrawing":
        {
          currentDrawingId = undefined;
        }
        break;
    }
  });

  ws.on("close", () => {
    let count = connectionLimits.get(remoteAddress);
    if (count !== undefined) {
      if (count <= 1) {
        connectionLimits.delete(remoteAddress);
      } else {
        connectionLimits.set(remoteAddress, count - 1);
      }
    }
    console.log(`player ${id} disconnected`);
    players.delete(id);
    if (!joinedIds.delete(id)) {
      leftIds.add(id);
    }
  });
});

function tick() {
  if (joinedIds.size > 0) {
    // initialize joined player
    {
      joinedIds.forEach((joinedId) => {
        const joinedPlayer = players.get(joinedId);
        if (joinedPlayer) {
          joinedPlayer.ws.send(
            JSON.stringify({
              kind: "PlayerJoined",
              id: joinedId,
            }),
          );

          players.forEach((otherPlayer) => {
            if (otherPlayer.id !== joinedPlayer.id)
              joinedPlayer.ws.send(
                JSON.stringify({
                  kind: "PlayerJoined",
                  id: otherPlayer.id,
                }),
              );
          });
        }
      });
    }

    // Notifying old players about who joined
    {
      players.forEach((player) => {
        if (!joinedIds.has(player.id)) {
          joinedIds.forEach((joinedId) => {
            player.ws.send(
              JSON.stringify({
                kind: "PlayerJoined",
                id: joinedId,
              }),
            );
          });
        }
      });
    }
  }

  // Notifying about lefters
  if (leftIds.size > 0) {
    leftIds.forEach((leftId) => {
      players.forEach((player) => {
        if (player.id !== leftId) {
          player.ws.send(
            JSON.stringify({
              kind: "PlayerLeft",
              id: leftId,
            }),
          );
        }
      });
    });
  }

  // Notifying moving players
  if (movingPlayers.size > 0) {
    for (const [movingId, movingPosition] of movingPlayers) {
      players.forEach((player) => {
        if (player.id !== movingId) {
          player.ws.send(
            JSON.stringify({
              kind: "PlayerMoved",
              id: movingId,
              x: movingPosition.x,
              y: movingPosition.y,
            }),
          );
        }
      });
    }
  }

  if (drawings.size > 0) {
    for (const [drawingId, { paths, playerId, color }] of drawings) {
      players.forEach((player) => {
        if (player.id !== playerId) {
          player.ws.send(
            JSON.stringify({
              kind: "PlayerDrawing",
              drawingId,
              paths,
              playerId,
              color
            }),
          );
        }
      });
    }
  }

  joinedIds.clear();
  leftIds.clear();
  movingPlayers.clear();

  setTimeout(tick, 1000 / SERVER_FPS);
}

setTimeout(tick, 1000 / SERVER_FPS);
console.log("App running on http://localhost:3000");
