import { timeStamp } from "console";
import { MousePosition, Player, UUID } from "./common.js";

let currX = 0;
let currY = 0;
let prevX = 0;
let prevY = 0;
let dot_flag = false;
let flag = false;
let STROKE_STYLE = "white";
let LINE_WIDTH = 2;
const factor = 80;
const drawings = new Map<
  UUID,
  {
    playerId: UUID;
    color: string;
    paths: { x: number; y: number }[];
  }
>();
let isDrawing = false;

(() => {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  if (canvas === null) throw new Error("No canvas with id `game` is found");
  canvas.width = 16 * factor;
  canvas.height = 9 * factor;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  let players = new Map<ReturnType<typeof crypto.randomUUID>, Player>();
  const ws = new WebSocket("ws://localhost:3030");

  ws.addEventListener("close", (event) => {
    console.log("WEBSOCKET CLOSE", event);
  });
  ws.addEventListener("error", (event) => {
    console.log("WEBSOCKET ERROR", event);
  });
  ws.addEventListener("message", (event) => {
    const parsedEventData = JSON.parse(event.data) as
      | {
        kind: "PlayerJoined" | "PlayerLeft";
        id: ReturnType<typeof crypto.randomUUID>;
        players: Map<ReturnType<typeof crypto.randomUUID>, Player>;
      }
      | {
        kind: "PlayerMoved";
        id: ReturnType<typeof crypto.randomUUID>;
        x: number;
        y: number;
      }
      | {
        kind: "PlayerDrawing";
        drawingId: UUID;
        paths: { x: number; y: number }[];
        playerId: UUID;
        color: string;
      };

    switch (parsedEventData.kind) {
      case "PlayerJoined":
        {
          if (parsedEventData.players) {
            players = new Map(parsedEventData.players);
            return;
          }

          players.set(parsedEventData.id, {
            id: parsedEventData.id,
          });
        }
        break;
      case "PlayerLeft":
        {
          players.delete(parsedEventData.id);
        }
        break;
      case "PlayerMoved":
        {
          const movingPlayer = players.get(parsedEventData.id);

          if (!movingPlayer) {
            console.error("Badly formatted payload", parsedEventData);
            ws.close();
            return;
          }

          movingPlayer.position = new MousePosition(
            parsedEventData.x,
            parsedEventData.y,
          );
        }
        break;
      case "PlayerDrawing":
        {
          // {
          //   kind: "PlayerDrawing", drawingId, paths, playerId;
          // }
          const { drawingId, paths, color, playerId } = parsedEventData;

          drawings.set(drawingId, {
            playerId,
            paths,
            color,
          });
        }
        break;
    }
    console.log(players);
  });

  const frame = () => {
    ctx.reset(); // Clear the context!
    ctx.fillStyle = "red";
    ctx.font = "12px Arial";

    players.forEach((player) => {
      if (player.position?.x && player.position?.y) {
        const textWidth = ctx.measureText(player.id).width;

        ctx.translate(0, -7);
        ctx.fillRect(player.position.x, player.position.y, textWidth, 12);

        ctx.resetTransform();

        ctx.fillStyle = "black";
        ctx.textBaseline = "middle";
        ctx.fillText(player.id, player.position.x, player.position.y);
      }
    });

    drawings.forEach((drawing) => {
      for (
        let prevPathIdx = 0;
        prevPathIdx < drawing.paths.length;
        prevPathIdx++
      ) {
        const currPathIdx = prevPathIdx + 1;
        if (currPathIdx === drawing.paths.length) continue;
        prevX = drawing.paths[prevPathIdx].x;
        prevY = drawing.paths[prevPathIdx].y;
        currX = drawing.paths[currPathIdx].x;
        currY = drawing.paths[currPathIdx].y;
        draw(ctx);
      }
    });

    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(frame);
  });

  canvas.addEventListener(
    "mousemove",
    function(e) {
      const x = e.clientX - ctx.canvas.offsetLeft;
      const y = e.clientY - ctx.canvas.offsetTop;

      const pl = {
        kind: "PlayerClientSideMoving",
        x,
        y,
        isDrawing,
      };
      ws.send(JSON.stringify(pl));
    },
    false,
  );
  canvas.addEventListener(
    "mousedown",
    function(e) {
      isDrawing = true;
      const x = e.clientX - ctx.canvas.offsetLeft;
      const y = e.clientY - ctx.canvas.offsetTop;
      const pl = {
        kind: "PlayerClientStartDrawing",
        x,
        y,
        color: "red",
      };
      ws.send(JSON.stringify(pl));
    },
    false,
  );
  canvas.addEventListener(
    "mouseup",
    function(e) {
      isDrawing = false;
      const x = e.clientX - ctx.canvas.offsetLeft;
      const y = e.clientY - ctx.canvas.offsetTop;
      const pl = {
        kind: "PlayerClientStopDrawing",
        x,
        y,
      };
      ws.send(JSON.stringify(pl));
    },
    false,
  );
  canvas.addEventListener(
    "mouseout",
    function(e) {
      isDrawing = false;
      const x = e.clientX - ctx.canvas.offsetLeft;
      const y = e.clientY - ctx.canvas.offsetTop;
      const pl = {
        kind: "PlayerClientStopDrawing",
        x,
        y,
      };
      ws.send(JSON.stringify(pl));
    },
    false,
  );
})();

function color(obj: { id: string }) {
  switch (obj.id) {
    case "green":
      STROKE_STYLE = "green";
      break;
    case "blue":
      STROKE_STYLE = "blue";
      break;
    case "red":
      STROKE_STYLE = "red";
      break;
    case "yellow":
      STROKE_STYLE = "yellow";
      break;
    case "orange":
      STROKE_STYLE = "orange";
      break;
    case "black":
      STROKE_STYLE = "black";
      break;
    case "white":
      STROKE_STYLE = "white";
      break;
  }
  if (STROKE_STYLE == "white") LINE_WIDTH = 14;
  else LINE_WIDTH = 2;
}

function draw(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(prevX, prevY);
  ctx.lineTo(currX, currY);
  ctx.strokeStyle = STROKE_STYLE;
  ctx.lineWidth = LINE_WIDTH;
  ctx.stroke();
  ctx.closePath();
}

function findxy(
  ctx: CanvasRenderingContext2D,
  res: "move" | "down" | "up" | "out",
  e: MouseEvent,
) {
  if (res == "down") {
    prevX = currX;
    prevY = currY;
    currX = e.clientX - ctx.canvas.offsetLeft;
    currY = e.clientY - ctx.canvas.offsetTop;
    flag = true;
    dot_flag = true;
    if (dot_flag) {
      ctx.beginPath();
      ctx.fillStyle = STROKE_STYLE;
      ctx.fillRect(currX, currY, 2, 2);
      ctx.closePath();
      dot_flag = false;
    }
  }
  if (res == "up" || res == "out") {
    flag = false;
  }
  if (res == "move") {
    if (flag) {
      prevX = currX;
      prevY = currY;
      currX = e.clientX - ctx.canvas.offsetLeft;
      currY = e.clientY - ctx.canvas.offsetTop;

      //  if (drawingId) {
      //    if (drawings.has(drawingId)) {
      //      const artifactBeingDrawn = drawings.get(drawingId);
      //      if (!artifactBeingDrawn) {
      //        throw new Error("something went wrong drawing the artifact");
      //      }
      //      artifactBeingDrawn.paths.push({ currX, currY, prevX, prevY });
      //    } else {
      //      drawings.set(drawingId, {
      //        paths: [{ currX, currY, prevX, prevY }],
      //      });
      //    }
      //    draw(ctx);
      //  }
    }
  }
}
