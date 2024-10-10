import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  HandshakeEvent,
  MousePosition,
  Player,
  PlayerClientCreateSessionEvent,
  PlayerClientJoinSessionEvent,
  PlayerClientSideMovingEvent,
  PlayerClientStartDrawingEvent,
  PlayerClientStopDrawingEvent,
  PlayerDrawingEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  PlayerMovedEvent,
  SessionCreatedEvent,
  UUID,
} from "./common.js";

interface PlayerOnServer extends Player {
  ws: WebSocket;
  remoteAddress: string;
}

interface Session {
  players: Map<UUID, PlayerOnServer>;
  joinedIds: Set<UUID>;
  leftIds: Set<UUID>;
  movingPlayers: Map<UUID, MousePosition>;
  drawings: Map<
    UUID,
    {
      playerId: UUID;
      color: string;
      paths: { x: number; y: number }[];
    }
  >;
  createdAt: number;
  currentDrawingId?: UUID;
}

const SERVER_FPS = 60;
const WS_PORT = 3030;
const SERVER_SINGLE_IP_LIMIT = 10;
// const SERVER_TOTAL_LIMIT = 10;

const wss = new WebSocketServer({
  port: WS_PORT,
});

const sessions = new Map<UUID, Session>();
const connectionLimits = new Map<string, number>();

wss.on("connection", (ws, req) => {
  //  if (players.size >= SERVER_TOTAL_LIMIT) {
  //    ws.close();
  //    return;
  //  }

  if (req.socket.remoteAddress === undefined) {
    ws.close(3002, "no remote address");
    return;
  }

  const remoteAddress = req.socket.remoteAddress;

  {
    let count = connectionLimits.get(remoteAddress) || 0;
    if (count >= SERVER_SINGLE_IP_LIMIT) {
      ws.close(3002, "exceeded connection limit");
      return;
    }
    connectionLimits.set(remoteAddress, count + 1);
  }

  let currentSessionId: UUID | undefined;
  const id = crypto.randomUUID();
  const newPlayer = {
    ws,
    remoteAddress,
    id,
  };

  const pl: HandshakeEvent = {
    kind: "Handshake",
    id,
  };
  newPlayer.ws.send(JSON.stringify(pl));

  ws.addEventListener("message", (event: { data: any }) => {
    const parsedEventData = JSON.parse(event.data) as
      | PlayerClientCreateSessionEvent
      | PlayerClientJoinSessionEvent
      | PlayerClientSideMovingEvent
      | PlayerClientStopDrawingEvent
      | PlayerClientStartDrawingEvent;

    switch (parsedEventData.kind) {
      case "PlayerClientCreateSession":
        {
          const sessionId = crypto.randomUUID();
          currentSessionId = sessionId;

          const session = {
            players: new Map<UUID, PlayerOnServer>(),
            createdAt: Date.now(),
            joinedIds: new Set<UUID>(),
            leftIds: new Set<UUID>(),
            movingPlayers: new Map<UUID, MousePosition>(),
            drawings: new Map<
              UUID,
              {
                playerId: UUID;
                color: string;
                paths: { x: number; y: number }[];
              }
            >(),
          };
          console.log("created session ", sessionId);
          session.players.set(id, newPlayer);
          session.joinedIds.add(id);

          sessions.set(sessionId, session);

          const pl: SessionCreatedEvent = {
            kind: "SessionCreated",
            sessionId,
          };
          newPlayer.ws.send(JSON.stringify(pl));
        }
        break;

      case "PlayerClientJoinSession":
        {
          const targetSession = sessions.get(parsedEventData.sessionId);
          currentSessionId = parsedEventData.sessionId;

          if (!targetSession) {
            const msg = "[PlayerClientJoinSession] This session has been ended";
            console.error(msg);
            ws.close(3002, msg);
            return;
          }
          targetSession.players.set(id, newPlayer);
          targetSession.joinedIds.add(id);

          console.log(`Player ${id} requesting to connect in session ${currentSessionId}`);
        }
        break;

      case "PlayerClientSideMoving":
        {
          const targetSession = sessions.get(parsedEventData.sessionId);

          if (!targetSession) {
            const msg = "[PlayerClientSideMoving] This session has been ended";
            console.error(msg);
            ws.close(3002, msg);
            return;
          }

          const targetPlayer = targetSession.players.get(id);
          if (targetPlayer) {
            const { x, y } = parsedEventData;
            targetSession.movingPlayers.set(
              targetPlayer.id,
              new MousePosition(x, y),
            );

            if (targetSession.currentDrawingId) {
              const currentDrawing = targetSession.drawings.get(
                targetSession.currentDrawingId,
              );

              if (!currentDrawing) {
                const msg =
                  "[PlayerClientSideMoving] Something went wrong drawing";
                console.error(msg, targetSession.currentDrawingId);
                ws.close(3002, msg);
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
          const targetSession = sessions.get(parsedEventData.sessionId);

          if (!targetSession) {
            const msg =
              "[PlayerClientStartDrawing] This session has been ended";
            console.error(msg);
            ws.close(3002, msg);
            return;
          }

          targetSession.currentDrawingId = crypto.randomUUID();
          console.log("player started drawing", targetSession.currentDrawingId);
          if (targetSession.currentDrawingId) {
            if (targetSession.drawings.has(targetSession.currentDrawingId)) {
              const msg =
                "[PlayerClientStartDrawing] Something went wrong on start drawing";
              console.error(msg);
              ws.close(3002, msg);
              return;
            } else {
              const { x, y, playerId, color } = parsedEventData;
              targetSession.drawings.set(targetSession.currentDrawingId, {
                playerId,
                color,
                paths: [{ x, y }],
              });
            }
          } else {
            const msg =
              "[PlayerClientStartDrawing] Something went wrong drawing path";
            console.error(msg);
            ws.close(3002, msg);
            return;
          }
        }
        break;

      case "PlayerClientStopDrawing":
        {
          const targetSession = sessions.get(parsedEventData.sessionId);

          if (!targetSession) {
            const msg = "[PlayerClientStopDrawing] This session has been ended";
            console.error(msg);
            ws.close(3002, msg);
            return;
          }

          targetSession.currentDrawingId = undefined;
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
    if (currentSessionId) {
      const currentSession = sessions.get(currentSessionId);

      if (currentSession) {
        console.log(
          `player ${id} disconnected from session ${currentSessionId}`,
        );
        currentSession.players.delete(id);
        if (!currentSession.joinedIds.delete(id)) {
          currentSession.leftIds.add(id);
        }
      }
    }
  });
});

function tick() {
  for (const [sessionId, session] of sessions) {
    const { joinedIds, movingPlayers, players, leftIds, drawings } = session;

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
              } as PlayerJoinedEvent),
            );
            console.log(`Player ${joinedId} connected to session ${sessionId}`);
            players.forEach((otherPlayer) => {
              if (otherPlayer.id !== joinedPlayer.id)
                joinedPlayer.ws.send(
                  JSON.stringify({
                    kind: "PlayerJoined",
                    id: otherPlayer.id,
                  } as PlayerJoinedEvent),
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
                } as PlayerJoinedEvent),
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
              } as PlayerLeftEvent),
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
              } as PlayerMovedEvent),
            );
          }
        });
      }
    }

    if (drawings.size > 0) {
      for (const [drawingId, { paths, playerId, color }] of drawings) {
        players.forEach((player) => {
          player.ws.send(
            JSON.stringify({
              kind: "PlayerDrawing",
              drawingId,
              paths,
              playerId,
              color,
            } as PlayerDrawingEvent),
          );
        });
      }
    }

    joinedIds.clear();
    leftIds.clear();
    movingPlayers.clear();
  } 

  setTimeout(tick, 1000 / SERVER_FPS);
}

setTimeout(tick, 1000 / SERVER_FPS);
console.log("App running on http://localhost:3000");
