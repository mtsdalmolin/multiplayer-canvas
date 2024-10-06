import {
  DrawingPath,
  MousePosition,
  Player,
  PlayerClientSideMovingEvent,
  PlayerClientStartDrawingEvent,
  PlayerClientStopDrawingEvent,
  PlayerDrawingEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  PlayerMovedEvent,
  UUID,
} from "./common.js";

let currX = 0;
let currY = 0;
let prevX = 0;
let prevY = 0;
let STROKE_STYLE = "white";
let LINE_WIDTH = 2;
const factor = 80;
const drawings = new Map<
  UUID,
  {
    playerId: UUID;
    color: string;
    paths: DrawingPath[];
  }
>();
let isDrawing = false;
let drawingColor: string = STROKE_STYLE;
let myCurrentId: UUID | undefined;

(() => {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  if (canvas === null) throw new Error("No canvas with id `game` is found");
  canvas.width = 16 * factor;
  canvas.height = 9 * factor;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  let players = new Map<UUID, Player>();
  const ws = new WebSocket("ws://localhost:3030");

  ws.addEventListener("close", (event) => {
    console.log("WEBSOCKET CLOSE", event);
  });
  ws.addEventListener("error", (event) => {
    console.log("WEBSOCKET ERROR", event);
  });
  ws.addEventListener("message", (event) => {
    const parsedEventData = JSON.parse(event.data) as
      | PlayerJoinedEvent
      | PlayerLeftEvent
      | PlayerMovedEvent
      | PlayerDrawingEvent;

    switch (parsedEventData.kind) {
      case "PlayerJoined":
        {
          if (players.size === 0) {
            myCurrentId = parsedEventData.id;
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
          const { drawingId, paths, color, playerId } = parsedEventData;

          drawings.set(drawingId, {
            playerId,
            paths,
            color,
          });
        }
        break;
    }
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
        STROKE_STYLE = drawing.color;
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
    function (e) {
      const x = e.clientX - ctx.canvas.offsetLeft;
      const y = e.clientY - ctx.canvas.offsetTop;

      const pl: PlayerClientSideMovingEvent = {
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
    function (e) {
      isDrawing = true;
      const x = e.clientX - ctx.canvas.offsetLeft;
      const y = e.clientY - ctx.canvas.offsetTop;

      if (myCurrentId) {
        const pl: PlayerClientStartDrawingEvent = {
          kind: "PlayerClientStartDrawing",
          x,
          y,
          color: drawingColor,
          playerId: myCurrentId,
        };
        console.log(pl)
        ws.send(JSON.stringify(pl));
      } else {
        console.error(
          "Your id is not defined. Please refresh the page to try again",
        );
        ws.close();
      }
    },
    false,
  );
  canvas.addEventListener(
    "mouseup",
    function (e) {
      isDrawing = false;
      const x = e.clientX - ctx.canvas.offsetLeft;
      const y = e.clientY - ctx.canvas.offsetTop;

      const pl: PlayerClientStopDrawingEvent = {
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
    function (e) {
      isDrawing = false;
      const x = e.clientX - ctx.canvas.offsetLeft;
      const y = e.clientY - ctx.canvas.offsetTop;

      const pl: PlayerClientStopDrawingEvent = {
        kind: "PlayerClientStopDrawing",
        x,
        y,
      };
      ws.send(JSON.stringify(pl));
    },
    false,
  );

  const colorPicker = document.getElementById("color");
  if (!colorPicker)
    throw new Error(
      "No color picker found. You won't be able to change your drawing color",
    );

  colorPicker.addEventListener("input", (evt: any) => {
    const colorValue = evt.target.value;
    if (!colorValue) {
      drawingColor= "white";
    } else {
      drawingColor = colorValue;
    }
  });
})();

function draw(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(prevX, prevY);
  ctx.lineTo(currX, currY);
  ctx.strokeStyle = STROKE_STYLE;
  ctx.lineWidth = LINE_WIDTH;
  ctx.stroke();
  ctx.closePath();
}
